import type { NextConfig } from "next";

/**
 * Proofly is served **from the chain**. `thebes-deploy` installs the asset
 * contract and uploads this bundle; the boundary then serves it at
 * `/_/raw/<frontend cid>/<path>`.
 *
 * That prefix is why `basePath` is set from the environment. A Next.js export
 * emits absolute asset URLs (`/_next/…`), which 404 under a prefix — and a
 * relative `assetPrefix` does not save you either, because a nested route like
 * `/companies/` would then resolve its assets under `/companies/_next/…`.
 * `scripts/build-frontend.sh` reads the cid out of `thebes.toml` and passes it
 * in, so the manifest stays the single source of truth for what was deployed.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },

  // Baked into the bundle at build time by scripts/build-frontend.sh.
  env: {
    NEXT_PUBLIC_BACKEND_CID: process.env.NEXT_PUBLIC_BACKEND_CID,
    NEXT_PUBLIC_FRONTEND_CID: process.env.NEXT_PUBLIC_FRONTEND_CID,
    NEXT_PUBLIC_THEBES_GATEWAY: process.env.NEXT_PUBLIC_THEBES_GATEWAY,
    NEXT_PUBLIC_BASE_PATH: basePath,
  },

  compress: true,
  poweredByHeader: false,

  webpack: (config) => {
    config.optimization = {
      ...config.optimization,
      minimize: true,
    };
    return config;
  },
};

export default nextConfig;
