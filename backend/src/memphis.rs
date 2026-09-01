//! Memphis — Thebes' identity contract (cid 921), bound from Rust.
//!
//! This is the Rust counterpart of `MemphisAuth.mo` in `thebes-lib`. The Motoko
//! library is the reference implementation; this file follows it step for step
//! so both halves of the platform behave identically.
//!
//! ─────────────────────────────────────────────────────────────────────────────
//! THREE IDENTIFIERS, AND WHY CONFUSING TWO OF THEM BREAKS THINGS
//! ─────────────────────────────────────────────────────────────────────────────
//!
//! * `ic_cdk::caller()` — the **transport sender**. On this substrate the
//!   browser client generates its own sender bytes and the boundary accepts an
//!   unsigned envelope, so it is *not* a person and *not* authenticated. Never
//!   key user data on it. Proofly does not use it at all.
//!
//! * [`NAMESPACE`] — the **pseudonym namespace**. An arbitrary stable label fed
//!   to `derive_principal_for_u`. It decides every user's principal, so
//!   changing it on a live deployment rotates every principal and orphans every
//!   company, employment record and proof. It is frozen for the life of the app.
//!
//! * [`AUDIENCE`] — the **web origin this app is served from**. Memphis compares
//!   it byte-for-byte against the origin the token was minted for, so a
//!   trailing slash, a different port or a case difference is a mismatch.
//!   Changing it is harmless: it only says where tokens are accepted from.
//!
//! `NAMESPACE` and `AUDIENCE` are deliberately different strings. Presenting the
//! namespace as the audience returns `Unauthorized` on every call; "fixing"
//! that by setting the namespace to the URL orphans every account.
//!
//! ─────────────────────────────────────────────────────────────────────────────
//! THE FLOW
//! ─────────────────────────────────────────────────────────────────────────────
//!
//! 1. The browser signs in at the Memphis origin (passkey/WebAuthn) and
//!    exchanges the resulting master session for a token minted **for this
//!    app's origin only**. The master token never reaches this contract — a
//!    holder of one would be that user at every other Thebes app.
//! 2. The browser passes the origin-scoped token to us as an ordinary argument.
//! 3. We call `whoami_scoped_u(token, AUDIENCE)`: is the token real, is it
//!    live, and was it minted for *us*? On success we learn the anchor id.
//! 4. We call `derive_principal_for_u(anchor_id, NAMESPACE, VERSION)` for the
//!    user's stable, per-app, pseudonymous principal, and key state on that.
//!
//! Verification **must** be an inter-contract call: only Memphis can attest
//! that a token is live, and there is no local secret that could check one
//! offline.
//!
//! ⚠️ Both methods are bound to the `_u` (**update**) forms. Memphis exports
//! each of them twice — a cheap `query` for the browser and an identical `_u`
//! update for contracts. A contract-to-contract call on a `query` export gets
//! no reply on this substrate and fails as
//! `method 'canister_update <name>' not found`. Probing the query form over the
//! boundary's `POST /api/query` succeeds, which is exactly what makes a wrong
//! binding look correct.
//!
//! ⚠️ Because verification is an inter-contract call, **every gated endpoint
//! must be an `#[update]`**. Queries cannot make inter-contract calls, so a
//! gated `#[query]` cannot exist.

use std::cell::RefCell;
use std::collections::HashMap;

use candid::{CandidType, Principal};
use serde::Deserialize;

use crate::thebes::principal_of_cid;

/// The Memphis identity contract.
pub const MEMPHIS_CID: u64 = 921;

/// Pseudonym namespace — **frozen**. See the module header.
///
/// Every Proofly principal is `derive_principal_for(anchor, NAMESPACE, VERSION)`.
/// Change this string and every existing user becomes a stranger to their own
/// companies and employment records.
pub const NAMESPACE: &str = "proofly";

/// Pseudonym scheme version. Bumped only for a deliberate identity-scheme
/// break, which is itself a migration.
pub const VERSION: u64 = 1;

/// The web origin Proofly is served from.
///
/// A `thebes-deploy` frontend is served by the boundary at
/// `https://memphis.mercaturaforum.com/_/raw/<cid>/…`, so that is the origin the
/// browser claims and the origin Memphis mints tokens for. Moving Proofly to
/// its own domain is this line, and only this line.
pub const AUDIENCE: &str = "https://memphis.mercaturaforum.com";

// ── The Memphis IDL, mirrored from memphis.did ───────────────────────────────

/// Mirror of `memphis.did` `MemphisError`.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum MemphisError {
    NotAuthenticated,
    Unauthorized,
    SessionExpired,
    ChallengeExpired,
    AnchorNotFound,
    FactorNotFound,
    InsufficientFactors,
    DuplicateCredential,
    InvalidArgument(String),
    InvariantViolation(InvariantViolation),
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct InvariantViolation {
    pub id: String,
    pub details: String,
}

/// Mirror of `memphis.did` `WhoAmIResult`.
///
/// `anchor_id` is the 32-byte anchor id **hash**, never the raw anchor.
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct WhoAmIResult {
    pub anchor_id: Vec<u8>,
    pub session_expires_ns: u64,
    pub display_tag: String,
}

// ── What a successful verification yields ────────────────────────────────────

/// A verified Memphis identity.
///
/// `principal` is the stable per-app principal — the key every Proofly record
/// is stored under.
#[derive(Clone, Debug)]
pub struct Identity {
    pub principal: Principal,
    /// The Memphis anchor id hash this principal was derived from. Proofly keys
    /// nothing on it — the per-app principal is the key — but it is the handle
    /// a support or audit path needs to tie a record back to one Memphis
    /// account, so it travels with the identity rather than being thrown away.
    #[allow(dead_code)]
    pub anchor_id: Vec<u8>,
    pub expires_ns: u64,
}

impl Identity {
    /// The textual principal, which is how Proofly stores user ids.
    pub fn id(&self) -> String {
        self.principal.to_text()
    }
}

/// Why verification failed.
#[derive(Clone, Debug)]
pub enum AuthError {
    /// The session is past its expiry.
    Expired,
    /// Memphis rejected the token, and said why.
    Memphis(MemphisError),
    /// The call to Memphis itself did not complete.
    Call(String),
}

impl AuthError {
    /// A message safe and useful to show a person.
    ///
    /// `Unauthorized` gets its own sentence on purpose: it is the single most
    /// common misconfiguration, and "signed in for another site" is actionable
    /// where "auth failed" is not.
    pub fn message(&self) -> String {
        match self {
            AuthError::Expired => "Your sign-in has expired — please sign in again.".into(),
            AuthError::Memphis(MemphisError::Unauthorized) => {
                "That sign-in was issued for another site. Sign in again here.".into()
            }
            AuthError::Memphis(MemphisError::SessionExpired) => {
                "Your sign-in has expired — please sign in again.".into()
            }
            AuthError::Memphis(MemphisError::NotAuthenticated) => {
                "You are not signed in.".into()
            }
            AuthError::Memphis(MemphisError::AnchorNotFound) => {
                "That Memphis identity no longer exists.".into()
            }
            AuthError::Memphis(e) => format!("Memphis rejected the session ({e:?})."),
            AuthError::Call(msg) => format!("Could not reach the identity contract: {msg}"),
        }
    }
}

// ── The token → identity cache ───────────────────────────────────────────────
//
// A cache miss costs two inter-contract calls; a hit costs none. It lives on
// the heap on purpose: it is derived data, and losing it on upgrade re-derives
// it on the next call. Nothing here is authoritative — Memphis is.

thread_local! {
    static CACHE: RefCell<HashMap<Vec<u8>, Identity>> = RefCell::new(HashMap::new());
}

fn cached_fresh(token: &[u8], now_ns: u64) -> Option<Identity> {
    CACHE.with(|c| {
        let mut c = c.borrow_mut();
        match c.get(token) {
            Some(id) if id.expires_ns > now_ns => Some(id.clone()),
            // A stale entry is evicted on access so it cannot be reused.
            Some(_) => {
                c.remove(token);
                None
            }
            None => None,
        }
    })
}

/// Forget a cached token — call this on sign-out.
///
/// This drops the local cache entry only. Ending the Memphis session itself is
/// the client's to do: `end_session` is caller-scoped on Memphis, so this
/// contract cannot do it on the user's behalf, and that is the right boundary.
pub fn forget(token: &[u8]) {
    CACHE.with(|c| {
        c.borrow_mut().remove(token);
    });
}

/// Drop every cached entry whose session has already passed. Optional hygiene —
/// correctness does not depend on it, because `verify` evicts on access.
pub fn evict_expired(now_ns: u64) {
    CACHE.with(|c| c.borrow_mut().retain(|_, id| id.expires_ns > now_ns));
}

// ── Verification ─────────────────────────────────────────────────────────────

/// Verify an origin-scoped session token and resolve it to this app's stable
/// principal for that user.
///
/// Two inter-contract calls on a cache miss, none on a hit.
///
/// Everything the caller mutates must happen **after** this returns: an
/// `await` is a yield point, and reading state before it and writing after it
/// is how canisters grow reentrancy bugs.
pub async fn verify(token: &[u8]) -> Result<Identity, AuthError> {
    verify_with_audience(token, AUDIENCE).await
}

/// As [`verify`], with the audience spelled out.
///
/// The audience is an argument rather than stored configuration on purpose:
/// it is compile-time config that never needs to survive an upgrade.
pub async fn verify_with_audience(token: &[u8], audience: &str) -> Result<Identity, AuthError> {
    if token.is_empty() {
        return Err(AuthError::Memphis(MemphisError::NotAuthenticated));
    }

    let now_ns = ic_cdk::api::time();
    if let Some(id) = cached_fresh(token, now_ns) {
        return Ok(id);
    }

    let memphis = principal_of_cid(MEMPHIS_CID);

    // Step 1 — whose token is this, is it live, and was it minted for US?
    // Passing the audience is what makes a token unusable anywhere else.
    let who: WhoAmIResult = match ic_cdk::call::<
        (Vec<u8>, String),
        (Result<WhoAmIResult, MemphisError>,),
    >(
        memphis,
        "whoami_scoped_u",
        (token.to_vec(), audience.to_string()),
    )
    .await
    {
        Ok((Ok(w),)) => w,
        Ok((Err(e),)) => return Err(AuthError::Memphis(e)),
        Err((code, msg)) => return Err(AuthError::Call(format!("{code:?}: {msg}"))),
    };

    // Defensive: Memphis enforces this already, but a locally re-checked expiry
    // closes any clock-skew or replay window between the two calls.
    if who.session_expires_ns <= now_ns {
        return Err(AuthError::Expired);
    }

    // Step 2 — the user's stable principal for THIS app. Note NAMESPACE, not
    // the audience: mixing the two rotates every principal.
    let principal_bytes: Vec<u8> = match ic_cdk::call::<
        (Vec<u8>, String, u64),
        (Result<Vec<u8>, MemphisError>,),
    >(
        memphis,
        "derive_principal_for_u",
        (who.anchor_id.clone(), NAMESPACE.to_string(), VERSION),
    )
    .await
    {
        Ok((Ok(b),)) => b,
        Ok((Err(e),)) => return Err(AuthError::Memphis(e)),
        Err((code, msg)) => return Err(AuthError::Call(format!("{code:?}: {msg}"))),
    };

    let principal = Principal::try_from_slice(&principal_bytes)
        .map_err(|e| AuthError::Call(format!("Memphis returned a malformed principal: {e}")))?;

    let identity = Identity {
        principal,
        anchor_id: who.anchor_id,
        expires_ns: who.session_expires_ns,
    };

    CACHE.with(|c| {
        c.borrow_mut().insert(token.to_vec(), identity.clone());
    });

    Ok(identity)
}
