/**
 * The Proofly contract, as an object you can call methods on.
 *
 * This is the seam the pages talk to. Its method names, arguments and return
 * shapes are exactly what they were before Proofly moved to Thebes, so no page
 * had to learn anything about the substrate — the two things that changed live
 * entirely in here:
 *
 * * **The Memphis session travels as an argument.** Every user-scoped method
 *   takes an origin-scoped session token as its first wire argument. The shim
 *   prepends it, so a page still writes `actor.generate_proof(company)`.
 *
 * * **Reads that used to be queries are now updates.** Verifying a session is
 *   an inter-contract call to Memphis, and a query cannot make one. That is a
 *   consensus round rather than a local read — invisible at this level, but the
 *   reason a company list takes a moment longer than it used to.
 *
 * `list_my_companies`, `list_my_admin_companies` and `get_principal` return
 * `Result` on the wire and a bare value here: the shim throws on `Err`, which
 * is what the pages already catch. Everything else hands back the `{ Ok }` /
 * `{ Err }` variant untouched.
 */
import { IDL } from './candid';

import type {
    CompanyEmployeeWithName,
    ProofResult,
    Result,
} from '@/types/backend';
import { call, query } from './boundary';
import { BACKEND_CID } from './config';
import { METHODS, type MethodSpec } from './idl';
import { ensureSession, tokenBytes, type MemphisSession } from './memphis';

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
    const clean = hex.length % 2 ? `0${hex}` : hex;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

/** A `variant { Ok; Err : text }` as the pages see it. */
type Variant = { Ok: unknown } | { Err: string };

function isVariant(v: unknown): v is Variant {
    return typeof v === 'object' && v !== null && ('Ok' in v || 'Err' in v);
}

/** Unwrap a `Result`, turning `Err` into a thrown error the page already catches. */
function unwrap(value: unknown, method: string): unknown {
    if (isVariant(value)) {
        if ('Ok' in value) return value.Ok;
        throw new Error(value.Err || `${method} failed`);
    }
    return value;
}

async function invoke(
    method: string,
    spec: MethodSpec,
    args: unknown[],
    session: MemphisSession | null
): Promise<unknown> {
    let live = session;

    if (spec.session) {
        if (!session?.token) {
            // Fail here rather than burning a consensus round on a call the
            // contract is certain to refuse.
            throw new Error('You are not signed in.');
        }
        // The bound token may have lapsed since this handle was built — a tab
        // left open crosses the 30-minute access-token line without any
        // interaction. Renew silently rather than failing the person's action.
        live = await ensureSession(session);
        if (!live?.token) {
            throw new Error('Your sign-in has expired — please sign in again.');
        }
    }

    const wireArgs = spec.session ? [tokenBytes(live), ...args] : args;

    if (wireArgs.length !== spec.args.length) {
        throw new Error(
            `${method} takes ${spec.args.length - (spec.session ? 1 : 0)} argument(s), got ${args.length}`
        );
    }

    const argHex = toHex(IDL.encode(spec.args, wireArgs));

    const replyHex =
        spec.kind === 'query'
            ? await query(BACKEND_CID, method, argHex)
            : await call(BACKEND_CID, method, argHex);

    if (spec.ret.length === 0) return undefined;

    const decoded = IDL.decode(spec.ret, fromHex(replyHex));
    return decoded[0];
}

/** Methods whose `Result` the shim unwraps, so pages keep their old shapes. */
const UNWRAPPED = new Set(['list_my_companies', 'list_my_admin_companies', 'get_principal']);

/**
 * Proofly's contract, as the pages call it.
 *
 * Every signature here is what it was before the move to Thebes: the session
 * token is prepended by the shim, and the three methods that hand back a bare
 * value have their `Result` unwrapped for them.
 */
export interface ProoflyActor {
    // ── Profile ──
    set_full_name(full_name: string): Promise<Result<null>>;
    get_my_name(): Promise<Result<string>>;
    /** This caller's stable Proofly principal. Throws when not signed in. */
    get_principal(): Promise<string>;

    // ── Proofs ──
    generate_proof(company_username: string): Promise<Result<string>>;
    verify_proof(proof_code: string): Promise<Result<ProofResult>>;

    // ── Directory ──
    list_my_companies(): Promise<string[]>;
    list_my_admin_companies(): Promise<string[]>;
    get_company_name(comp_username: string): Promise<Result<string>>;
    list_company_employess(
        comp_username: string
    ): Promise<Result<CompanyEmployeeWithName[]>>;

    // ── Employment records ──
    add_employee(
        comp_username: string,
        emp_id: string,
        position: string
    ): Promise<Result<null>>;
    remove_employee(comp_username: string, emp_id: string): Promise<Result<null>>;

    // ── Companies ──
    add_new_companey(comp_username: string, comp_name: string): Promise<Result<null>>;
    edit_company(comp_username: string, new_comp_name: string): Promise<Result<null>>;
    delete_company(comp_username: string): Promise<Result<null>>;

    // ── Session hygiene ──
    memphis_sign_out(): Promise<void>;
}

/**
 * Build a contract handle bound to one Memphis session.
 *
 * Cheap — it allocates closures, nothing more — so rebuilding it whenever the
 * session changes is the right thing to do, and is what `useThebesActor` does.
 */
export function createActor(session: MemphisSession | null): ProoflyActor {
    const actor: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

    for (const [method, spec] of Object.entries(METHODS)) {
        actor[method] = async (...args: unknown[]) => {
            const result = await invoke(method, spec, args, session);
            return UNWRAPPED.has(method) ? unwrap(result, method) : result;
        };
    }

    // The table above is built from METHODS, which is itself the mirror of
    // backend.did — so the cast asserts exactly what `idl.ts` already declares.
    return actor as unknown as ProoflyActor;
}
