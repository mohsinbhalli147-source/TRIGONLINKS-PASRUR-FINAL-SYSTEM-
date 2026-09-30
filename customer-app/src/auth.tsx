import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, restoreSession, signIn, signOut, type SubscriberProfile } from './api';

type Status = 'checking' | 'signed-out' | 'signed-in' | 'unavailable';

interface AuthValue {
  status: Status;
  profile: SubscriberProfile | null;
  /** Populated when the server is unreachable or not provisioned. */
  notice: string | null;
  login: (userId: string, cnic: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [profile, setProfile] = useState<SubscriberProfile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((restored) => {
        if (cancelled) return;
        if (restored) {
          setProfile(restored);
          setStatus('signed-in');
        } else {
          setStatus('signed-out');
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setNotice(
          error instanceof ApiError ? error.message : 'Cannot reach Trigon Links right now.'
        );
        setStatus('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (userId: string, cnic: string) => {
    try {
      const result = await signIn({ userId, cnic });
      setProfile(result.profile);
      setNotice(null);
      setStatus('signed-in');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof ApiError ? error.message : 'Could not sign in. Please try again.',
      };
    }
  }, []);

  const logout = useCallback(async () => {
    // Clear local state first so the UI responds even if the call fails.
    setProfile(null);
    setStatus('signed-out');
    try {
      await signOut();
    } catch {
      /* the cookie may already be gone */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ status, profile, notice, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within an AuthProvider');
  return value;
};
