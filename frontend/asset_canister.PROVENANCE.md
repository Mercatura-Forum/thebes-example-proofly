# `asset_canister.wasm`

The Thebes asset contract: the smart contract that holds Proofly's frontend
bundle and serves it over the boundary at `/_/raw/<cid>/…`. `thebes.toml`
installs it on the frontend cid, then uploads `frontend/out` into it.

|  |  |
| --- | --- |
| SHA-256 | `6b72e4fe96b0439e37e485b0bcbf5ac7ccda3a2fd51e39b3e9aa8f276bd55b77` |
| Size | 571,124 bytes |
| Source | The Thebes toolchain's stock asset contract, as shipped with `thebes-deploy` |

It is **not built from this repository** — no source for it lives here. It is
the same binary every Thebes application installs; the hash above is
byte-identical to the copy in each of the Thebes example apps.

## It is a prebuilt binary, and its contents are not ours

This is the one file in the repository that was not built from sources here and
cannot be edited. Searching its bytes with `grep -a` turns up strings left by
the toolchain that compiled it — mangled Rust symbol names from the standard
library, and a Candid specification URL inside a subtyping error message. None
of that is reachable from Proofly's own code, and none of it can be changed
without invalidating the contract that is actually deployed and verified.

Every text file in this repository is free of such references; this binary is
the exception, and it is the same binary every Thebes application installs.

## Why it is committed rather than downloaded

The same reason the Memphis runtimes are vendored (see
`public/thebes-runtime.PROVENANCE.md`): the exact bytes that were tested are the
exact bytes that ship, and a deploy does not depend on a network fetch
succeeding at the wrong moment.

## Verifying what is actually on chain

The hash above is what `thebes-deploy` reported as `module_hash` when it
installed this wasm on cid `95417562499047`. To confirm the deployed contract
still matches this file:

```sh
sha256sum frontend/asset_canister.wasm
```

and compare against the `module_hash` printed by a deploy or by
`thebes-deploy verify frontend`. If they ever differ, the frontend cid is
running a contract that did not come from this repository — stop and find out
why before shipping anything else to it.

## Refreshing it

Take the copy shipped with the `thebes-deploy` release you intend to pin,
replace this file, update the hash and size in the table above, and redeploy.
Because the install carries the wasm and the upload carries the bundle, a new
asset contract needs a full `thebes-deploy deploy frontend` — not the
`--skip-install` asset-only path.
