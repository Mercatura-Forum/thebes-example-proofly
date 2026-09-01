/**
 * TypeScript types for Proofly's contract on Thebes.
 *
 * `CompanyEmployeeWithName`, `ProofResult` and `Result` mirror the contract's
 * Candid interface (`backend/backend.did`) — keep them in step with
 * `lib/thebes/idl.ts`, which is the codec's view of the same types.
 *
 * `Company` and `Employee` are the UI's own view-models, assembled from several
 * contract reads. They are not wire types and have no `.did` counterpart.
 */

// ── Wire types: these mirror backend.did ─────────────────────────────────────

/** `variant { Ok : T; Err : text }` as the codec decodes it. */
export type Result<T> = { Ok: T } | { Err: string };

/** One row of a company's roster, with the employee's name resolved. */
export interface CompanyEmployeeWithName {
    employee_id: string;
    employee_name: string;
    position: string;
}

/** What redeeming a proof code returns. `created_at` is chain nanoseconds. */
export interface ProofResult {
    company_username: string;
    company_name: string;
    employee_id: string;
    employee_name: string;
    position: string;
    created_at: bigint;
}

// ── View models: assembled in the UI, not returned by any single call ───────

export interface Employee {
    /** The employee's Memphis per-app principal. */
    id: string;
    name: string;
    position: string;
}

export interface Company {
    id: number;
    username: string;
    name: string;
    image?: string;
    employees: Employee[];
}

/** Convenience alias for the roster read. */
export type CompanyEmployeesResult = Result<CompanyEmployeeWithName[]>;
