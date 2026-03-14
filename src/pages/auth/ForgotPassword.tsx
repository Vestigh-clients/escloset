import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthInputField from "@/components/auth/AuthInputField";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { getEmailError, sanitizeInputText } from "@/lib/authValidation";

const ForgotPassword = () => {
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
      await sendPasswordReset(normalizedEmail, `${siteUrl}/auth/reset-password`);
    } catch {
      // This flow always returns a generic success message to prevent account enumeration.
    } finally {
      setSuccessMessage(`If an account exists for ${normalizedEmail}, you will receive a reset link shortly.`);
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageLayout>
      <h1 className="font-display text-[42px] italic leading-none text-[#1A1A1A]">Forgot password?</h1>
      <p className="mt-3 font-body text-[13px] font-light leading-[1.8] text-[#888888]">
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
          className="mt-8 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? "Please wait..." : "Send Reset Link"}
        </button>
      </form>

      {successMessage ? <p className="mt-6 font-body text-[13px] text-[#888888]">{successMessage}</p> : null}

      <p className="mt-6 font-body text-[12px] text-[#888888]">
        Remembered your password?{" "}
        <Link to="/auth/login" className="text-[#1A1A1A] transition-colors hover:text-[#C4A882]">
          Sign in
        </Link>
      </p>
    </AuthPageLayout>
  );
};

export default ForgotPassword;
