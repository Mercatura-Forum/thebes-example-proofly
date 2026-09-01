#!/usr/bin/env bash
#
# Run the frontend dev server against the live Thebes testnet.
#
# `npm run dev` on its own is not enough: the contract ids are baked in from
# `thebes.toml` at build time, so a bare dev server would call contract 0 — the
# management contract — and every request would fail for a reason that looks
# nothing like the cause. This exports the same values the production build
# uses, minus the base path (the dev server serves from the root).
#
# Sign-in does NOT work here. A WebAuthn credential is bound to a
# relying-party id, and a page may only claim an RP id that is a suffix of its
# own origin, so the Memphis passkey ceremony can only run when the app is
# served from the gateway. Everything that does not need a session — the
# landing page, `/verify`, the whole UI — works.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${THEBES_MANIFEST:-$ROOT/thebes.toml}"

read -r BACKEND_CID FRONTEND_CID GATEWAY < <(
  python3 - "$MANIFEST" <<'PY'
import sys, tomllib

with open(sys.argv[1], "rb") as fh:
    manifest = tomllib.load(fh)

canisters = manifest.get("canisters", {})
backend = canisters.get("backend", {}).get("cid")
frontend = canisters.get("frontend", {}).get("cid")
if not isinstance(backend, int) or not isinstance(frontend, int):
    sys.exit("dev-frontend: both canister ids must be literal integers in thebes.toml")

networks = manifest.get("networks", {})
default = manifest.get("project", {}).get("default_network")
network = networks.get(default) or (next(iter(networks.values())) if networks else {})
print(backend, frontend, network.get("gateway") or "https://memphis.mercaturaforum.com")
PY
)

export NEXT_PUBLIC_BACKEND_CID="$BACKEND_CID"
export NEXT_PUBLIC_FRONTEND_CID="$FRONTEND_CID"
export NEXT_PUBLIC_THEBES_GATEWAY="$GATEWAY"
# No base path: the dev server serves from /, not from /_/raw/<cid>/.
export NEXT_PUBLIC_BASE_PATH=""

echo "dev-frontend: backend=$BACKEND_CID on $GATEWAY (sign-in unavailable off the gateway origin)"

cd "$ROOT/frontend"
[[ -d node_modules ]] || npm install
exec npm run dev
