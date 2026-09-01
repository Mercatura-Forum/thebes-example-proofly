/**
 * Where Proofly's contracts live, and how the browser reaches them.
 *
 * Both ids are baked at build time by `scripts/build-frontend.sh`, which reads
 * them out of `thebes.toml` — the manifest stays the single source of truth,
 * and nothing here can drift from what was actually deployed.
 */

/** Proofly's backend contract id on Thebes. */
export const BACKEND_CID: number = Number(
    process.env.NEXT_PUBLIC_BACKEND_CID ?? 0
);

/** Proofly's frontend (asset) contract id. */
export const FRONTEND_CID: number = Number(
    process.env.NEXT_PUBLIC_FRONTEND_CID ?? 0
);

/** The public boundary that fronts the validator set. */
export const GATEWAY =
    process.env.NEXT_PUBLIC_THEBES_GATEWAY || 'https://memphis.mercaturaforum.com';

/**
 * The origin to send API calls to.
 *
 * Deployed, Proofly is served by the boundary itself at
 * `<gateway>/_/raw/<cid>/…`, so the calls are same-origin and the empty string
 * is right. Anywhere else — `next dev`, a preview build — they go to the
 * gateway by absolute URL, which `/api/*` allows cross-origin.
 */
export function apiBase(): string {
    if (typeof window === 'undefined') return GATEWAY;
    try {
        return window.location.origin === new URL(GATEWAY).origin ? '' : GATEWAY;
    } catch {
        return GATEWAY;
    }
}

/**
 * The name this app connects to Memphis under. It labels the stored session
 * and is shown to the person in the sign-in window.
 */
export const APP_NAME = 'Proofly';

/**
 * Whether the Memphis passkey ceremony can run at all on this page.
 *
 * A WebAuthn credential is bound to a relying-party id, and a page may only
 * claim an RP id that is a suffix of its own origin — so the ceremony
 * physically cannot run on `localhost`. Everything else in the app still works
 * there; only signing in does not.
 */
export function canSignIn(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.location.origin === new URL(GATEWAY).origin;
    } catch {
        return false;
    }
}
