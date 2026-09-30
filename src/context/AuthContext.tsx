import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { SectionId, FunctionPermission } from '../types';
import { AppwriteService } from '../services/appwrite';
import {
  ApiError,
  fetchAppwriteConfig,
  fetchProvisioningStatus,
  fetchSessionProfile,
  login as apiLogin,
  logout as apiLogout,
  refreshAppwriteToken,
  type AuthProfile,
  type AppwriteConnection,
} from '../services/authApi';

export type AppUser = AuthProfile;

export type BootstrapStatus =
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'unprovisioned'; message: string }
  | { state: 'offline'; message: string };

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bootstrap: BootstrapStatus;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasSectionAccess: (sectionId: SectionId) => boolean;
  hasFunctionAccess: (permission: FunctionPermission) => boolean;
  isAdmin: boolean;
  activeSection: SectionId;
  setActiveSection: (section: SectionId) => void;
}

const SESSION_SECTION_KEY = 'trigon_active_section';

/**
 * How often to renew the Appwrite JWT, in milliseconds.
 *
 * Appwrite 2.x tokens last 15 minutes. Renewing at 10 leaves room for a tick
 * that lands late, and costs one cheap request, since the server trades its
 * stored session cookie for the new token rather than re-checking a password.
 */
const TOKEN_REFRESH_INTERVAL_MS = 10 * 60_000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Staff session state.
 *
 * There is no cached identity to trust: the profile comes from the server, which
 * validates its own httpOnly cookie, and the Appwrite token arrives in the same
 * response. A user cannot become an administrator by editing web storage,
 * because web storage is never consulted for identity.
 *
 * Subscriber sessions live in the separate customer app and never reach this
 * bundle.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapStatus>({ state: 'loading' });
  const [activeSection, setActiveSectionState] = useState<SectionId>('dashboard');
  const [connection, setConnection] = useState<AppwriteConnection | null>(null);

  const setActiveSection = useCallback((section: SectionId) => {
    setActiveSectionState(section);
    sessionStorage.setItem(SESSION_SECTION_KEY, section);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async (): Promise<void> => {
      try {
        const config = await fetchAppwriteConfig();
        if (cancelled) return;
        setConnection(config);

        const status = await fetchProvisioningStatus();
        if (cancelled) return;
        if (!status.provisioned) {
          setBootstrap({
            state: 'unprovisioned',
            message:
              status.message ??
              'The data service is not provisioned yet. Run "npm run provision" on the server.',
          });
          return;
        }
        setBootstrap({ state: 'ready' });

        const storedSection = sessionStorage.getItem(SESSION_SECTION_KEY) as SectionId | null;
        const session = await fetchSessionProfile();
        if (cancelled) return;

        const grant = session?.appwrite;
        if (!session || !grant) {
          setUser(null);
          return;
        }

        // A subscriber cannot hold an Appwrite session, so reaching here with a
        // Customer role means the cookie belongs to the customer app.
        if (session.profile.role === 'Customer') {
          setUser(null);
          return;
        }

        AppwriteService.init(config, grant.token);
        setUser(session.profile);
        setActiveSectionState(storedSection ?? 'dashboard');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : 'Could not reach the server.';
        setBootstrap({ state: 'offline', message });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Keeps the Appwrite JWT alive for as long as the panel is open.
   *
   * A short lived token that simply expired would break every read at once, so
   * it is renewed on a timer and again whenever the tab comes back to the
   * foreground, which covers a laptop that was asleep past the expiry. A 401
   * here means the upstream session is genuinely gone, so the user is signed
   * out rather than left clicking through failures.
   */
  useEffect(() => {
    if (!user || user.role === 'Customer' || !connection) return;

    let cancelled = false;

    const renew = async (): Promise<void> => {
      try {
        const grant = await refreshAppwriteToken();
        if (cancelled || !grant) return;
        AppwriteService.setSession(grant.token);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          AppwriteService.clearSession();
        }
      }
    };

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void renew();
    };

    const interval = window.setInterval(() => void renew(), TOKEN_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, connection]);

  const login = useCallback(
    async (
      identifier: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!connection) {
        return { success: false, error: 'Still connecting to the server. Try again shortly.' };
      }
      if (!identifier.trim() || !password) {
        return { success: false, error: 'Enter your sign-in details.' };
      }

      try {
        const result = await apiLogin({ identifier: identifier.trim(), password });
        AppwriteService.init(connection, result.appwrite.token);
        setUser(result.profile);
        setActiveSection('dashboard');
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.',
        };
      }
    },
    [connection, setActiveSection]
  );

  const logout = useCallback(async () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_SECTION_KEY);
    AppwriteService.clearSession();
    try {
      await apiLogout();
    } catch {
      // The local session is cleared regardless of the server response.
    }
  }, []);

  const hasSectionAccess = useCallback(
    (sectionId: SectionId): boolean => {
      if (!user) return false;
      if (user.role === 'Admin') return true;
      return user.allowedSections.includes(sectionId);
    },
    [user]
  );

  const hasFunctionAccess = useCallback(
    (permission: FunctionPermission): boolean => {
      if (!user) return false;
      if (user.role === 'Admin') return true;
      return user.allowedFunctions.includes(permission);
    },
    [user]
  );

  const isAdmin = user?.role === 'Admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        bootstrap,
        login,
        logout,
        hasSectionAccess,
        hasFunctionAccess,
        isAdmin,
        activeSection,
        setActiveSection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
