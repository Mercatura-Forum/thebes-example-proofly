//! Proofly — employment-proof smart contract on the Thebes Protocol.
//!
//! A company registers on-chain, adds the people who work there, and each of
//! those people can mint a **single-use, 24-hour proof code** attesting to
//! their position. A third party — a bank, a landlord, a court, a recruiter —
//! redeems that code and gets the employer's name, the employee's name and the
//! position back, straight from the validator set. No email to HR, no letter on
//! headed paper, nothing anyone can forge.
//!
//! ## What is on-chain, and what is not
//!
//! Only the **SHA-256 hash** of a proof code is stored. The clear-text code
//! exists exactly once, in the reply to the employee who asked for it. A
//! validator operator reading raw state learns nothing that lets them mint or
//! redeem a proof.
//!
//! ## Identity
//!
//! Every record is keyed on a **Memphis** principal — the stable, per-app,
//! pseudonymous identity Thebes derives from a person's passkey anchor (see
//! [`memphis`]). It is *not* `ic_cdk::caller()`: on this substrate the transport
//! sender is browser-generated and unauthenticated, so it identifies nobody.
//! Every user-scoped endpoint therefore takes an origin-scoped `session` token
//! and is an `#[update]` — verification is an inter-contract call to Memphis,
//! and a query cannot make one.
//!
//! Two endpoints are deliberately open, because the people who use them are
//! not Proofly users:
//!
//! * [`verify_proof`] — whoever is checking the proof.
//! * [`get_company_name`] — a public directory read.

mod memphis;
mod thebes;

use std::borrow::Cow;
use std::cell::RefCell;

use candid::{CandidType, Decode, Deserialize, Encode};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable};
use sha2::{Digest, Sha256};

use memphis::Identity;

type Memory = VirtualMemory<DefaultMemoryImpl>;

/// Length of the random half of a proof code. The rest of the code is the
/// proof's id in decimal, which is how [`verify_proof`] finds the record
/// without a scan.
const PROOF_CODE_LEN: usize = 10;

/// A proof is redeemable for 24 hours.
const PROOF_TTL_NS: u64 = 24 * 60 * 60 * 1_000_000_000;

/// Input ceilings. They keep every map key inside its `Bound` and stop a single
/// caller from parking unbounded bytes in replicated state.
const MAX_USERNAME_LEN: usize = 64;
const MAX_NAME_LEN: usize = 128;
const MAX_POSITION_LEN: usize = 96;
const MAX_PRINCIPAL_LEN: usize = 128;

/// The single slot the proof-id counter lives in — a label, not data.
const COUNTER_KEY: u8 = 0;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    /// company username -> the people who work there
    static COMPANY_EMPLOYEES: RefCell<StableBTreeMap<StorableString, CompanyEmployeeList, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))))
    );

    /// employee principal -> the companies they work for
    static EMPLOYEE_COMPANIES: RefCell<StableBTreeMap<StorableString, IDList, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))))
    );

    /// admin principal -> the companies they administer
    static EMPLOYEE_COMPANIES_ADMIN: RefCell<StableBTreeMap<StorableString, IDList, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))))
    );

    /// company username -> the company record
    static COMPANY_MAP: RefCell<StableBTreeMap<StorableString, Company, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))))
    );

    /// employee principal -> their profile
    static EMPLOYEE_MAP: RefCell<StableBTreeMap<StorableString, Employee, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))))
    );

    /// proof id -> the hashed proof
    static PROOF_MAP: RefCell<StableBTreeMap<u64, Proof, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))))
    );

    /// The next proof id.
    ///
    /// This is in **stable** memory, not on the heap. A heap counter restarts
    /// at zero after every upgrade, and since the id is the map key, the first
    /// proof issued after an upgrade would overwrite proof 0 and every proof
    /// after it in turn — silent, and only visible as proofs that stopped
    /// verifying.
    static PROOF_COUNTER: RefCell<StableBTreeMap<u8, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))))
    );
}

// ── Stable storage plumbing ──────────────────────────────────────────────────

#[derive(CandidType, Deserialize, Clone, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub struct StorableString {
    pub value: String,
}

impl StorableString {
    fn new(value: impl Into<String>) -> Self {
        Self {
            value: value.into(),
        }
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CompanyEmployee {
    pub employee_id: String,
    pub position: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CompanyEmployeeWithName {
    pub employee_id: String,
    pub employee_name: String,
    pub position: String,
}

pub struct IDList {
    pub ids: Vec<String>,
}

pub struct CompanyEmployeeList {
    pub employees: Vec<CompanyEmployee>,
}

impl Storable for IDList {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(&self.ids).unwrap())
    }

    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self.ids).unwrap()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self {
            ids: Decode!(bytes.as_ref(), Vec<String>).unwrap(),
        }
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for CompanyEmployeeList {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(&self.employees).unwrap())
    }

    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self.employees).unwrap()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self {
            employees: Decode!(bytes.as_ref(), Vec<CompanyEmployee>).unwrap(),
        }
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for Company {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self).unwrap()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Company).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for Employee {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self).unwrap()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Employee).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for Proof {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self).unwrap()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Proof).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

impl Storable for StorableString {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(Encode!(&self.value).unwrap())
    }

    fn into_bytes(self) -> Vec<u8> {
        Encode!(&self.value).unwrap()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self {
            value: Decode!(bytes.as_ref(), String).unwrap(),
        }
    }

    // Keys must be bounded; every writer validates its input against the
    // ceilings above so nothing can ever exceed this.
    const BOUND: Bound = Bound::Bounded {
        max_size: 256,
        is_fixed_size: false,
    };
}

// ── Domain types ─────────────────────────────────────────────────────────────

#[derive(CandidType, Deserialize, Clone)]
struct Company {
    id: String,
    name: String,
    admin_id: String,
    created_at: u64,
    is_active: bool,
}

#[derive(CandidType, Deserialize, Clone)]
struct Employee {
    id: String,
    full_name: String,
}

#[derive(CandidType, Deserialize, Clone)]
struct Proof {
    /// SHA-256 of the clear-text code, hex. The code itself is never stored.
    code: String,
    company_username: String,
    employee_id: String,
    position: String,
    created_at: u64,
    expires_at: u64,
    is_used: bool,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ProofResult {
    pub company_username: String,
    pub company_name: String,
    pub employee_id: String,
    pub employee_name: String,
    pub position: String,
    pub created_at: u64,
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/// Touch every stable structure once, in an update context.
///
/// Load-bearing, not ceremony. A `StableBTreeMap` is created lazily on first
/// access, and creating it calls `ic0.stable64_grow` — which the WASM ABI
/// forbids in query mode. Without this, the first call on a freshly installed
/// contract traps if it happens to be a query (`get_company_name` on a page
/// load), with `ic0.stable64_grow: cannot be called from query mode`.
/// Initialising here means later queries only ever read.
fn touch_stable_structures() {
    COMPANY_EMPLOYEES.with(|m| {
        let _ = m.borrow().len();
    });
    EMPLOYEE_COMPANIES.with(|m| {
        let _ = m.borrow().len();
    });
    EMPLOYEE_COMPANIES_ADMIN.with(|m| {
        let _ = m.borrow().len();
    });
    COMPANY_MAP.with(|m| {
        let _ = m.borrow().len();
    });
    EMPLOYEE_MAP.with(|m| {
        let _ = m.borrow().len();
    });
    PROOF_MAP.with(|m| {
        let _ = m.borrow().len();
    });
    PROOF_COUNTER.with(|m| {
        let _ = m.borrow().len();
    });
}

#[ic_cdk::init]
fn init() {
    touch_stable_structures();
}

#[ic_cdk::post_upgrade]
fn post_upgrade() {
    touch_stable_structures();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Verify a Memphis session and hand back the caller's stable per-app identity.
///
/// Every gated endpoint starts here, and nothing it touches is read or written
/// before this returns — the `await` inside is a yield point, and interleaving
/// state access around one is how canisters grow reentrancy bugs.
async fn authenticate(session: &[u8]) -> Result<Identity, String> {
    memphis::verify(session).await.map_err(|e| e.message())
}

fn check_len(field: &str, value: &str, max: usize) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{field} cannot be empty"));
    }
    if value.len() > max {
        return Err(format!("{field} must be at most {max} characters"));
    }
    Ok(())
}

/// A cryptographically unguessable code of `length` characters.
///
/// Draws one fresh byte of chain randomness per character — never reusing a
/// byte and never widening a short buffer, so the code's entropy is the full
/// `length * log2(alphabet)` bits it appears to be.
async fn generate_random_code(length: usize) -> Result<String, String> {
    // No ambiguous glyphs: no uppercase I, no lowercase l. People read these
    // aloud and type them from a screenshot.
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";

    let mut out = String::with_capacity(length);
    let mut pool: Vec<u8> = Vec::new();

    while out.len() < length {
        if pool.is_empty() {
            pool = thebes::raw_rand().await?;
            if pool.is_empty() {
                return Err("raw_rand returned no bytes".into());
            }
        }
        let byte = pool.pop().unwrap();
        out.push(CHARS[byte as usize % CHARS.len()] as char);
    }

    Ok(out)
}

fn next_proof_id() -> u64 {
    PROOF_COUNTER.with(|c| {
        let mut c = c.borrow_mut();
        let id = c.get(&COUNTER_KEY).unwrap_or(0);
        c.insert(COUNTER_KEY, id + 1);
        id
    })
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

/// Compare two hashes without leaking where they first differ.
///
/// A timing side-channel here is not obviously exploitable — an attacker
/// supplies the pre-image, not the digest, so learning the stored hash byte by
/// byte buys them nothing they could invert. It is written this way anyway
/// because "not obviously exploitable" is a weak thing to rest a proof of
/// employment on, and the constant-time version costs nothing.
fn hashes_match(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn is_company_admin(admin_principal: &str, company_username: &str) -> bool {
    let admin_key = StorableString::new(admin_principal);
    EMPLOYEE_COMPANIES_ADMIN.with(|comp| {
        comp.borrow()
            .get(&admin_key)
            .is_some_and(|list| list.ids.iter().any(|id| id == company_username))
    })
}

fn is_works_on(user_id: &str, company_username: &str) -> bool {
    let user_key = StorableString::new(user_id);
    EMPLOYEE_COMPANIES.with(|comp| {
        comp.borrow()
            .get(&user_key)
            .is_some_and(|list| list.ids.iter().any(|id| id == company_username))
    })
}

fn get_employee_name_by_id(emp_id: &str) -> String {
    let key = StorableString::new(emp_id);
    EMPLOYEE_MAP.with(|emp_map| {
        emp_map
            .borrow()
            .get(&key)
            .map(|e| e.full_name)
            .unwrap_or_else(|| emp_id.to_string())
    })
}

// ── Profile ──────────────────────────────────────────────────────────────────

#[ic_cdk::update]
async fn set_full_name(session: Vec<u8>, full_name: String) -> Result<(), String> {
    check_len("Full name", &full_name, MAX_NAME_LEN)?;
    let me = authenticate(&session).await?;
    let user_id = me.id();
    let key = StorableString::new(&user_id);

    EMPLOYEE_MAP.with(|emp_map| {
        let mut map = emp_map.borrow_mut();
        let employee = match map.get(&key) {
            Some(mut existing) => {
                existing.full_name = full_name.clone();
                existing
            }
            None => Employee {
                id: user_id.clone(),
                full_name: full_name.clone(),
            },
        };
        map.insert(key.clone(), employee);
    });

    Ok(())
}

#[ic_cdk::update]
async fn get_my_name(session: Vec<u8>) -> Result<String, String> {
    let me = authenticate(&session).await?;
    let key = StorableString::new(me.id());

    EMPLOYEE_MAP.with(|emp_map| match emp_map.borrow().get(&key) {
        Some(employee) if !employee.full_name.trim().is_empty() => Ok(employee.full_name),
        _ => Err("Name not set".to_string()),
    })
}

/// This caller's stable Proofly principal — the id an administrator adds to a
/// company. It is the same for this person on every visit, and unlinkable to
/// their identity in any other Thebes app.
#[ic_cdk::update]
async fn get_principal(session: Vec<u8>) -> Result<String, String> {
    Ok(authenticate(&session).await?.id())
}

// ── Proofs ───────────────────────────────────────────────────────────────────

#[ic_cdk::update]
async fn generate_proof(session: Vec<u8>, company_username: String) -> Result<String, String> {
    check_len("Company username", &company_username, MAX_USERNAME_LEN)?;
    let me = authenticate(&session).await?;
    let user_id = me.id();

    if !is_works_on(&user_id, &company_username) {
        return Err("You do not work at this company".into());
    }

    let position = COMPANY_EMPLOYEES.with(|map| {
        map.borrow()
            .get(&StorableString::new(&company_username))
            .and_then(|list| {
                list.employees
                    .iter()
                    .find(|e| e.employee_id == user_id)
                    .map(|e| e.position.clone())
            })
            .unwrap_or_else(|| "Employee".to_string())
    });

    // Randomness comes from the chain, so this awaits. Nothing above is held
    // across it: `position` is an owned copy, and the state writes are below.
    let random_code = generate_random_code(PROOF_CODE_LEN).await?;

    let now = ic_cdk::api::time();
    let proof_id = next_proof_id();
    // Clear text: <random><id>. Only the hash is stored; this string is
    // returned once and never again.
    let proof_code = format!("{random_code}{proof_id}");

    let proof = Proof {
        code: sha256_hex(&proof_code),
        company_username,
        employee_id: user_id,
        position,
        created_at: now,
        expires_at: now + PROOF_TTL_NS,
        is_used: false,
    };

    PROOF_MAP.with(|p| {
        p.borrow_mut().insert(proof_id, proof);
    });

    Ok(proof_code)
}

/// Redeem a proof code. **Open on purpose** — the person checking a proof is a
/// bank or a court, not a Proofly user.
///
/// Single use: a redeemed code is spent, so a screenshot forwarded to someone
/// else is worthless.
#[ic_cdk::update]
fn verify_proof(proof_code: String) -> Result<ProofResult, String> {
    let proof_id: u64 = proof_code
        .get(PROOF_CODE_LEN..)
        .ok_or("Proof code too short")?
        .parse()
        .map_err(|_| "Invalid proof code".to_string())?;

    PROOF_MAP.with(|mp| {
        let mut map = mp.borrow_mut();
        let mut proof = map.get(&proof_id).ok_or("Proof not found")?;

        if proof.expires_at < ic_cdk::api::time() {
            return Err("Proof expired".to_string());
        }

        if !hashes_match(&sha256_hex(&proof_code), &proof.code) {
            return Err("Proof code mismatch".to_string());
        }

        if proof.is_used {
            return Err("Proof already used".to_string());
        }

        proof.is_used = true;
        map.insert(proof_id, proof.clone());

        let company_name = COMPANY_MAP.with(|comp_map| {
            comp_map
                .borrow()
                .get(&StorableString::new(&proof.company_username))
                .map(|c| c.name)
                .unwrap_or_else(|| proof.company_username.clone())
        });

        let employee_name = get_employee_name_by_id(&proof.employee_id);

        Ok(ProofResult {
            company_username: proof.company_username,
            company_name,
            employee_id: proof.employee_id,
            employee_name,
            position: proof.position,
            created_at: proof.created_at,
        })
    })
}

// ── Directory reads ──────────────────────────────────────────────────────────

#[ic_cdk::update]
async fn list_my_companies(session: Vec<u8>) -> Result<Vec<String>, String> {
    let me = authenticate(&session).await?;
    let key = StorableString::new(me.id());
    Ok(EMPLOYEE_COMPANIES.with(|map| {
        map.borrow()
            .get(&key)
            .map(|l| l.ids)
            .unwrap_or_default()
    }))
}

#[ic_cdk::update]
async fn list_my_admin_companies(session: Vec<u8>) -> Result<Vec<String>, String> {
    let me = authenticate(&session).await?;
    let key = StorableString::new(me.id());
    Ok(EMPLOYEE_COMPANIES_ADMIN.with(|map| {
        map.borrow()
            .get(&key)
            .map(|l| l.ids)
            .unwrap_or_default()
    }))
}

/// A company's display name. **Open on purpose** — a verifier reading a proof
/// needs to resolve the employer without holding an account.
#[ic_cdk::query]
fn get_company_name(comp_username: String) -> Result<String, String> {
    COMPANY_MAP.with(|map| {
        map.borrow()
            .get(&StorableString::new(&comp_username))
            .map(|c| c.name)
            .ok_or_else(|| "Company not found".to_string())
    })
}

#[ic_cdk::update]
async fn list_company_employess(
    session: Vec<u8>,
    comp_username: String,
) -> Result<Vec<CompanyEmployeeWithName>, String> {
    let me = authenticate(&session).await?;

    if !is_company_admin(&me.id(), &comp_username) {
        return Err("Only company admin can view employee list".into());
    }

    let comp_key = StorableString::new(&comp_username);

    Ok(COMPANY_EMPLOYEES.with(|map| {
        map.borrow()
            .get(&comp_key)
            .map(|emp_list| {
                emp_list
                    .employees
                    .iter()
                    .map(|e| CompanyEmployeeWithName {
                        employee_id: e.employee_id.clone(),
                        employee_name: get_employee_name_by_id(&e.employee_id),
                        position: e.position.clone(),
                    })
                    .collect()
            })
            // A company with no employees yet is not an error.
            .unwrap_or_default()
    }))
}

// ── Employment records ───────────────────────────────────────────────────────

#[ic_cdk::update]
async fn add_employee(
    session: Vec<u8>,
    comp_username: String,
    emp_id: String,
    position: String,
) -> Result<(), String> {
    check_len("Employee ID", &emp_id, MAX_PRINCIPAL_LEN)?;
    check_len("Position", &position, MAX_POSITION_LEN)?;
    let me = authenticate(&session).await?;

    if !is_company_admin(&me.id(), &comp_username) {
        return Err("Only company admin can add employees".into());
    }

    COMPANY_EMPLOYEES.with(|comp| {
        let mut map = comp.borrow_mut();
        let comp_key = StorableString::new(&comp_username);

        match map.get(&comp_key) {
            Some(mut emp_list) => {
                match emp_list
                    .employees
                    .iter_mut()
                    .find(|e| e.employee_id == emp_id)
                {
                    // Already on the books: update the position.
                    Some(existing) => existing.position = position.clone(),
                    None => emp_list.employees.push(CompanyEmployee {
                        employee_id: emp_id.clone(),
                        position: position.clone(),
                    }),
                }
                map.insert(comp_key, emp_list);
            }
            None => {
                map.insert(
                    comp_key,
                    CompanyEmployeeList {
                        employees: vec![CompanyEmployee {
                            employee_id: emp_id.clone(),
                            position: position.clone(),
                        }],
                    },
                );
            }
        }
    });

    EMPLOYEE_COMPANIES.with(|emp| {
        let mut map = emp.borrow_mut();
        let emp_key = StorableString::new(&emp_id);

        match map.get(&emp_key) {
            Some(mut comp_list) => {
                if !comp_list.ids.iter().any(|id| id == &comp_username) {
                    comp_list.ids.push(comp_username.clone());
                    map.insert(emp_key, comp_list);
                }
            }
            None => {
                map.insert(
                    emp_key,
                    IDList {
                        ids: vec![comp_username.clone()],
                    },
                );
            }
        }
    });

    Ok(())
}

#[ic_cdk::update]
async fn remove_employee(
    session: Vec<u8>,
    comp_username: String,
    emp_id: String,
) -> Result<(), String> {
    let me = authenticate(&session).await?;

    if !is_company_admin(&me.id(), &comp_username) {
        return Err("Only company admin can remove employees".into());
    }

    COMPANY_EMPLOYEES.with(|comp| {
        let mut map = comp.borrow_mut();
        let comp_key = StorableString::new(&comp_username);

        match map.get(&comp_key) {
            Some(mut emp_list) => match emp_list.employees.iter().position(|e| e.employee_id == emp_id) {
                Some(pos) => {
                    emp_list.employees.remove(pos);
                    map.insert(comp_key, emp_list);
                    Ok(())
                }
                None => Err("Employee not found in this company".to_string()),
            },
            None => Err("Company not found".to_string()),
        }
    })?;

    EMPLOYEE_COMPANIES.with(|emp| {
        let mut map = emp.borrow_mut();
        let emp_key = StorableString::new(&emp_id);

        if let Some(mut comp_list) = map.get(&emp_key) {
            comp_list.ids.retain(|id| id != &comp_username);
            map.insert(emp_key, comp_list);
        }
    });

    Ok(())
}

// ── Companies ────────────────────────────────────────────────────────────────

#[ic_cdk::update]
async fn add_new_companey(
    session: Vec<u8>,
    comp_username: String,
    comp_name: String,
) -> Result<(), String> {
    check_len("Company username", &comp_username, MAX_USERNAME_LEN)?;
    check_len("Company name", &comp_name, MAX_NAME_LEN)?;
    let me = authenticate(&session).await?;

    let storable_comp_username = StorableString::new(&comp_username);

    let exists = COMPANY_MAP.with(|mp| mp.borrow().contains_key(&storable_comp_username));
    if exists {
        return Err("Username already exists".into());
    }

    let admin = me.id();

    let comp = Company {
        id: comp_username.clone(),
        name: comp_name,
        admin_id: admin.clone(),
        created_at: ic_cdk::api::time(),
        is_active: true,
    };

    COMPANY_MAP.with(|mp| {
        mp.borrow_mut().insert(storable_comp_username, comp);
    });

    let storable_admin = StorableString::new(&admin);

    EMPLOYEE_COMPANIES_ADMIN.with(|map| {
        let mut map = map.borrow_mut();
        match map.get(&storable_admin) {
            Some(mut id_list) => {
                id_list.ids.push(comp_username.clone());
                map.insert(storable_admin, id_list);
            }
            None => {
                map.insert(
                    storable_admin,
                    IDList {
                        ids: vec![comp_username.clone()],
                    },
                );
            }
        }
    });

    Ok(())
}

#[ic_cdk::update]
async fn edit_company(
    session: Vec<u8>,
    comp_username: String,
    new_comp_name: String,
) -> Result<(), String> {
    check_len("Company name", &new_comp_name, MAX_NAME_LEN)?;
    let me = authenticate(&session).await?;

    let storable_comp_username = StorableString::new(&comp_username);

    COMPANY_MAP.with(|mp| {
        let mut map = mp.borrow_mut();
        match map.get(&storable_comp_username) {
            Some(mut company) => {
                if company.admin_id != me.id() {
                    return Err("Only company admin can edit company details".to_string());
                }
                company.name = new_comp_name;
                map.insert(storable_comp_username, company);
                Ok(())
            }
            None => Err("Company not found".to_string()),
        }
    })
}

#[ic_cdk::update]
async fn delete_company(session: Vec<u8>, comp_username: String) -> Result<(), String> {
    let me = authenticate(&session).await?;
    let storable_comp_username = StorableString::new(&comp_username);

    let admin_id = COMPANY_MAP.with(|mp| match mp.borrow().get(&storable_comp_username) {
        Some(company) => {
            if company.admin_id != me.id() {
                return Err("Only company admin can delete company".to_string());
            }
            Ok(company.admin_id)
        }
        None => Err("Company not found".to_string()),
    })?;

    COMPANY_MAP.with(|mp| {
        mp.borrow_mut().remove(&storable_comp_username);
    });

    let storable_admin = StorableString::new(&admin_id);
    EMPLOYEE_COMPANIES_ADMIN.with(|map| {
        let mut map = map.borrow_mut();
        if let Some(mut id_list) = map.get(&storable_admin) {
            id_list.ids.retain(|id| id != &comp_username);
            if id_list.ids.is_empty() {
                map.remove(&storable_admin);
            } else {
                map.insert(storable_admin, id_list);
            }
        }
    });

    let employee_ids = COMPANY_EMPLOYEES.with(|map| {
        map.borrow()
            .get(&storable_comp_username)
            .map(|list| {
                list.employees
                    .iter()
                    .map(|e| e.employee_id.clone())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default()
    });

    COMPANY_EMPLOYEES.with(|map| {
        map.borrow_mut().remove(&storable_comp_username);
    });

    for emp_id in employee_ids {
        EMPLOYEE_COMPANIES.with(|map| {
            let mut map = map.borrow_mut();
            let emp_key = StorableString::new(&emp_id);

            if let Some(mut comp_list) = map.get(&emp_key) {
                comp_list.ids.retain(|id| id != &comp_username);
                if comp_list.ids.is_empty() {
                    map.remove(&emp_key);
                } else {
                    map.insert(emp_key, comp_list);
                }
            }
        });
    }

    Ok(())
}

// ── Session hygiene ──────────────────────────────────────────────────────────

/// Drop this contract's cached view of a session on sign-out.
///
/// Local only: `end_session` on Memphis is caller-scoped, so ending the
/// person's actual Memphis session is the browser's to do, not ours.
#[ic_cdk::update]
fn memphis_sign_out(session: Vec<u8>) {
    memphis::forget(&session);
    memphis::evict_expired(ic_cdk::api::time());
}

ic_cdk::export_candid!();
