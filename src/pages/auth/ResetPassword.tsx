import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthInputField from "@/components/auth/AuthInputField";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getConfirmPasswordError, getPasswordError } from "@/lib/authValidation";
import { AuthServiceError } from "@/services/authService";

type ResetPasswordField = "newPassword" | "confirmPassword";

const extractRecoveryToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token =
    hashParams.get("access_token") ||
    searchParams.get("access_token") ||
    searchParams.get("token") ||
    hashParams.get("token");

  return token || null;
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const { changePassword, isAuthenticated, isLoading } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<ResetPasswordField, boolean>>({
    newPassword: false,
    confirmPassword: false,
  });
  const [errors, setErrors] = useState<Partial<Record<ResetPasswordField, string>>>({});
  const [hasRecoveryToken, setHasRecoveryToken] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const token = extractRecoveryToken();
    if (token) {
      setHasRecoveryToken(true);

      if (typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSuccess || countdown <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCountdown((previous) => previous - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [isSuccess, countdown]);

  useEffect(() => {
    if (!isSuccess || countdown > 0) {
      return;
    }

    navigate("/auth/login", { replace: true });
  }, [countdown, isSuccess, navigate]);

  const canResetPassword = hasRecoveryToken || isAuthenticated;

  const fieldErrors = useMemo(
    () => ({
      newPassword: getPasswordError(newPassword),
      confirmPassword: getConfirmPasswordError(newPassword, confirmPassword),
    }),
    [newPassword, confirmPassword],
  );

  const markTouched = (field: ResetPasswordField) => {
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
      newPassword: true,
      confirmPassword: true,
    });
    setErrors(fieldErrors);
    return Object.values(fieldErrors).every((entry) => !entry);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError(null);

    if (!validateAllFields()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await changePassword(newPassword);
      setIsSuccess(true);
      setCountdown(3);
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setGeneralError(error.message);
      } else {
        setGeneralError("Could not update password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && !canResetPassword) {
    return (
      <AuthPageLayout>
        <h1 className="font-display text-[42px] italic leading-none text-[#1A1A1A]">Invalid reset link</h1>
        <p className="mt-4 font-body text-[13px] font-light leading-[1.8] text-[#555555]">
          This link is invalid or has expired. Request a new password reset email.
        </p>
        <Link
          to="/auth/forgot-password"
          className="mt-8 inline-flex font-body text-[11px] uppercase tracking-[0.15em] text-[#1A1A1A] transition-colors hover:text-[#C4A882]"
        >
          Request New Link
        </Link>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <h1 className="font-display text-[42px] italic leading-none text-[#1A1A1A]">Reset password</h1>
      <p className="mt-3 font-body text-[13px] font-light leading-[1.8] text-[#555555]">
        Set a new password for your account.
      </p>

      {!isSuccess ? (
        <form onSubmit={handleSubmit} className="mt-8" noValidate>
          <AuthInputField
            id="reset-password-new"
            label="New Password"
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={setNewPassword}
            onBlur={() => markTouched("newPassword")}
            required
            autoComplete="new-password"
            touched={touched.newPassword}
            error={errors.newPassword}
            trailingControl={
              <button
                type="button"
                onClick={() => setShowNewPassword((previous) => !previous)}
                className="inline-flex text-[#555555] transition-colors hover:text-[#1A1A1A]"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
              </button>
            }
          />

          <AuthInputField
            id="reset-password-confirm"
            label="Confirm New Password"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={setConfirmPassword}
            onBlur={() => markTouched("confirmPassword")}
            required
            autoComplete="new-password"
            touched={touched.confirmPassword}
            error={errors.confirmPassword}
            trailingControl={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((previous) => !previous)}
                className="inline-flex text-[#555555] transition-colors hover:text-[#1A1A1A]"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
              </button>
            }
          />

          {generalError ? <p className="mt-4 font-body text-[11px] text-[#C0392B]">{generalError}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="mt-8 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSubmitting ? "Please wait..." : "Update Password"}
          </button>
        </form>
      ) : (
        <div className="mt-8">
          <p className="font-body text-[13px] text-[#555555]">Password updated successfully.</p>
          <p className="mt-3 font-body text-[12px] text-[#555555]">Redirecting in {countdown}s</p>
        </div>
      )}
    </AuthPageLayout>
  );
};

export default ResetPassword;

