import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeInputText } from "@/lib/authValidation";
import { AuthServiceError, VERIFY_EMAIL_STORAGE_KEY } from "@/services/authService";

interface VerifyEmailLocationState {
  email?: string;
}

const VerifyEmail = () => {
  const location = useLocation();
  const { resendEmailVerification } = useAuth();
  const locationState = location.state as VerifyEmailLocationState | null;

  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stateEmail = sanitizeInputText(locationState?.email ?? "").toLowerCase();

    if (stateEmail) {
      setEmail(stateEmail);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(VERIFY_EMAIL_STORAGE_KEY, stateEmail);
      }
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const storedEmail = sanitizeInputText(window.sessionStorage.getItem(VERIFY_EMAIL_STORAGE_KEY) ?? "").toLowerCase();
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, [locationState?.email]);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCountdown((previous) => previous - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [countdown]);

  const emailLabel = useMemo(() => {
    if (!email) {
      return "your email";
    }
    return email;
  }, [email]);

  const handleResend = async () => {
    if (!email || countdown > 0) {
      return;
    }

    setIsResending(true);
    setMessage(null);

    try {
      await resendEmailVerification(email);
      setCountdown(60);
      setMessage("Verification email sent.");
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setMessage(error.message);
      } else {
        setMessage("Could not resend verification email right now.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="text-center">
        <Mail className="mx-auto h-12 w-12 text-[var(--color-accent)]" strokeWidth={1.35} />

        <h1 className="mt-8 font-display text-[42px] italic leading-none text-[var(--color-primary)]">Check your email</h1>
        <p className="mt-4 font-body text-[14px] font-light leading-[1.8] text-[var(--color-muted)]">
          We sent a verification link to {emailLabel}. Click the link to activate your account.
        </p>

        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={countdown > 0 || isResending || !email}
          className="mt-8 font-body text-[11px] uppercase tracking-[0.15em] text-[var(--color-accent)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isResending ? "Sending..." : countdown > 0 ? `Resend in ${countdown}s` : "Resend email"}
        </button>

        {message ? <p className="mt-3 font-body text-[11px] text-[var(--color-muted)]">{message}</p> : null}

        <p className="mt-8 font-body text-[12px] text-[var(--color-muted)]">
          Wrong email?{" "}
          <Link to="/auth/register" className="text-[var(--color-primary)] transition-colors hover:text-[var(--color-accent)]">
            Go back
          </Link>
        </p>
      </div>
    </AuthPageLayout>
  );
};

export default VerifyEmail;



