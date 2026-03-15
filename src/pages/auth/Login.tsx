import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthInputField from "@/components/auth/AuthInputField";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import { useAuth } from "@/contexts/AuthContext";
import { getEmailError, getRequiredError, sanitizeInputText } from "@/lib/authValidation";
import { AuthServiceError, REDIRECT_AFTER_LOGIN_KEY } from "@/services/authService";

type LoginField = "email" | "password";

const sanitizeRedirectPath = (candidate: string | null): string | null => {
  const value = candidate?.trim() ?? "";
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
};

const readPostLoginRedirect = (search: string): string => {
  if (typeof window === "undefined") {
    return "/";
  }

  const queryRedirect = sanitizeRedirectPath(new URLSearchParams(search).get("redirect"));

  const raw = window.sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);
  if (raw !== null) {
    window.sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
  }

  const storedRedirect = sanitizeRedirectPath(raw);
  return storedRedirect ?? queryRedirect ?? "/";
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, login, loginWithGoogle, resendEmailVerification } = useAuth();

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
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(readPostLoginRedirect(location.search), { replace: true });
    }
  }, [isLoading, isAuthenticated, location.search, navigate]);

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
      navigate(readPostLoginRedirect(location.search), { replace: true });
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

  const handleGoogleSignIn = async () => {
    setGeneralError(null);
    setResendMessage(null);
    setIsGoogleSubmitting(true);

    try {
      await loginWithGoogle();
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setGeneralError(error.message);
      } else {
        setGeneralError("Google sign-in could not start. Please try again.");
      }
      setIsGoogleSubmitting(false);
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
    <AuthPageLayout>
      <h1 className="font-display text-[42px] italic leading-none text-[#1A1A1A]">Welcome back</h1>
      <p className="mt-3 font-body text-[13px] font-light leading-[1.8] text-[#555555]">
        Sign in to continue checkout, manage your account, and track orders.
      </p>

      <div className="mt-8">
        <GoogleOAuthButton onClick={handleGoogleSignIn} disabled={isSubmitting || isGoogleSubmitting} />
      </div>

      <form onSubmit={handleSubmit} className="mt-6" noValidate>
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
              className="inline-flex text-[#555555] transition-colors hover:text-[#1A1A1A]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
            </button>
          }
        />

        <div className="mt-2 text-right">
          <Link
            to="/auth/forgot-password"
            className="font-body text-[11px] text-[#555555] transition-colors hover:text-[#1A1A1A]"
          >
            Forgot your password?
          </Link>
        </div>

        {generalError ? (
          <p className="mt-4 font-body text-[11px] text-[#C0392B]">
            {generalError}{" "}
            {isEmailNotVerified ? (
              <button
                type="button"
                onClick={() => void handleResendVerification()}
                disabled={isResendingEmail}
                className="underline transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isResendingEmail ? "Resending..." : "Resend verification email?"}
              </button>
            ) : null}
          </p>
        ) : null}

        {resendMessage ? <p className="mt-3 font-body text-[11px] text-[#555555]">{resendMessage}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || isGoogleSubmitting}
          className="mt-8 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? "Please wait..." : "Sign In"}
        </button>
      </form>

      <p className="mt-6 font-body text-[12px] text-[#555555]">
        Don&apos;t have an account?{" "}
        <Link to="/auth/register" className="text-[#1A1A1A] transition-colors hover:text-[#C4A882]">
          Create account
        </Link>
      </p>
    </AuthPageLayout>
  );
};

export default Login;

