// Check Proofly's Candid codec against golden vectors.
//
//   cd frontend && npm run check:codec
//
// `src/lib/thebes/candid.ts` is Proofly's own Candid implementation — the app
// carries no external codec (see the header of that file for why). A codec you
// wrote yourself, checked only against itself, proves nothing: it would agree
// with its own mistakes.
//
// So the ground truth is external. `scripts/candid-fixtures.json` holds byte
// vectors produced by the reference implementation of Candid for every method
// in `backend/backend.did`, in both variant arms, plus an empty vector, an
// empty string and non-ASCII text. They were generated once, from an
// implementation this codec shares no code with, and committed. This script
// asserts, for every one of them:
//
//   1. ENCODE  — our bytes are identical to the reference's, byte for byte.
//   2. DECODE  — the reference's bytes decode back to the expected values.
//   3. REJECT  — corrupted and truncated input throws rather than returning
//                a plausible wrong answer.
//
// The fixtures are the authority for the *encoding*. `backend/backend.did`,
// generated from the contract's own wasm, remains the authority for the
// *interface*: regenerate it after changing the contract and mirror any diff
// into `src/lib/thebes/idl.ts`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { IDL } from '../src/lib/thebes/candid.ts';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(here, 'candid-fixtures.json'), 'utf8'));

const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g)?.map((x) => parseInt(x, 16)) ?? []);

// The interface, mirrored from src/lib/thebes/idl.ts.
const Session = IDL.Vec(IDL.Nat8);
const CompanyEmployeeWithName = IDL.Record({
    employee_name: IDL.Text,
    position: IDL.Text,
    employee_id: IDL.Text,
});
const ProofResult = IDL.Record({
    employee_name: IDL.Text,
    company_name: IDL.Text,
    created_at: IDL.Nat64,
    company_username: IDL.Text,
    position: IDL.Text,
    employee_id: IDL.Text,
});
const RET = {
    ResultUnit: IDL.Variant({ Ok: IDL.Null, Err: IDL.Text }),
    ResultText: IDL.Variant({ Ok: IDL.Text, Err: IDL.Text }),
    ResultEmployees: IDL.Variant({ Ok: IDL.Vec(CompanyEmployeeWithName), Err: IDL.Text }),
    ResultTextVec: IDL.Variant({ Ok: IDL.Vec(IDL.Text), Err: IDL.Text }),
    ResultProof: IDL.Variant({ Ok: ProofResult, Err: IDL.Text }),
};
const ARG = { blob: Session, text: IDL.Text };

/** Fixture JSON marks the two types JSON cannot hold natively. */
function reviveValue(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(reviveValue);
    if (typeof v.blob === 'string' && Object.keys(v).length === 1) return unhex(v.blob);
    if (typeof v.nat64 === 'string' && Object.keys(v).length === 1) return BigInt(v.nat64);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, reviveValue(x)]));
}

function show(v) {
    return JSON.stringify(v, (_k, x) => {
        if (typeof x === 'bigint') return `${x}n`;
        if (x instanceof Uint8Array) return `blob(${x.length})`;
        return x;
    });
}

function same(a, b) {
    if (a instanceof Uint8Array || b instanceof Uint8Array) {
        return (
            a instanceof Uint8Array &&
            b instanceof Uint8Array &&
            a.length === b.length &&
            a.every((x, i) => x === b[i])
        );
    }
    if (typeof a === 'bigint' || typeof b === 'bigint') return a === b;
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const ka = Object.keys(a).sort();
        const kb = Object.keys(b).sort();
        return ka.length === kb.length && ka.every((k, i) => k === kb[i] && same(a[k], b[k]));
    }
    return a === b;
}

let failures = 0;
const fail = (name, message) => {
    failures++;
    console.log(`  FAIL ${name}: ${message}`);
};

for (const c of fixtures.cases) {
    const argTypes = c.argKinds.map((k) => ARG[k]);
    const argVals = c.argVals.map(reviveValue);
    try {
        // 1. ENCODE — byte-identical to the reference implementation.
        const mine = hex(IDL.encode(argTypes, argVals));
        if (mine !== c.argsHex) {
            fail(c.name, `args encode\n        ours: ${mine}\n         ref: ${c.argsHex}`);
            continue;
        }
        // 2. DECODE — the reference's bytes come back as the same values.
        const back = IDL.decode(argTypes, unhex(c.argsHex));
        if (!same(back, argVals)) {
            fail(c.name, `args decode: got ${show(back)}, want ${show(argVals)}`);
            continue;
        }

        let retNote = 'n/a';
        if (c.retName) {
            const retType = RET[c.retName];
            const retVal = reviveValue(c.retVal);
            const rMine = hex(IDL.encode([retType], [retVal]));
            if (rMine !== c.retHex) {
                fail(c.name, `reply encode\n        ours: ${rMine}\n         ref: ${c.retHex}`);
                continue;
            }
            const rBack = IDL.decode([retType], unhex(c.retHex))[0];
            if (!same(rBack, retVal)) {
                fail(c.name, `reply decode: got ${show(rBack)}, want ${show(retVal)}`);
                continue;
            }
            retNote = show(rBack);
        }
        console.log(`  ok   ${c.name.padEnd(30)} args=${c.argsHex.length / 2}B ret=${retNote}`);
    } catch (e) {
        fail(c.name, e.message);
    }
}

// 3. REJECT — malformed input must throw, not decode into something plausible.
//
// `proof` is a ResultProof carrying a record; `unit` is a ResultUnit whose
// final byte IS the variant arm index, which is what makes corrupting that
// byte a real out-of-range arm rather than a mangled payload character.
const proof = fixtures.cases.find((c) => c.name === 'verify_proof').retHex;
const unit = fixtures.cases.find((c) => c.name === 'remove_employee').retHex;
const patchLastByte = (h, b) => {
    const bytes = unhex(h);
    bytes[bytes.length - 1] = b;
    return bytes;
};

const rejections = [
    ['bad magic', RET.ResultProof, unhex('4e4f5045' + proof.slice(8))],
    ['truncated', RET.ResultProof, unhex(proof).subarray(0, 12)],
    ['empty', RET.ResultProof, new Uint8Array(0)],
    ['trailing bytes', RET.ResultProof, new Uint8Array([...unhex(proof), 0xff])],
    ['arm out of range', RET.ResultUnit, patchLastByte(unit, 0x05)],
    // A reply of the wrong shape must be refused, not coerced into the
    // expected one — this is the check that a mis-mirrored .did fails loudly.
    ['wrong reply type', RET.ResultProof, unhex(unit)],
];
for (const [label, type, bytes] of rejections) {
    let threw = false;
    try {
        IDL.decode([type], bytes);
    } catch {
        threw = true;
    }
    if (threw) console.log(`  ok   reject ${label}`);
    else fail(`reject ${label}`, 'decoded without error — a malformed reply must throw');
}

const total = fixtures.cases.length + rejections.length;
console.log(
    failures === 0
        ? `\nALL ${total} CHECKS PASS — encoding is byte-identical to the reference vectors`
        : `\n${failures} FAILURE(S) of ${total}`
);
process.exit(failures === 0 ? 0 : 1);
