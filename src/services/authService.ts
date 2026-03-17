import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { storeConfig, storeKeyPrefix } from "@/config/store.config";
import { supabase } from "@/integrations/supabase/client";

export const REDIRECT_AFTER_LOGIN_KEY = `${storeKeyPrefix}_redirect_after_login`;
export const VERIFY_EMAIL_STORAGE_KEY = `${storeKeyPrefix}_verify_email_target`;

export type CustomerRole = "customer" | "admin" | "super_admin" | null;

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_verified"
  | "email_exists"
  | "weak_password"
  | "rate_limited"
  | "network"
  | "session_expired"
  | "unknown";

export class AuthServiceError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface RegisterWithEmailInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  marketingOptIn: boolean;
}

export interface SignInWithEmailInput {
  email: string;
  password: string;
}

export interface SignInWithEmailResult {
  session: Session;
}

export interface RegisterWithEmailResult {
  email: string;
  user: User;
}

interface RpcErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const SIGN_IN_REDIRECT_PATH = "/auth/login";

const parseError = (error: unknown): RpcErrorLike => {
  if (!error || typeof error !== "object") {
    return {};
  }
  return error as RpcErrorLike;
};

const toAuthError = (error: unknown): AuthServiceError => {
  const parsed = parseError(error);
  const combinedMessage = [parsed.message, parsed.details, parsed.hint].filter(Boolean).join(" ").toLowerCase();

  if (combinedMessage.includes("invalid login credentials")) {
    return new AuthServiceError("invalid_credentials", "Incorrect email or password.");
  }

  if (combinedMessage.includes("email not confirmed")) {
    return new AuthServiceError("email_not_verified", "Please verify your email before signing in.");
  }

  if (combinedMessage.includes("already registered")) {
    return new AuthServiceError("email_exists", "An account already exists for this email.");
  }

  if (
    combinedMessage.includes("password should be") ||
    combinedMessage.includes("password is too weak") ||
    combinedMessage.includes("weak password")
  ) {
    return new AuthServiceError(
      "weak_password",
      "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
    );
  }

  if (combinedMessage.includes("too many requests") || combinedMessage.includes("rate limit")) {
    return new AuthServiceError("rate_limited", "Too many attempts. Please wait and try again.");
  }

  if (
    combinedMessage.includes("failed to fetch") ||
    combinedMessage.includes("fetch failed") ||
    combinedMessage.includes("network request failed")
  ) {
    return new AuthServiceError("network", "Network error. Check your connection and try again.");
  }

  if (combinedMessage.includes("jwt expired") || combinedMessage.includes("session expired")) {
    return new AuthServiceError("session_expired", "Your session expired. Please sign in again.");
  }

  return new AuthServiceError("unknown", "We couldn't complete this request. Please try again.");
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const sanitizeName = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
};

const splitDisplayName = (fullName: string): { firstName: string; lastName: string } => {
  const normalized = sanitizeName(fullName);
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...rest] = normalized.split(" ");
  return {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
  };
};

const getProfileNames = (user: User, fallback?: { firstName?: string; lastName?: string }) => {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackName = splitDisplayName(String(metadata.full_name ?? metadata.name ?? ""));

  const firstName = sanitizeName(
    fallback?.firstName ??
      (typeof metadata.first_name === "string" ? metadata.first_name : undefined) ??
      (typeof metadata.given_name === "string" ? metadata.given_name : undefined) ??
      fallbackName.firstName ??
      "",
  );

  const lastName = sanitizeName(
    fallback?.lastName ??
      (typeof metadata.last_name === "string" ? metadata.last_name : undefined) ??
      (typeof metadata.family_name === "string" ? metadata.family_name : undefined) ??
      fallbackName.lastName ??
      "",
  );

  return {
    firstName: firstName || "Customer",
    lastName: lastName || "Account",
  };
};

const getActiveSession = (session: Session | null): Session | null => {
  if (!session) {
    return null;
  }

  const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
  if (expiresAt && expiresAt <= Date.now()) {
    return null;
  }

  return session;
};

const resolveSiteUrl = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
};

const triggerWelcomeEmail = async (customerId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke("send_welcome_email", {
    body: {
      customer_id: customerId,
      store_name: storeConfig.storeName,
      support_email: storeConfig.contact.email,
    },
  });

  if (error) {
    throw error;
  }
};

export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): (() => void) => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, getActiveSession(session));
  });

  return () => {
    data.subscription.unsubscribe();
  };
};

export const getSession = async (): Promise<Session | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    return getActiveSession(data.session);
  } catch {
    return null;
  }
};

export const initializeCustomerProfileForUser = async (
  user: User,
  options?: { firstName?: string; lastName?: string },
): Promise<void> => {
  const email = normalizeEmail(user.email ?? "");
  if (!email) {
    return;
  }

  const names = getProfileNames(user, options);
  const { error } = await supabase.rpc("initialize_customer_profile", {
    p_user_id: user.id,
    p_first_name: names.firstName,
    p_last_name: names.lastName,
    p_email: email,
  });

  if (error) {
    throw toAuthError(error);
  }
};

export const getCurrentCustomerRole = async (): Promise<CustomerRole> => {
  const { data, error } = await supabase.rpc("get_current_customer_role");

  if (error) {
    throw toAuthError(error);
  }

  if (typeof data !== "string") {
    return null;
  }

  if (data === "admin" || data === "super_admin" || data === "customer") {
    return data;
  }

  return null;
};

export const signUpWithEmail = async (input: RegisterWithEmailInput): Promise<RegisterWithEmailResult> => {
  const email = normalizeEmail(input.email);
  const normalizedPhone = input.phone.replace(/\s+/g, " ").trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: `${resolveSiteUrl()}${SIGN_IN_REDIRECT_PATH}`,
      data: {
        first_name: sanitizeName(input.firstName),
        last_name: sanitizeName(input.lastName),
        phone: normalizedPhone || null,
        marketing_opt_in: input.marketingOptIn,
      },
    },
  });

  if (error) {
    throw toAuthError(error);
  }

  if (!data.user) {
    throw new AuthServiceError("unknown", "We couldn't create your account. Please try again.");
  }

  await initializeCustomerProfileForUser(data.user, {
    firstName: input.firstName,
    lastName: input.lastName,
  });

  void triggerWelcomeEmail(data.user.id).catch((error) => {
    if (import.meta.env.DEV) {
      console.warn("Welcome email trigger failed", error);
    }
  });

  return {
    email,
    user: data.user,
  };
};

export const signInWithEmail = async (input: SignInWithEmailInput): Promise<SignInWithEmailResult> => {
  const email = normalizeEmail(input.email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    throw toAuthError(error);
  }

  if (!data.session) {
    throw new AuthServiceError("unknown", "Sign-in failed. Please try again.");
  }

  return {
    session: data.session,
  };
};

export const signInWithGoogle = async (): Promise<void> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${resolveSiteUrl()}${SIGN_IN_REDIRECT_PATH}`,
    },
  });

  if (error) {
    throw toAuthError(error);
  }
};

export const resendVerificationEmail = async (email: string): Promise<void> => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new AuthServiceError("unknown", "Enter a valid email.");
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo: `${resolveSiteUrl()}${SIGN_IN_REDIRECT_PATH}`,
    },
  });

  if (error) {
    throw toAuthError(error);
  }
};

export const requestPasswordReset = async (email: string, redirectTo: string): Promise<void> => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) {
    throw toAuthError(error);
  }
};

export const updatePassword = async (password: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw toAuthError(error);
  }
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw toAuthError(error);
  }
};
