import { useMemo } from 'react';

import { createActor, type ProoflyActor } from '@/lib/thebes/actor';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The Proofly contract, bound to whoever is currently signed in.
 *
 * The handle is rebuilt whenever the Memphis session changes, so a call is
 * never made with a stale token — and building one is just allocating closures,
 * with no network round-trip, which is why `loading` is only ever true while
 * the session itself is still being restored.
 *
 * @returns `actor` — the contract handle; `loading` — the session is still
 * being restored; `error` — reserved, and always null (nothing here can fail
 * before a call is made).
 */
export const useThebesActor = (): {
    actor: ProoflyActor | null;
    loading: boolean;
    error: string | null;
} => {
    const { session, isLoading } = useAuth();

    const actor = useMemo(() => createActor(session ?? null), [session]);

    return { actor, loading: isLoading, error: null };
};
