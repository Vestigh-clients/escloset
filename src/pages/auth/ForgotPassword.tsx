import { useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthInputField from "@/components/auth/AuthInputField";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getEmailError, sanitizeInputText } from "@/lib/authValidation";
import { buildAuthModalSearch, buildPathWithSearch } from "@/lib/authModal";

const ForgotPassword = () => {
  const location = useLocation();
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailError = useMemo(() => getEmailError(email), [email]);

  const handleBlur = () => {
    setTouched(true);
    setError(emailError);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError(emailError);

    if (emailError) {
      return;
    }

    setIsSubmitting(true);

    const normalizedEmail = sanitizeInputText(email).toLowerCase();
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

    try {
      await sendPasswordReset(normalizedEmail, `${siteUrl}/?auth=reset-password`);
    } catch {
      // This flow always returns a generic success message to prevent account enumeration.
    } finally {
      setSuccessMessage(`If an account exists for ${normalizedEmail}, you will receive a reset link shortly.`);
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout>
      <h1 className="font-display text-[42px] italic leading-none text-[var(--color-primary)]">Forgot password?</h1>
      <p className="mt-3 font-body text-[13px] font-light leading-[1.8] text-[var(--color-muted)]">
        Enter your email and we&apos;ll send a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8" noValidate>
        <AuthInputField
          id="forgot-password-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={handleBlur}
          required
          autoComplete="email"
          touched={touched}
          error={error}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? "Please wait..." : "Send Reset Link"}
        </button>
      </form>

      {successMessage ? <p className="mt-6 font-body text-[13px] text-[var(--color-muted)]">{successMessage}</p> : null}

      <p className="mt-6 font-body text-[12px] text-[var(--color-muted)]">
        Remembered your password?{" "}
        <Link
          to={buildPathWithSearch(
            location.pathname,
            buildAuthModalSearch(location.search, {
              mode: "login",
            }),
            location.hash,
          )}
          className="text-[var(--color-primary)] transition-colors hover:text-[var(--color-accent)]"
        >
          Sign in
        </Link>
      </p>
    </AuthPageLayout>
  );
};

export default ForgotPassword;


