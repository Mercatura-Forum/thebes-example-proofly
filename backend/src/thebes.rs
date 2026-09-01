//! Thebes substrate primitives.
//!
//! Two addressing rules govern every cross-contract call on Thebes, and the
//! CDK's convenience helpers encode neither of them. Hence this module.
//!
//! 1. **Contracts are numbered, not textual.** The substrate addresses a
//!    contract by a `u64` id, and a cross-contract callee principal must be
//!    *exactly* the eight big-endian bytes of that id. Anything else is
//!    rejected by the engine with `invalid callee principal length`
//!    (`egypt-wasm/src/engine.rs`). `principal_of_cid` builds that principal so
//!    the rest of the contract never touches the encoding.
//!
//! 2. **The management contract is id 0.** The CDK's
//!    `ic_cdk::api::management_canister::*` helpers address the management
//!    contract with a zero-length principal, which this engine rejects — so
//!    `raw_rand` below is written out by hand rather than taken from the CDK.

use candid::Principal;

/// The virtual management contract. Not a wasm module — the engine routes
/// calls addressed to id 0 to its own implementation (`raw_rand`,
/// `sign_with_ecdsa`, canister lifecycle, …).
pub const MANAGEMENT_CID: u64 = 0;

/// The eight big-endian bytes of a Thebes contract id, as a `Principal`.
///
/// This is the only correct callee encoding on this substrate.
pub fn principal_of_cid(cid: u64) -> Principal {
    Principal::from_slice(&cid.to_be_bytes())
}

/// 32 bytes of chain randomness from the management contract.
///
/// The substrate derives the seed from the state root and block height, so the
/// value is deterministic for the validator set (every replica must agree) yet
/// unpredictable to anyone before the block is finalized. There is
/// deliberately **no fallback to the clock**:
/// a proof code seeded from `time()` would be guessable by anyone who knows
/// roughly when it was issued, and a guessable proof code defeats the entire
/// contract. If randomness is unavailable, issuing fails and the caller retries.
pub async fn raw_rand() -> Result<Vec<u8>, String> {
    let mgmt = principal_of_cid(MANAGEMENT_CID);
    match ic_cdk::call::<(), (Vec<u8>,)>(mgmt, "raw_rand", ()).await {
        Ok((bytes,)) => Ok(bytes),
        Err((code, msg)) => Err(format!("raw_rand unavailable ({code:?}): {msg}")),
    }
}
