import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import AuthInputField from "@/components/auth/AuthInputField";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getEmailError, getRequiredError, sanitizeInputText } from "@/lib/authValidation";
import {
  AUTH_MODAL_EMAIL_QUERY_PARAM,
  AUTH_MODAL_REGISTERED_QUERY_PARAM,
  buildAuthModalSearch,
  buildPathWithSearch,
  clearAuthModalSearch,
} from "@/lib/authModal";
import { AuthServiceError, REDIRECT_AFTER_LOGIN_KEY } from "@/services/authService";

type LoginField = "email" | "password";

interface LoginLocationState {
  justRegistered?: boolean;
  email?: string;
}

const sanitizeRedirectPath = (candidate: string | null): string | null => {
  const value = candidate?.trim() ?? "";
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
};

const readPostLoginRedirect = (pathname: string, search: string, hash: string): string => {
  if (typeof window === "undefined") {
    return "/";
  }

  const queryRedirect = sanitizeRedirectPath(new URLSearchParams(search).get("redirect"));

  const raw = window.sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);
  if (raw !== null) {
    window.sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
  }

  const storedRedirect = sanitizeRedirectPath(raw);
  const fallbackSearch = clearAuthModalSearch(search);
  const fallbackPath = buildPathWithSearch(pathname, fallbackSearch, hash);
  return storedRedirect ?? queryRedirect ?? fallbackPath;
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LoginLocationState | null;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const { isAuthenticated, isLoading, login, resendEmailVerification } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState<Record<LoginField, boolean>>({
    email: false,
    password: false,
  });
  const [errors, setErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(readPostLoginRedirect(location.pathname, location.search, location.hash), { replace: true });
    }
  }, [isAuthenticated, isLoading, location.hash, location.pathname, location.search, navigate]);

  const fieldErrors = useMemo(
    () => ({
      email: getEmailError(email),
      password: getRequiredError("Password", password),
    }),
    [email, password],
  );

  const markTouched = (field: LoginField) => {
    setTouched((previous) => ({
      ...previous,
      [field]: true,
    }));

    setErrors((previous) => ({
      ...previous,
      [field]: fieldErrors[field],
    }));
  };

  const validateAllFields = () => {
    setTouched({
      email: true,
      password: true,
    });
    setErrors(fieldErrors);
    return Object.values(fieldErrors).every((value) => !value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError(null);
    setResendMessage(null);
    setIsEmailNotVerified(false);

    if (!validateAllFields()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: sanitizeInputText(email).toLowerCase(),
        password,
      });
      navigate(readPostLoginRedirect(location.pathname, location.search, location.hash), { replace: true });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.code === "email_not_verified") {
          setIsEmailNotVerified(true);
          setGeneralError("Please verify your email before signing in.");
        } else if (error.code === "invalid_credentials") {
          setGeneralError("Incorrect email or password.");
        } else {
          setGeneralError(error.message);
        }
      } else {
        setGeneralError("We couldn't sign you in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = sanitizeInputText(email).toLowerCase();
    if (!normalizedEmail) {
      setGeneralError("Enter your email to resend the verification link.");
      return;
    }

    setIsResendingEmail(true);
    setResendMessage(null);

    try {
      await resendEmailVerification(normalizedEmail);
      setResendMessage("Verification email sent.");
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setResendMessage(error.message);
      } else {
        setResendMessage("Could not resend verification email right now.");
      }
    } finally {
      setIsResendingEmail(false);
    }
  };

  return (
    <AuthPageLayout showPanelImage={false}>
      <h1 className="font-display text-[42px] italic leading-none text-[var(--color-primary)]">Welcome back</h1>
      <p className="mt-3 font-body text-[13px] font-light leading-[1.8] text-[var(--color-muted)]">
        Sign in to continue checkout, manage your account, and track orders.
      </p>

      {locationState?.justRegistered || searchParams.get(AUTH_MODAL_REGISTERED_QUERY_PARAM) === "1" ? (
        <p className="mt-4 font-body text-[11px] text-[var(--color-success)]">
          Account created successfully
          {locationState?.email || searchParams.get(AUTH_MODAL_EMAIL_QUERY_PARAM)
            ? ` for ${locationState?.email ?? searchParams.get(AUTH_MODAL_EMAIL_QUERY_PARAM) ?? ""}`
            : ""}
          . Please sign in.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-8" noValidate>
        <AuthInputField
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={() => markTouched("email")}
          required
          autoComplete="email"
          touched={touched.email}
          error={errors.email}
        />

        <AuthInputField
          id="login-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
          onBlur={() => markTouched("password")}
          required
          autoComplete="current-password"
          touched={touched.password}
          error={errors.password}
          trailingControl={
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="inline-flex text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
            </button>
          }
        />

        <div className="mt-2 text-right">
          <Link
            to={buildPathWithSearch(
              location.pathname,
              buildAuthModalSearch(location.search, {
                mode: "forgot-password",
              }),
              location.hash,
            )}
            className="font-body text-[11px] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
          >
            Forgot your password?
          </Link>
        </div>

        {generalError ? (
          <p className="mt-4 font-body text-[11px] text-[var(--color-danger)]">
            {generalError}{" "}
            {isEmailNotVerified ? (
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={isResendingEmail}
                className="underline transition-colors hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isResendingEmail ? "Resending..." : "Resend verification email?"}
              </button>
            ) : null}
          </p>
        ) : null}

        {resendMessage ? <p className="mt-3 font-body text-[11px] text-[var(--color-muted)]">{resendMessage}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? "Please wait..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 font-body text-[12px] text-[var(--color-muted)]">
        Don&apos;t have an account?{" "}
        <Link
          to={buildPathWithSearch(
            location.pathname,
            buildAuthModalSearch(location.search, {
              mode: "register",
              justRegistered: false,
              email: null,
            }),
            location.hash,
          )}
          className="text-[var(--color-primary)] transition-colors hover:text-[var(--color-accent)]"
        >
          Create account
        </Link>
      </p>
    </AuthPageLayout>
  );
};

export default Login;


