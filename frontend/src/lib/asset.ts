/**
 * URLs for files in `public/`.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Proofly is served from the chain, so every page lives under a prefix:
 * `/_/raw/<frontend cid>/`. `next.config.ts` sets `basePath`, and Next.js
 * applies that prefix on its own to the things it generates — the `/_next/…`
 * bundles, `next/font` files, and `next/link` hrefs. It does **not** apply it
 * to a `src` you write by hand.
 *
 * `next/image` is the trap. With `images.unoptimized` — which a static export
 * requires — the `src` is passed through to the `<img>` untouched, so
 *
 *     <Image src="/images/logo.jpg" />
 *
 * ships as `src="/images/logo.jpg"`, the browser asks the gateway for
 * `https://<gateway>/images/logo.jpg` instead of
 * `https://<gateway>/_/raw/<cid>/images/logo.jpg`, and gets a 404. The file is
 * on chain and perfectly reachable; only the URL is wrong. What the visitor
 * sees is the alt text where the picture should be.
 *
 * So every hand-written reference to something in `public/` goes through
 * `asset()`. In `next dev` the base path is empty and these are pass-throughs,
 * which is why the bug does not reproduce locally — it only appears once the
 * app is served from a contract.
 */

/** The prefix the app is served under, baked in by `scripts/build-frontend.sh`. */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** The boundary that fronts the validator set. */
const GATEWAY = process.env.NEXT_PUBLIC_THEBES_GATEWAY || 'https://memphis.mercaturaforum.com';

/**
 * A root-relative URL for a file in `public/`, carrying the base path.
 *
 *     asset('/images/logo.jpg')  →  '/_/raw/95417562499047/images/logo.jpg'
 *
 * Use it for anything the browser fetches from this origin: `<Image src>`,
 * `<img src>`, a favicon, a stylesheet's `url()` written in TSX.
 */
export function asset(path: string): string {
    return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * A fully-qualified URL for a file in `public/`.
 *
 * Open Graph and Twitter card images are fetched by other people's servers,
 * which have no origin to resolve a root-relative path against — those need
 * the whole thing.
 */
export function absoluteAsset(path: string): string {
    return `${GATEWAY}${asset(path)}`;
}

/** Where this build of the app actually lives. */
export const SITE_URL = `${GATEWAY}${BASE_PATH}`;
