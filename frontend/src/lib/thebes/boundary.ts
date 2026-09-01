/**
 * The Thebes boundary client.
 *
 * Everything the browser does with the chain goes through four HTTP routes on
 * the boundary node:
 *
 * ```
 *   POST /api/query                          read replicated state, no consensus
 *   GET  /api/next_nonce?sender=…            the sender's next unused nonce
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
 * is transient and the next attempt routes elsewhere — so queries, the nonce
 * fetch and receipt polls retry with backoff. The `/api/call` submit is never
 * retried on a transient: a retry after a submit that actually landed would
 * execute the update twice. Its receipt is polled instead.
 *
 * **A replayed nonce is recoverable.** `next_nonce` can hand back a value the
 * substrate has already seen. The rejection names the real high-water mark
 * ("nonce 3 already used (last seen: 8)"), and it proves the call did *not*
 * execute — so resubmitting at `last seen + 1` is safe, and is what happens.
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

/**
 * This browser's transport sender.
 *
 * It is **not** an identity: nobody signs anything with it, and the contract
 * never keys data on it. It exists so the substrate can sequence this
 * browser's updates by nonce. Who the user actually *is* comes from their
 * Memphis session token, which travels as an ordinary argument.
 *
 * Scoped per contract on purpose. localStorage is per-origin and every app
 * deployed on the gateway shares one origin, so an unscoped key would hand the
 * same sender to every Thebes app on this browser — their nonce sequences
 * would interleave and one app's submit would be rejected as a replay of
 * another's.
 */
function transportSender(cid: number): string {
    const KEY = `thebes-sender:${cid}`;
    try {
        const held = window.localStorage.getItem(KEY);
        if (held) return held;
    } catch {
        /* private mode, blocked storage — fall through to an ephemeral one */
    }
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const sender = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try {
        window.localStorage.setItem(KEY, sender);
    } catch {
        /* ephemeral for this page load, which still works */
    }
    return sender;
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
            sender: transportSender(cid),
        }),
    });
    if (json.status !== 'success') {
        throw new Error(json.error || `query ${method} failed`);
    }
    return json.reply || '';
}

async function submit(
    cid: number,
    method: string,
    argHex: string,
    sender: string,
    nonce: number
): Promise<any> {
    const res = await fetch(`${apiBase()}/api/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ canister_id: cid, method, arg: argHex, sender, nonce }),
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
    const sender = transportSender(cid);

    const nonceReply = await fetchWithRetry(
        `${apiBase()}/api/next_nonce?sender=${sender}`,
        { cache: 'no-store' }
    );
    if (typeof nonceReply.next_nonce !== 'number') {
        throw new Error('malformed next_nonce reply from the boundary');
    }

    let reply = await submit(cid, method, argHex, sender, nonceReply.next_nonce);

    if (!reply.queued && typeof reply.error === 'string' && /nonce .* already used/i.test(reply.error)) {
        const seen = reply.error.match(/last seen:\s*(\d+)/i);
        const recovered = seen ? Number(seen[1]) + 1 : nonceReply.next_nonce + 1;
        reply = await submit(cid, method, argHex, sender, recovered);
    }

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
