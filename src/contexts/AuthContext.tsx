import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getCurrentCustomerRole,
  getSession,
  initializeCustomerProfileForUser,
  onAuthStateChange,
  requestPasswordReset,
  resendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  updatePassword,
  type CustomerRole,
  type RegisterWithEmailInput,
  type SignInWithEmailInput,
} from "@/services/authService";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: CustomerRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  register: (input: RegisterWithEmailInput) => Promise<{ email: string }>;
  login: (input: SignInWithEmailInput) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resendEmailVerification: (email: string) => Promise<void>;
  sendPasswordReset: (email: string, redirectTo: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const isAdminRole = (role: CustomerRole): boolean => role === "admin" || role === "super_admin";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<CustomerRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const syncIdRef = useRef(0);

  const syncSessionState = useCallback(async (nextSession: Session | null) => {
    const syncId = syncIdRef.current + 1;
    syncIdRef.current = syncId;

    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setRole(null);
      if (syncId === syncIdRef.current) {
        setIsLoading(false);
      }
      return;
    }

    try {
      await initializeCustomerProfileForUser(nextSession.user);
      const nextRole = await getCurrentCustomerRole();

      if (syncId !== syncIdRef.current) {
        return;
      }

      setRole(nextRole);
    } catch {
      if (syncId !== syncIdRef.current) {
        return;
      }

      setRole(null);
    } finally {
      if (syncId === syncIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const restoredSession = await getSession();

      if (!isMounted) {
        return;
      }

      await syncSessionState(restoredSession);
    };

    void restoreSession();

    const unsubscribe = onAuthStateChange((_event, nextSession) => {
      void syncSessionState(nextSession);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [syncSessionState]);

  const refreshAuthState = useCallback(async () => {
    setIsLoading(true);
    const latestSession = await getSession();
    await syncSessionState(latestSession);
  }, [syncSessionState]);

  const register = useCallback(async (input: RegisterWithEmailInput) => {
    const result = await signUpWithEmail(input);
    return {
      email: result.email,
    };
  }, []);

  const login = useCallback(
    async (input: SignInWithEmailInput) => {
      const result = await signInWithEmail(input);
      await syncSessionState(result.session);
    },
    [syncSessionState],
  );

  const loginWithGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const resendEmailVerification = useCallback(async (email: string) => {
    await resendVerificationEmail(email);
  }, []);

  const sendPasswordReset = useCallback(async (email: string, redirectTo: string) => {
    await requestPasswordReset(email, redirectTo);
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    await updatePassword(newPassword);
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      role,
      isLoading,
      isAuthenticated: Boolean(session && user),
      isAdmin: isAdminRole(role),
      register,
      login,
      loginWithGoogle,
      resendEmailVerification,
      sendPasswordReset,
      changePassword,
      logout,
      refreshAuthState,
    }),
    [
      user,
      session,
      role,
      isLoading,
      register,
      login,
      loginWithGoogle,
      resendEmailVerification,
      sendPasswordReset,
      changePassword,
      logout,
      refreshAuthState,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};

