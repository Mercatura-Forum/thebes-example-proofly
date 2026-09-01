/**
 * Memphis — Thebes' identity layer, as Proofly uses it.
 *
 * Memphis (contract 921) gives every person a passkey-backed *anchor*, and
 * gives Proofly a **stable, per-app, pseudonymous principal** derived from it.
 * The same human is the same Proofly principal forever, and an unlinkable
 * different principal in every other Thebes app. There is no wallet, no seed
 * phrase and no password anywhere in this flow.
 *
 * ── Why the sign-in happens in another window ───────────────────────────────
 *
 * A WebAuthn credential is bound to a relying-party id, and a page may only
 * claim an RP id that is a registrable-domain suffix of its own origin. Memphis
 * anchors live under one RP id, so the passkey ceremony physically cannot run
 * on an arbitrary app page — the browser refuses before any of our code runs.
 *
 * `memphis-connect.js` therefore runs the ceremony in a window at the Memphis
 * origin. That window holds the master session — anchor-scoped, and whoever
 * holds one *is* that person at every Thebes app — and hands back only a token
 * minted **for Proofly's origin**, refused everywhere else. Proofly never sees
 * a master token, which is the whole point: a compromised app must not become
 * a compromised identity.
 *
 * ── Staying signed in ───────────────────────────────────────────────────────
 *
 * An access token lasts 30 real minutes; a refresh credential (pinned to this
 * origin, and never able to produce a master session) mints new ones silently
 * for weeks. `restore()` does that on load, which is why a returning visitor is
 * not asked for their passkey on every visit. Silent renewal needs `passkey.js`
 * loaded alongside `memphis-connect.js` — that is where the Memphis transport
 * lives.
 *
 * This module is a typed face over the vendored runtime; the runtime owns the
 * session bookkeeping (one record per origin + app name, the expiry stored
 * beside the token, the redirect fragment stripped before anything can read
 * it). Each of those rules exists because its absence was a shipped bug, so
 * they are used here rather than reimplemented.
 */
import { APP_NAME } from './config';

/** An origin-scoped Memphis session. `token` is what the contract verifies. */
export interface MemphisSession {
    /** The app name this credential was minted for. */
    app: string;
    /** The person's Memphis handle, e.g. `amira.thebes`. */
    name: string;
    /** 32-byte anchor id **hash**, hex. Never the raw anchor. */
    anchorId: string;
    /** The origin-scoped session token, hex. */
    token: string;
    /** The web origin this token is valid at, and only at. */
    origin: string;
    /** Local upper bound on validity. Memphis remains the authority. */
    expiresAtMs: number;
}

export type ConnectMode = 'popup' | 'redirect' | 'auto';

interface MemphisRuntime {
    connect: (opts: { app: string; mode?: ConnectMode; handle?: string }) => Promise<MemphisSession>;
    resume: () => MemphisSession | null;
    loadSession: (app: string) => MemphisSession | null;
    renew: (app: string) => Promise<MemphisSession | null>;
    signOut: (app: string) => void;
}

function runtime(): MemphisRuntime {
    const m = (globalThis as unknown as { memphis?: MemphisRuntime }).memphis;
    if (!m || typeof m.connect !== 'function') {
        throw new Error(
            'Memphis is not loaded — check the <script src="memphis-connect.js"> tag in the app layout.'
        );
    }
    return m;
}

/**
 * Wait for the vendored runtime to define `window.memphis`.
 *
 * The script tag that defines it blocks parsing at the top of the body, so in
 * practice it is already there. But Next's own bundles load `async` from the
 * head and can execute first, and this is the one place where losing that race
 * is visible to a person — a signed-in visitor would land on the page signed
 * out. A short poll costs nothing and removes the race entirely.
 */
async function waitForRuntime(timeoutMs = 3000): Promise<MemphisRuntime | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            return runtime();
        } catch {
            if (Date.now() >= deadline) return null;
            await new Promise((r) => setTimeout(r, 50));
        }
    }
}

/** True when this session exists and has not passed its local expiry. */
export function isLive(s: MemphisSession | null | undefined): s is MemphisSession {
    return !!s && !!s.token && (!s.expiresAtMs || s.expiresAtMs > Date.now());
}

/**
 * The session Proofly holds, if any — no network, no window.
 *
 * Prefer [`restore`] anywhere an `await` is possible: this one cannot renew, so
 * using it alone is how a site quietly stops keeping people signed in.
 */
export function getSession(): MemphisSession | null {
    try {
        const held = runtime().loadSession(APP_NAME);
        return isLive(held) ? held : null;
    } catch {
        return null;
    }
}

/**
 * The session for this page load: collect a redirect return, else the held
 * session, else a silent renewal. Never opens a window and never prompts.
 *
 * Call this on mount, before reading `getSession`.
 */
export async function restore(): Promise<MemphisSession | null> {
    const rt = await waitForRuntime();
    if (!rt) return null;

    // A redirect-mode return is collected first — it also strips the URL
    // fragment, so a token is never left sitting in the address bar.
    try {
        const returned = rt.resume();
        if (isLive(returned)) return returned;
    } catch {
        /* not a redirect return */
    }

    const held = rt.loadSession(APP_NAME);
    if (isLive(held)) return held;

    try {
        const renewed = await rt.renew(APP_NAME);
        return isLive(renewed) ? renewed : null;
    } catch {
        return null;
    }
}

/**
 * Sign in.
 *
 * **Call this straight from a user gesture, with nothing awaited first.** An
 * `await` ends the gesture; a popup opened outside one is blocked, and on iOS
 * Safari and in-app browsers that is the difference between working and not.
 * `mode: 'auto'` falls back to a full-page redirect when the popup is blocked
 * anyway, which is why it is the default here.
 */
export function signIn(mode: ConnectMode = 'auto'): Promise<MemphisSession> {
    return runtime().connect({ app: APP_NAME, mode });
}

/**
 * Forget the session this site holds.
 *
 * Local only. It does not end the person's Memphis session — `end_session` is
 * caller-scoped on Memphis, so only the Memphis origin can, and that is the
 * correct boundary.
 */
export function signOut(): void {
    try {
        runtime().signOut(APP_NAME);
    } catch {
        /* nothing loaded, nothing to forget */
    }
}

/**
 * Treat a token as spent this long before its stated expiry.
 *
 * A call takes a moment to reach the contract, and the contract re-checks the
 * expiry itself. Starting a call with a token that dies in flight turns a
 * renewable session into a failed action the person has to repeat.
 */
const RENEW_SKEW_MS = 30_000;

/** One renewal at a time; concurrent callers share it rather than racing. */
let renewInFlight: Promise<MemphisSession | null> | null = null;

/**
 * A live session for the call about to be made — renewing silently if the one
 * in hand has lapsed.
 *
 * An access token lasts 30 real minutes. Without this, a tab left open across
 * that line starts failing every call until the person reloads, which reads as
 * the app being broken rather than as a session ending. The refresh credential
 * exists precisely so that does not happen, so every call goes through here
 * rather than through `getSession`.
 *
 * Returns null when there is nothing to renew from — then, and only then, the
 * person genuinely has to sign in again.
 */
export async function ensureSession(
    bound?: MemphisSession | null
): Promise<MemphisSession | null> {
    const usable = (s: MemphisSession | null | undefined) =>
        !!s && !!s.token && (!s.expiresAtMs || s.expiresAtMs - RENEW_SKEW_MS > Date.now());

    if (usable(bound)) return bound as MemphisSession;

    // Another tab may have renewed already; the store is shared per origin.
    const held = getSession();
    if (usable(held)) return held;

    if (!renewInFlight) {
        renewInFlight = (async () => {
            const rt = await waitForRuntime();
            if (!rt) return null;
            try {
                const renewed = await rt.renew(APP_NAME);
                return isLive(renewed) ? renewed : null;
            } catch {
                return null;
            }
        })();
        void renewInFlight.finally(() => {
            renewInFlight = null;
        });
    }

    return renewInFlight;
}

/** A hex session token as the bytes the contract expects. */
export function tokenBytes(session: MemphisSession | null | undefined): Uint8Array {
    const hex = session?.token ?? '';
    const clean = hex.length % 2 ? `0${hex}` : hex;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}
