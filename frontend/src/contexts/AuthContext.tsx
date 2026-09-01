"use client"
/**
 * Proofly's authentication, on Memphis.
 *
 * Memphis is Thebes' identity layer: a passkey, not a wallet — no extension to
 * install, no seed phrase to lose, no password to reuse. Signing in yields an
 * origin-scoped session token that Proofly's contract hands to Memphis for
 * verification, and gets back the person's stable, per-app principal.
 *
 * The surface this exposes (`isAuthenticated`, `login`, `logout`, `isLoading`)
 * is the same one the app has always used, so nothing above it had to change.
 */
import { useRouter } from 'next/navigation';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import { canSignIn } from '@/lib/thebes/config';
import {
    getSession,
    restore,
    signIn as memphisSignIn,
    signOut as memphisSignOut,
    type MemphisSession,
} from '@/lib/thebes/memphis';
import { createActor } from '@/lib/thebes/actor';

interface AuthContextType {
    /** The live Memphis session, or undefined when signed out. */
    session: MemphisSession | undefined;
    isAuthenticated: boolean;
    /** The person's Memphis handle, e.g. `amira.thebes`. */
    displayName: string | undefined;
    /** False on origins where the passkey ceremony cannot run (e.g. localhost). */
    signInAvailable: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
    /** The last sign-in failure, for the UI to surface. */
    error: string | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const router = useRouter();
    const [session, setSession] = useState<MemphisSession>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>();
    const [signInAvailable, setSignInAvailable] = useState(false);

    // On load: collect a redirect return, adopt a held session, or renew one
    // silently from the refresh credential. No window, no passkey prompt — this
    // is what keeps a returning visitor signed in.
    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            setSignInAvailable(canSignIn());
            try {
                const held = await restore();
                if (!cancelled) setSession(held ?? undefined);
            } catch (e) {
                console.error('Failed to restore the Memphis session:', e);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void init();
        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async () => {
        setError(undefined);
        try {
            // Called straight from the click. Nothing is awaited before
            // `memphisSignIn` on purpose: an await ends the user gesture, and a
            // popup opened outside one is blocked — the single most common way
            // a working sign-in stops working on iPhone. `auto` falls back to a
            // full-page redirect when the popup is blocked anyway.
            const next = await memphisSignIn('auto');
            setSession(next);
            // Through the router, not `window.location`: the app is served
            // under `/_/raw/<cid>/`, and only the router knows to prefix that
            // base path. A raw assignment would navigate off the app entirely.
            router.push('/dashboard');
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            console.error('Memphis sign-in failed:', message);
        }
    }, [router]);

    const logout = useCallback(async () => {
        const held = session ?? getSession() ?? undefined;

        // Best effort: ask the contract to drop its cached view of this token.
        // Ending the Memphis session itself is not ours to do — `end_session`
        // is caller-scoped on Memphis, so only the Memphis origin can.
        if (held) {
            try {
                await createActor(held).memphis_sign_out();
            } catch {
                /* signing out locally still has to work */
            }
        }

        memphisSignOut();
        setSession(undefined);
        setError(undefined);
    }, [session]);

    const value = useMemo<AuthContextType>(
        () => ({
            session,
            isAuthenticated: !!session,
            displayName: session?.name,
            signInAvailable,
            login,
            logout,
            isLoading,
            error,
        }),
        [session, signInAvailable, login, logout, isLoading, error]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
