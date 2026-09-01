# Vendored Thebes runtimes

`memphis-connect.js` and `passkey.js` are copied from the Thebes SDK
(<https://github.com/Mercatura-Forum/thebes-sdk>, `runtime/`). They are vendored
rather than installed so this repository builds without a registry account and
so the exact bytes that were tested are the exact bytes that ship — the same
convention every Thebes example app follows.

**One deliberate divergence from the SDK copy.** A header comment in
`memphis-connect.js` explained the origin-scoped token by analogy to another
network's per-frontend delegation scheme. Proofly carries no reference to any
other chain, so that clause was dropped; the same paragraph still explains the
property via OAuth's `aud` claim (RFC 9068). Comment text only — not one byte
of executable code differs. Re-apply this edit whenever these files are
refreshed from the SDK.

| File | What it provides | Why Proofly needs it |
| --- | --- | --- |
| `memphis-connect.js` | `window.memphis` — `connect` / `resume` / `loadSession` / `renew` / `signOut` | Runs the passkey ceremony in a window at the Memphis origin and returns a session token minted for Proofly's origin only. |
| `passkey.js` | `window.MemphisPasskey` — the Memphis transport | Silent renewal. Without it sign-in still works, it just stops being durable. |

Both are loaded as `beforeInteractive` scripts from `src/app/layout.tsx`.

## ⚠️ Two `passkey.js` lineages exist — take the SDK one

`thebes-deploy new` scaffolds a **different, older** `passkey.js` (~53 KB) than
the SDK ships (~76 KB). It is not interchangeable:

| | SDK `runtime/passkey.js` (what is vendored here) | `thebes-deploy new` scaffold copy |
| --- | --- | --- |
| `issueScopedSession` / `exchangeRefresh` | ✅ | ❌ |
| `window.MEMPHIS_SESSION_SCOPE` storage scoping | ❌ (not referenced) | ✅ |
| transient-retry (`postJsonWithRetry`) | ❌ | ✅ |

Proofly's contract verifies with `whoami_scoped_u`, which only accepts an
**origin-scoped** token — and only the SDK lineage can mint one
(`issueScopedSession`) or renew one (`exchangeRefresh`). Swapping in the
scaffold's copy would break sign-in entirely, so **do not "upgrade" to it**
because it looks newer or carries patches this one lacks.

`MEMPHIS_SESSION_SCOPE` is therefore not set anywhere in this app, and setting
it would do nothing: the key it guards is `passkey.js`'s own *master* session
store, which Proofly never writes. The passkey ceremony runs in the connect
window at the Memphis origin, and the only thing this page keeps is the
origin-scoped session — which `memphis-connect.js` already stores per origin
*and* per app name.

**Refreshing them:** copy the files from the SDK's `runtime/` directory at the
tag you intend to pin, and re-read `docs/memphis.md` at that tag before
assuming behaviour is unchanged. A vendored copy is frozen at the moment it was
taken; when something misbehaves, diff against the copy a working production app
uses rather than against the newest tag.

Licensed Apache-2.0 by the Thebes Protocol contributors.
