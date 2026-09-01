/**
 * Proofly's Candid interface, mirrored from `backend/backend.did`.
 *
 * Thebes speaks Candid on the wire, so this is a straight transcription of the
 * `.did` the contract's own wasm generates. Keep the two in step: after
 * changing the contract, regenerate the interface
 *
 *   candid-extractor target/wasm32-unknown-unknown/release/backend.wasm \
 *     > backend/backend.did
 *
 * and mirror the diff here. The codec is Proofly's own (`./candid`) — Candid is
 * Thebes' wire format, and this app carries no external implementation of it.
 *
 * ── The `session` argument ──────────────────────────────────────────────────
 *
 * Every method that acts on behalf of a person takes an origin-scoped Memphis
 * session token as its first argument, and is an **update** even where a query
 * would read more cheaply: verifying that token is an inter-contract call to
 * Memphis, and a query cannot make one.
 *
 * `verify_proof` and `get_company_name` take no session on purpose — the person
 * redeeming a proof is a bank or a court, not a Proofly account holder.
 */
import { IDL, type CandidType } from './candid';

/** An origin-scoped Memphis session token: `blob`. */
export const Session = IDL.Vec(IDL.Nat8);

export const CompanyEmployeeWithName = IDL.Record({
    employee_name: IDL.Text,
    position: IDL.Text,
    employee_id: IDL.Text,
});

export const ProofResult = IDL.Record({
    employee_name: IDL.Text,
    company_name: IDL.Text,
    created_at: IDL.Nat64,
    company_username: IDL.Text,
    position: IDL.Text,
    employee_id: IDL.Text,
});

const ResultUnit = IDL.Variant({ Ok: IDL.Null, Err: IDL.Text });
const ResultText = IDL.Variant({ Ok: IDL.Text, Err: IDL.Text });
const ResultEmployees = IDL.Variant({
    Ok: IDL.Vec(CompanyEmployeeWithName),
    Err: IDL.Text,
});
const ResultTextVec = IDL.Variant({ Ok: IDL.Vec(IDL.Text), Err: IDL.Text });
const ResultProof = IDL.Variant({ Ok: ProofResult, Err: IDL.Text });

/** How a method reaches the chain, and how its arguments and reply are shaped. */
export interface MethodSpec {
    kind: 'query' | 'update';
    /** Argument types, in wire order. */
    args: CandidType[];
    /** Reply types, in wire order. */
    ret: CandidType[];
    /** True when the shim prepends the caller's Memphis session token. */
    session: boolean;
}

export const METHODS: Record<string, MethodSpec> = {
    // ── Profile ──
    set_full_name: { kind: 'update', session: true, args: [Session, IDL.Text], ret: [ResultUnit] },
    get_my_name: { kind: 'update', session: true, args: [Session], ret: [ResultText] },
    get_principal: { kind: 'update', session: true, args: [Session], ret: [ResultText] },

    // ── Proofs ──
    generate_proof: { kind: 'update', session: true, args: [Session, IDL.Text], ret: [ResultText] },
    verify_proof: { kind: 'update', session: false, args: [IDL.Text], ret: [ResultProof] },

    // ── Directory ──
    list_my_companies: { kind: 'update', session: true, args: [Session], ret: [ResultTextVec] },
    list_my_admin_companies: { kind: 'update', session: true, args: [Session], ret: [ResultTextVec] },
    get_company_name: { kind: 'query', session: false, args: [IDL.Text], ret: [ResultText] },
    list_company_employess: {
        kind: 'update',
        session: true,
        args: [Session, IDL.Text],
        ret: [ResultEmployees],
    },

    // ── Employment records ──
    add_employee: {
        kind: 'update',
        session: true,
        args: [Session, IDL.Text, IDL.Text, IDL.Text],
        ret: [ResultUnit],
    },
    remove_employee: {
        kind: 'update',
        session: true,
        args: [Session, IDL.Text, IDL.Text],
        ret: [ResultUnit],
    },

    // ── Companies ──
    add_new_companey: {
        kind: 'update',
        session: true,
        args: [Session, IDL.Text, IDL.Text],
        ret: [ResultUnit],
    },
    edit_company: {
        kind: 'update',
        session: true,
        args: [Session, IDL.Text, IDL.Text],
        ret: [ResultUnit],
    },
    delete_company: { kind: 'update', session: true, args: [Session, IDL.Text], ret: [ResultUnit] },

    // ── Session hygiene ──
    memphis_sign_out: { kind: 'update', session: true, args: [Session], ret: [] },
};

export type MethodName = keyof typeof METHODS;
