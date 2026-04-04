export const AUTH_MODAL_QUERY_PARAM = "auth";
export const AUTH_MODAL_EMAIL_QUERY_PARAM = "auth_email";
export const AUTH_MODAL_REGISTERED_QUERY_PARAM = "auth_registered";

export type AuthModalMode = "login" | "register" | "forgot-password" | "reset-password" | "verify-email";

const AUTH_MODAL_MODES: AuthModalMode[] = ["login", "register", "forgot-password", "reset-password", "verify-email"];

export const isAuthModalMode = (value: string | null): value is AuthModalMode => {
  return value !== null && AUTH_MODAL_MODES.includes(value as AuthModalMode);
};

export interface BuildAuthModalSearchOptions {
  mode: AuthModalMode;
  redirect?: string | null;
  email?: string | null;
  justRegistered?: boolean | null;
}

export const buildAuthModalSearch = (
  currentSearch: string,
  { mode, redirect, email, justRegistered }: BuildAuthModalSearchOptions,
): string => {
  const params = new URLSearchParams(currentSearch);
  params.set(AUTH_MODAL_QUERY_PARAM, mode);

  if (redirect !== undefined) {
    if (redirect && redirect.trim().length > 0) {
      params.set("redirect", redirect.trim());
    } else {
      params.delete("redirect");
    }
  }

  if (email !== undefined) {
    const normalizedEmail = email?.trim() ?? "";
    if (normalizedEmail) {
      params.set(AUTH_MODAL_EMAIL_QUERY_PARAM, normalizedEmail);
    } else {
      params.delete(AUTH_MODAL_EMAIL_QUERY_PARAM);
    }
  }

  if (justRegistered !== undefined) {
    if (justRegistered) {
      params.set(AUTH_MODAL_REGISTERED_QUERY_PARAM, "1");
    } else {
      params.delete(AUTH_MODAL_REGISTERED_QUERY_PARAM);
    }
  }

  return params.toString();
};

export const clearAuthModalSearch = (currentSearch: string): string => {
  const params = new URLSearchParams(currentSearch);
  params.delete(AUTH_MODAL_QUERY_PARAM);
  params.delete(AUTH_MODAL_EMAIL_QUERY_PARAM);
  params.delete(AUTH_MODAL_REGISTERED_QUERY_PARAM);
  params.delete("redirect");
  return params.toString();
};

export const buildPathWithSearch = (pathname: string, search: string, hash = ""): string => {
  return `${pathname}${search ? `?${search}` : ""}${hash}`;
};
