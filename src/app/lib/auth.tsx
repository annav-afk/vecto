import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient, User } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { PlanTier } from './plans';
import { setCloudToken, pullAndMerge } from './cloudSync';

// Singleton Supabase client
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
);

const API = `https://${projectId}.supabase.co/functions/v1/make-server-a5927615`;

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface AuthContextType {
  user: User | null;
  token: string | null;
  authLoading: boolean;
  syncStatus: SyncStatus;
  setSyncStatus: (s: SyncStatus) => void;
  tier: PlanTier;
  tierLoading: boolean;
  refreshTier: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [tier, setTier] = useState<PlanTier>('free');
  const [tierLoading, setTierLoading] = useState(false);

  const fetchTier = useCallback(async (accessToken: string) => {
    setTierLoading(true);
    try {
      const res = await fetch(`${API}/user/tier`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTier((data.tier as PlanTier) || 'free');
      } else {
        setTier('free');
      }
    } catch {
      setTier('free');
    } finally {
      setTierLoading(false);
    }
  }, []);

  const refreshTier = useCallback(async () => {
    if (token) await fetchTier(token);
  }, [token, fetchTier]);

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        fetchTier(session.access_token);
        setCloudToken(session.access_token);
        // Pull all user data from cloud on session restore
        pullAndMerge(session.access_token).catch(err =>
          console.warn('[Auth] Initial cloud pull failed:', err)
        );
      } else {
        setTier('free');
        setCloudToken(null);
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setToken(session?.access_token ?? null);
      if (session?.access_token) {
        fetchTier(session.access_token);
        setCloudToken(session.access_token);
        // On sign-in, pull & merge cloud data
        if (event === 'SIGNED_IN') {
          pullAndMerge(session.access_token).catch(err =>
            console.warn('[Auth] Cloud pull after sign-in failed:', err)
          );
        }
      } else {
        setTier('free');
        setCloudToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchTier]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSyncStatus('idle');
    setTier('free');
  };

  return (
    <AuthContext.Provider value={{
      user, token, authLoading, syncStatus, setSyncStatus,
      tier, tierLoading, refreshTier,
      signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}