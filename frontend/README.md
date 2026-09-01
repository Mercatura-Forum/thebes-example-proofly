# Proofly frontend

A Next.js app that is **not served by a web host**. It is exported to static
files, installed into an asset smart contract, and served from the Thebes
validator set at `/_/raw/<frontend cid>/`.

That one fact drives everything unusual here, so read these before changing
anything:

| | |
| --- | --- |
| [`../README.md`](../README.md) | Build, deploy, and what the app demonstrates about Thebes |
| [`src/lib/thebes/README.md`](./src/lib/thebes/README.md) | The chain layer — transport, Candid codec, Memphis identity |
| [`src/lib/asset.ts`](./src/lib/asset.ts) | Why every `public/` URL goes through `asset()` |

## Running it

```bash
./scripts/dev-frontend.sh     # from the repository root
```

Use that, **not** a bare `npm run dev`. The script reads the contract ids out of
`thebes.toml` and bakes them in; without them the app addresses contract `0` and
every call fails.

**Signing in does not work on localhost.** A WebAuthn credential is bound to a
relying-party id, and a page may only claim an RP id that is a suffix of its own
origin, so the Memphis passkey ceremony only runs when the app is served from
the gateway. Everything that does not need a session works locally.

## Checks

```bash
npm run check:codec           # Candid codec vs. the golden vectors
npx tsc --noEmit              # types
```

`check:codec` also runs inside `scripts/build-frontend.sh`, so a codec
regression fails the build rather than reaching a user.
