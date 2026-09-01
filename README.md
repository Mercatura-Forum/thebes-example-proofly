# Proofly

<div align="center">

![Powered by Thebes Protocol](https://img.shields.io/badge/Powered%20by-Thebes%20Protocol-6C3FC5?style=for-the-badge&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**Decentralized employment verification — a reference application for the Thebes Protocol**

[Live app](https://memphis.mercaturaforum.com/_/raw/95417562499047/index.html) ·
[Thebes Protocol](https://thebesprotocol.com/) ·
[Protocol repository](https://github.com/Mercatura-Forum/Thebes-Protocol-)

</div>

---

## Overview

**Proofly** lets a company register its employees on-chain, lets an employee mint
a single-use proof of employment, and lets any third party — a bank, an embassy,
a court — redeem that proof without holding an account.

It exists as a **proof of concept for the [Thebes Protocol](https://thebesprotocol.com/)**:
a post-quantum Layer 1 on which the backend *and* the frontend run as smart
contracts on the validator set. Proofly is deliberately a complete, working
application rather than a toy — it signs people in, enforces access control,
generates cryptographic material, and serves its own UI, all on chain — so that
every part of the platform is exercised by something with real requirements.

It is open source, and it is meant to be read. Where a decision was forced by
the substrate rather than by taste, the code says so at the point of the
decision.

### Why employment verification

Employment claims are asserted constantly — in hiring, lending, immigration and
litigation — and checking one usually means asking the employer directly and
waiting. The record lives in a database somebody controls and can change. A
proof code that is cryptographically bound to a record no one can alter, and
that expires and cannot be reused, is a good fit for a chain, and it exercises
identity, storage, randomness and public reads all at once.

---

## What this demonstrates

Each of these is load-bearing in the app, not a demo path:

| Thebes capability | Where Proofly uses it |
| --- | --- |
| **Memphis passkey identity** | Sign-in. No wallet, no extension, no seed phrase. Every person gets a stable, per-app, pseudonymous principal — the same in Proofly forever, unlinkable to their identity in any other Thebes app. |
| **Backend smart contract** | Rust compiled to WebAssembly, replicated across every validator. All companies, employment records and proofs live here. |
| **Frontend smart contract** | The whole Next.js bundle is installed into an asset contract and served from the chain. There is no web host anywhere in the stack. |
| **Stable memory** | Company, employee and proof state — including the proof-id counter — survives an in-place upgrade. |
| **Inter-contract calls** | The contract asks Memphis who a session token belongs to. This is why every authenticated read is an update, not a query: a query cannot make one. |
| **Chain randomness** | `raw_rand` from the management contract seeds every proof code — deterministic for the quorum, unpredictable to everyone else. |
| **Byzantine finality** | Sub-second deterministic finality, with post-quantum signatures from the validator quorum. |
| **Open query calls** | Redeeming a proof needs no account, because the verifier is a bank or a court, not a Proofly user. |

---

## How it works

1. **Company registration** — a company registers and becomes its own administrator.
2. **Employee records** — the administrator adds employees by their Proofly principal.
3. **Proof generation** — an employee (current or former) mints a proof code, valid 24 hours.
4. **Verification** — any third party redeems the code and gets back the company, position and dates.
5. **Single use** — a redeemed code is spent, so a forwarded screenshot is worthless.

The plaintext code is returned exactly once and is never stored: the contract
keeps only its SHA-256 hash.

---

## Live deployment

| | |
| --- | --- |
| Network | Thebes testnet (`wan-experimental`, chain id 2026) |
| Backend contract | `85822817261869` |
| Frontend contract | `95417562499047` |
| Identity | Memphis, contract `921` |
| URL | <https://memphis.mercaturaforum.com/_/raw/95417562499047/index.html> |

The ids are declared in [`thebes.toml`](./thebes.toml), which is the single
source of truth for what is deployed and what the bundle was built against.

---

## Build & deploy

Proofly ships as two smart contracts — a Rust backend and an on-chain frontend —
described by a single manifest, `thebes.toml`.

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ and npm
- Rust with the `wasm32-unknown-unknown` target
  (`rustup target add wasm32-unknown-unknown`)
- [`thebes-deploy`](https://github.com/Mercatura-Forum/Thebes-Protocol-) — the
  Thebes CLI:

  ```bash
  curl -L https://github.com/Mercatura-Forum/Thebes-Protocol-/releases/download/v0.1.10-thebes-deploy/install-thebes-deploy.sh | bash
  thebes-deploy setup     # checks the local toolchain
  ```

There is **no local replica** — Thebes has no local-network mode, so the testnet
is the target for development and for release alike.

### Deploy

```bash
# 1. Clone
git clone https://github.com/Mercatura-Forum/thebes-example-proofly.git
cd thebes-example-proofly

# 2. A signing identity, once per machine. It becomes the controller of the
#    contracts it installs.
thebes-deploy identity new me

# 3. Build both contracts, install them, upload the frontend bundle, verify.
thebes-deploy deploy
```

`deploy` compiles the Rust contract, signs the install envelope, chunks the wasm
across the validator set, uploads `frontend/out/`, and verifies the result —
finalized by a Byzantine quorum and sealed into the chain's history.

Shipping a new version to the same ids, keeping state:

```bash
thebes-deploy upgrade backend
thebes-deploy upgrade frontend        # or `deploy frontend --skip-install` for a bundle-only push
```

If an asset upload dies partway through, re-run the bundle-only push — it is
idempotent, and re-running a full `deploy` risks a stuck upload id.

### Calling the contract directly

```bash
thebes-deploy query backend get_company_name --arg '("acme")'
thebes-deploy call  backend verify_proof     --arg '("k3Lp9mQx7n42")'
```

Every other method takes a Memphis session token, so it is exercised from the
app rather than the CLI.

### Working on the frontend

```bash
./scripts/dev-frontend.sh
```

This reads the contract ids out of `thebes.toml` and runs the dev server against
the live testnet. Use it rather than a bare `npm run dev`, which has no ids baked
in and would address contract `0`.

**Signing in does not work on localhost.** A WebAuthn credential is bound to a
relying-party id, and a page may only claim an RP id that is a suffix of its own
origin — so the Memphis passkey ceremony can only run when the app is served
from the gateway. Everything that does not need a session works locally.

A production bundle is built by `./scripts/build-frontend.sh`, which bakes in the
same ids plus the `/_/raw/<cid>/` base path. `thebes-deploy deploy` runs it for
you.

> **Assets and the base path.** The app is served under `/_/raw/<cid>/`, and
> Next.js does not apply that prefix to a `src` you write by hand. Every
> reference to a file in `public/` therefore goes through `asset()` in
> `frontend/src/lib/asset.ts`. Write a bare `/images/…` and it will 404 in
> production while working perfectly in `next dev`.

### The Candid codec

Candid is Thebes' wire format, and Proofly implements it itself in
`frontend/src/lib/thebes/candid.ts` — the app carries no third-party codec. It
covers exactly the slice the interface uses (`text`, `nat8`, `nat64`, `null`,
`vec`, `record`, `variant`) and throws on anything outside it rather than
guessing.

Because a codec checked only against itself proves nothing, the ground truth is
external: `frontend/scripts/candid-fixtures.json` holds byte vectors produced by
an independent reference implementation of the format. The check asserts
Proofly's codec reproduces them **byte for byte**, decodes them back to the same
values, and rejects six kinds of malformed input.

```bash
cd frontend && npm run check:codec
```

It runs automatically as part of `./scripts/build-frontend.sh`, so a codec
regression fails the build rather than reaching a user.

---

## Project structure

```

Proofly/
├── thebes.toml              # The deploy manifest: network, contracts, build commands, ids
├── .cargo/config.toml       # --export-table, required for the contract to instantiate
├── Cargo.toml               # Rust workspace
│
├── backend/                 # The Proofly smart contract (Rust → wasm)
│   ├── src/lib.rs           # Companies, employment records, proofs
│   ├── src/memphis.rs       # Memphis identity gate (session → per-app principal)
│   ├── src/thebes.rs        # Substrate primitives: contract addressing, chain randomness
│   ├── backend.did          # Candid interface, generated from the wasm
│   └── Cargo.toml
│
├── frontend/                # Next.js + TypeScript, served on-chain as certified assets
│   ├── src/app/             # Routes (public & authenticated pages)
│   ├── src/components/      # Reusable React UI components
│   ├── src/contexts/        # AuthContext — Memphis passkey sign-in
│   ├── src/lib/thebes/      # Chain layer: transport, Candid codec, Memphis (see its README)
│   ├── scripts/             # check-codec.mjs + the golden Candid vectors
│   ├── src/hooks/           # useThebesActor — the contract, bound to the live session
│   ├── src/lib/asset.ts     # public/ URLs, carrying the on-chain base path
│   ├── public/              # Static assets + the vendored Memphis runtimes
│   └── asset_canister.wasm  # The asset contract the bundle is installed into
│
├── scripts/build-frontend.sh  # Bakes the contract ids from thebes.toml into the bundle
├── README.md
└── LICENSE

```

---

## Architecture

### System architecture
<img width="1763" height="914" alt="system" src="https://github.com/user-attachments/assets/964fd7c3-0f50-4d14-a973-c0429c547773" />

### Memory relation map (stable memory)
<img width="1321" height="1031" alt="Data Map" src="https://github.com/user-attachments/assets/fc4929a4-e50c-45af-b366-686058bb5ff4" />

### Proof generation

```rust
┌─────────────────────────────────────────────────────────────┐
│  1. Employee Authentication (Memphis)                       │
│     • Client passes its origin-scoped Memphis session token │
│     • Contract calls Memphis 921 whoami_scoped_u(tok, aud)  │
│       → is it real, is it live, was it minted for US?       │
│     • derive_principal_for_u(anchor, "proofly", 1)          │
│       → the caller's stable per-app principal               │
│     • Access control: is_works_on(principal, company)       │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Random Code Generation (Cryptographically Secure)       │
│     • raw_rand() on the management contract (cid 0)         │
│       — seeded from the state root + height: deterministic  │
│       for the quorum, unpredictable to everyone else        │
│     • 61-character alphabet: [A-Za-z0-9] minus I and l      │
│     • One fresh random byte per character, never reused     │
│     • Entropy: 61^10 ≈ 713 trillion combinations            │
│     • No clock fallback: if randomness is unavailable the   │
│       call FAILS rather than issuing a guessable code       │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Proof ID Assignment                                     │
│     • Increment the counter — held in STABLE memory, so an  │
│       upgrade cannot restart it and overwrite live proofs   │
│     • Combine: proof_code = RANDOM_CODE + PROOF_ID          │
│     • Example: "k3Lp9mQx7n1234"                             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  4. SHA-256 Hashing                                         │
│     • Input: Full proof code (plaintext)                    │
│     • Algorithm: SHA-256 (NIST FIPS 180-4 standard)         │
│     • Output: 256-bit hash (64 hex characters)              │
│     • Properties: Collision-resistant, pre-image resistant  │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  5. On-Chain Storage                                        │
│     • Store the Proof record in PROOF_MAP                   │
│     • Fields:                                               │
│       - code: SHA-256 hash (NOT plaintext)                  │
│       - company_username: String                            │
│       - employee_id: the Memphis per-app principal          │
│       - position: String                                    │
│       - created_at: u64 (nanoseconds)                       │
│       - expires_at: created_at + 24 hours                   │
│       - is_used: false (initially)                          │
│     • Replicated across the validator set, sealed into the  │
│       chain's history, and carried across upgrades in       │
│       stable memory                                         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Return Plaintext Code                                   │
│     • Send proof_code to employee (ONE TIME ONLY)           │
│     • Never stored in plaintext anywhere                    │
│     • Employee responsible for secure storage               │
└─────────────────────────────────────────────────────────────┘
```

### Proof verification

```rust
┌─────────────────────────────────────────────────────────────┐
│  1. Parse Input Code                                        │
│     • Input: "k3Lp9mQx7n1234"                               │
│     • RANDOM_CODE: the first 10 characters                  │
│     • PROOF_ID: everything after → parse to u64             │
│     • No account needed: this endpoint is open on purpose,  │
│       because the verifier is a bank or a court             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Blockchain Lookup                                       │
│     • Query PROOF_MAP.get(PROOF_ID)                         │
│     • Returns Option<Proof>                                 │
│     • Error if not found: "Proof not found"                 │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Expiration Check                                        │
│     • Get the current block time                            │
│     • Compare: current_time > proof.expires_at              │
│     • Error if expired: "Proof expired"                     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Usage Check (Replay Attack Prevention)                  │
│     • Check: proof.is_used == true                          │
│     • Error if already used: "Proof already used"           │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Cryptographic Verification                              │
│     • Hash the FULL submitted code with SHA-256             │
│     • Compare against stored_proof.code                     │
│     • Constant-time comparison (no early exit on the first  │
│       differing byte)                                       │
│     • Error if mismatch: "Proof code mismatch"              │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Mark as Used & Return                                   │
│     • Set proof.is_used = true — single use, so a forwarded │
│       screenshot is worthless                               │
│     • Update PROOF_MAP, finalized by the validator quorum   │
│     • Return the company name, the employee name, the       │
│       position and the timestamp                            │
└─────────────────────────────────────────────────────────────┘
```

---

## What the contract enforces

- **A session is verified, never trusted.** Every user-scoped method hands its
  Memphis token to Memphis itself and keys state on the principal that comes
  back. The transport sender the browser generates is not an identity and
  nothing is keyed on it.
- **Codes are unguessable or absent.** If chain randomness is unavailable,
  generation *fails*. There is no fallback to the clock, which would make a code
  guessable by anyone who knows roughly when it was issued.
- **Hashes, not codes.** Only the SHA-256 of a proof code is stored. Redemption
  hashes the submitted code and compares in constant time.
- **Single use and time-bounded.** A redeemed proof is marked spent; an expired
  one is refused.
- **Only administrators write.** Adding or removing an employee, editing or
  deleting a company are all checked against the caller's principal.
- **Data minimization.** A company name, a position, a pseudonymous principal
  and timestamps. No personal record, no verification history, no profiling.

---

## Status and limitations

Proofly is a **proof of concept**. It is complete and it works, and these are
the things worth knowing before treating it as more than that:

- It runs on the **Thebes testnet**. Do not put real employment records in it.
- **Every authenticated read costs a consensus round.** Verifying a session is
  an inter-contract call, and a query cannot make one. That is the security, not
  an inefficiency to optimise away by moving the check client-side.
- **Sign-in requires the gateway origin** (the WebAuthn relying-party rule
  above), so the passkey flow cannot be exercised locally or headlessly.
- The **company logo** field in the UI is not backed by the contract, so the
  placeholder icon always shows.
- The pseudonym namespace (`"proofly"`) is **frozen for life**. Changing it
  rotates every user's principal and orphans their data.

---

## Resources

**Thebes**
- Protocol: [thebesprotocol.com](https://thebesprotocol.com/)
- Repository: [Mercatura-Forum/Thebes-Protocol-](https://github.com/Mercatura-Forum/Thebes-Protocol-)
- SDK: [Mercatura-Forum/thebes-sdk](https://github.com/Mercatura-Forum/thebes-sdk)

**This project**
- Repository: <https://github.com/Mercatura-Forum/thebes-example-proofly>
- Chain layer, documented on its own: [`frontend/src/lib/thebes/README.md`](./frontend/src/lib/thebes/README.md)

---

## License

MIT — see [LICENSE](./LICENSE).
