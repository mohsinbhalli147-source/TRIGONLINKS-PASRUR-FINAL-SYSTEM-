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

        AppwriteService.init(config);
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
   * Signs the user out the moment a read says the session is no longer valid.
   *
   * Reads go through the server, so a 401 or 403 on any of them is authoritative:
   * the cookie was cleared, expired, or the account lost its access. Without this
   * the panel would sit there showing an empty table with no explanation, which
   * is exactly the failure this listener exists to make legible.
   */
  useEffect(() => {
    if (!user) return;

    const onExpired = (): void => {
      setUser(null);
      AppwriteService.clearSession();
    };

    window.addEventListener('trigon_session_expired', onExpired);
    return () => window.removeEventListener('trigon_session_expired', onExpired);
  }, [user]);

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
        AppwriteService.init(connection);
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
