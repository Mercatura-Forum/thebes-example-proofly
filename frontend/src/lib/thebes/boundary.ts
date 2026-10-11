/**
 * The Thebes boundary client.
 *
 * Everything the browser does with the chain goes through four HTTP routes on
 * the boundary node:
 *
 * ```
 *   POST /api/query                          read replicated state, no consensus
 *   POST /api/call                           submit an update into the ingress pool
 *   GET  /api/receipt?hash=…                 poll until the quorum finalizes it
 * ```
 *
 * Arguments and replies are hex-encoded Candid. Encoding is left to the caller
 * (see `actor.ts`), so this file is pure transport.
 *
 * ── Two behaviours here are not optional ────────────────────────────────────
 *
 * **Reads retry; the submit does not.** The boundary fans out across the
 * validator set, and a validator that is briefly unreachable answers 502. That
 * is transient and the next attempt routes elsewhere — so queries and receipt
 * polls retry with backoff. The `/api/call` submit is never retried on a
 * transient: a retry after a submit that actually landed would execute the
 * update twice. Its receipt is polled instead.
 *
 * **Every update is signed.** The chain refuses an unsigned call that names a
 * sender. Each update is signed by an Ed25519 key made for it, nonce 0 (see
 * "Signed ingress" below), so there is no nonce to fetch or recover.
 */
import { apiBase } from './config';

const RETRIES = 3;
const RECEIPT_TIMEOUT_MS = 30_000;

function isTransient(status: number, body: string): boolean {
    return (
        status === 502 ||
        status === 503 ||
        status === 504 ||
        /validator unreachable|no healthy validator|unhealthy/i.test(body)
    );
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<any> {
    let lastErr = '';
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
        try {
            const res = await fetch(url, init);
            const text = await res.text();
            if (!res.ok && isTransient(res.status, text)) {
                lastErr = `HTTP ${res.status}: ${text.slice(0, 200)}`;
                continue;
            }
            try {
                return JSON.parse(text);
            } catch {
                throw new Error(`malformed reply from the boundary: ${text.slice(0, 200)}`);
            }
        } catch (e) {
            // DNS, connection reset and friends are transient too.
            lastErr = String(e);
        }
    }
    throw new Error(`The network is briefly unreachable — please try again. (${lastErr})`);
}

// ─── Signed ingress ───────────────────────────────────────────────────────
// The chain refuses an unsigned call that names a sender. The contract never
// keys data on the caller (who the user is comes from their Memphis session
// token, an ordinary argument), so each update is signed by an Ed25519 key made
// for that one call, with nonce 0: a fresh key's only nonce, so there is no
// nonce to fetch and nothing for two calls to contend over. WebCrypto Ed25519
// signs where the browser has it; elsewhere the noble-ed25519 file served at
// the site root is loaded once. With neither, the call fails and nothing
// unsigned is sent.

const NOBLE_ED25519_FILE = 'noble-ed25519-3.1.0.js';
const utf8 = new TextEncoder();

function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) { out.set(p, at); at += p.length; }
    return out;
}
const u32be = (v: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v); return b; };
const u64be = (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v)); return b; };
const lenPrefixed = (b: Uint8Array) => concatBytes(u32be(b.length), b);
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));

/** egypt-state message.rs IngressMessage::signing_payload() for a Call (tag 0x02). */
export function callSigningPayload(cid: number, method: string, arg: Uint8Array, sender: Uint8Array, nonce: number): Uint8Array<ArrayBuffer> {
    return concatBytes(utf8.encode('egypt-l1-ingress-v1'), Uint8Array.of(0x02), u64be(cid),
        lenPrefixed(utf8.encode(method)), lenPrefixed(arg), lenPrefixed(sender), u64be(nonce));
}

let noblePromise: Promise<any> | null = null;
function loadNoble(): Promise<any> {
    if (!noblePromise) {
        noblePromise = import(/* webpackIgnore: true */ new URL('/' + NOBLE_ED25519_FILE, window.location.href).href);
        noblePromise.catch(() => { noblePromise = null; });
    }
    return noblePromise;
}

/** The signed fields of one /api/call body: { sender, nonce: 0, signature }. */
export async function signCall(cid: number, method: string, argHex: string): Promise<{ sender: string; nonce: number; signature: string }> {
    const arg = fromHex(argHex);
    try {
        const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign'])) as CryptoKeyPair;
        const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
        const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, callSigningPayload(cid, method, arg, pub, 0)));
        return { sender: toHex(pub), nonce: 0, signature: toHex(sig) };
    } catch {
        /* no WebCrypto Ed25519: fall through to noble */
    }
    let ed: any;
    try {
        ed = await loadNoble();
    } catch {
        throw new Error('This browser cannot sign the request: it has no Ed25519, and the signing library did not load.');
    }
    const sk = ed.utils.randomSecretKey();
    const pub: Uint8Array = await ed.getPublicKeyAsync(sk);
    const sig: Uint8Array = await ed.signAsync(callSigningPayload(cid, method, arg, pub, 0), sk);
    return { sender: toHex(pub), nonce: 0, signature: toHex(sig) };
}

/** A read. Answered from replicated state by the node asked; no consensus round. */
export async function query(cid: number, method: string, argHex: string): Promise<string> {
    const json = await fetchWithRetry(`${apiBase()}/api/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            canister_id: cid,
            method,
            arg: argHex,
        }),
    });
    if (json.status !== 'success') {
        throw new Error(json.error || `query ${method} failed`);
    }
    return json.reply || '';
}

async function submit(cid: number, method: string, argHex: string): Promise<any> {
    const res = await fetch(`${apiBase()}/api/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ canister_id: cid, method, arg: argHex, ...(await signCall(cid, method, argHex)) }),
    });
    const text = await res.text();
    if (!res.ok && isTransient(res.status, text)) {
        throw new Error('The network is briefly unreachable — please try again.');
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`malformed reply from the boundary: ${text.slice(0, 200)}`);
    }
}

/** An update. Ordered by consensus, executed on every validator, then sealed. */
export async function call(cid: number, method: string, argHex: string): Promise<string> {
    const reply = await submit(cid, method, argHex);
    if (!reply.queued || !reply.message_hash) {
        throw new Error(reply.error || `call ${method} was rejected`);
    }
    return pollReceipt(reply.message_hash, method);
}

async function pollReceipt(hashHex: string, method: string): Promise<string> {
    const deadline = Date.now() + RECEIPT_TIMEOUT_MS;
    let transientPolls = 0;

    while (Date.now() < deadline) {
        try {
            const json = await fetchWithRetry(`${apiBase()}/api/receipt?hash=${hashHex}`);
            if (json.found) {
                if (json.status === 'success') return json.reply || '';
                throw new Error(json.error || `${method} failed on chain`);
            }
        } catch (e) {
            // A transient while polling is not a failed call — the update may
            // still be in flight. Keep polling until the deadline.
            if (++transientPolls > 10) throw e;
        }
        await new Promise((r) => setTimeout(r, 400));
    }

    throw new Error(`Timed out waiting for the chain to finalize ${method}.`);
}
