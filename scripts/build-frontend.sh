#!/usr/bin/env bash
#
# Build Proofly's frontend for the chain.
#
# `thebes.toml` is the single source of truth for where Proofly lives, so this
# reads the contract ids straight out of it and bakes them into the bundle:
#
#   NEXT_PUBLIC_BACKEND_CID    who the app calls
#   NEXT_PUBLIC_FRONTEND_CID   the app's own asset contract
#   NEXT_PUBLIC_BASE_PATH      /_/raw/<frontend cid>, the prefix the boundary
#                              serves this bundle under — Next.js emits absolute
#                              asset URLs, so it has to know the prefix at build
#                              time or every /_next/… request 404s
#   NEXT_PUBLIC_THEBES_GATEWAY the boundary host
#
# `thebes-deploy deploy` runs this as the frontend canister's build command; run
# it by hand for a local production build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${THEBES_MANIFEST:-$ROOT/thebes.toml}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "build-frontend: no manifest at $MANIFEST" >&2
  exit 1
fi

read -r BACKEND_CID FRONTEND_CID GATEWAY < <(
  python3 - "$MANIFEST" <<'PY'
import sys, tomllib

with open(sys.argv[1], "rb") as fh:
    manifest = tomllib.load(fh)

canisters = manifest.get("canisters", {})
try:
    backend = canisters["backend"]["cid"]
    frontend = canisters["frontend"]["cid"]
except KeyError as missing:
    sys.exit(f"build-frontend: {missing} is not declared in the manifest")

for name, cid in (("backend", backend), ("frontend", frontend)):
    if not isinstance(cid, int):
        # `auto` means the tool picks an id at deploy time, which is too late:
        # the frontend's own id has to be known before the bundle is built.
        sys.exit(
            f"build-frontend: canisters.{name}.cid is {cid!r}. Both ids must be "
            "literal integers in thebes.toml — the frontend bundle bakes them in."
        )

networks = manifest.get("networks", {})
default = manifest.get("project", {}).get("default_network")
network = networks.get(default) or (next(iter(networks.values())) if networks else {})
gateway = network.get("gateway") or "https://memphis.mercaturaforum.com"

print(backend, frontend, gateway)
PY
)

export NEXT_PUBLIC_BACKEND_CID="$BACKEND_CID"
export NEXT_PUBLIC_FRONTEND_CID="$FRONTEND_CID"
export NEXT_PUBLIC_BASE_PATH="/_/raw/$FRONTEND_CID"
export NEXT_PUBLIC_THEBES_GATEWAY="$GATEWAY"

echo "build-frontend: backend=$BACKEND_CID frontend=$FRONTEND_CID"
echo "build-frontend: base path $NEXT_PUBLIC_BASE_PATH on $GATEWAY"

cd "$ROOT/frontend"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

# The Candid codec is Proofly's own (frontend/src/lib/thebes/candid.ts), so it
# is checked against the reference-generated golden vectors on every build. A
# codec regression is otherwise invisible until a user's call comes back
# garbled on chain.
npm run check:codec

rm -rf out
npm run build

# The Memphis runtimes are plain <script> tags, so they must survive into the
# bundle exactly as vendored. If they did not, sign-in fails at runtime with a
# message about window.memphis rather than at build time, so check here.
for runtime in memphis-connect.js passkey.js; do
  if [[ ! -f "out/$runtime" ]]; then
    echo "build-frontend: out/$runtime is missing — the Memphis runtime did not ship" >&2
    exit 1
  fi
done

echo "build-frontend: bundle ready in frontend/out"
