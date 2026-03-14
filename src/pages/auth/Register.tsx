import { useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthCheckbox from "@/components/auth/AuthCheckbox";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthInputField from "@/components/auth/AuthInputField";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import GoogleOAuthButton from "@/components/auth/GoogleOAuthButton";
import { useAuth } from "@/contexts/AuthContext";
import {
  getConfirmPasswordError,
  getEmailError,
  getPasswordError,
  getRequiredError,
  sanitizeInputText,
} from "@/lib/authValidation";
import { AuthServiceError, VERIFY_EMAIL_STORAGE_KEY } from "@/services/authService";

type RegisterField = "firstName" | "lastName" | "email" | "password" | "confirmPassword";

const Register = () => {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [touched, setTouched] = useState<Record<RegisterField, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [errors, setErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const fieldErrors = useMemo(
    () => ({
      firstName: getRequiredError("First name", firstName),
      lastName: getRequiredError("Last name", lastName),
      email: getEmailError(email),
      password: getPasswordError(password),
      confirmPassword: getConfirmPasswordError(password, confirmPassword),
    }),
    [firstName, lastName, email, password, confirmPassword],
  );

  const markTouched = (field: RegisterField) => {
    setTouched((previous) => ({
      ...previous,
      [field]: true,
    }));

    setErrors((previous) => ({
      ...previous,
      [field]: fieldErrors[field],
    }));
  };

  const validateAllFields = (): boolean => {
    const nextTouched: Record<RegisterField, boolean> = {
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
    };

    setTouched(nextTouched);
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
      const normalizedEmail = sanitizeInputText(email).toLowerCase();
      await register({
        firstName: sanitizeInputText(firstName),
        lastName: sanitizeInputText(lastName),
        email: normalizedEmail,
        password,
        marketingOptIn,
      });

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(VERIFY_EMAIL_STORAGE_KEY, normalizedEmail);
      }

      navigate("/auth/verify-email", {
        replace: true,
        state: {
          email: normalizedEmail,
        },
      });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.code === "email_exists") {
          setErrors((previous) => ({
            ...previous,
            email: error.message,
          }));
          setTouched((previous) => ({
            ...previous,
            email: true,
          }));
          return;
        }

        if (error.code === "weak_password") {
          setErrors((previous) => ({
            ...previous,
            password: error.message,
          }));
          setTouched((previous) => ({
            ...previous,
            password: true,
          }));
          return;
        }

        setGeneralError(error.message);
        return;
      }

      setGeneralError("We couldn't create your account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGeneralError(null);
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

  return (
    <AuthPageLayout>
      <h1 className="font-display text-[42px] italic leading-none text-[#1A1A1A]">Create your account</h1>
      <p className="mt-3 font-body text-[13px] font-light leading-[1.8] text-[#888888]">
        Sign up to save your details, check out faster, and track your orders.
      </p>

      <div className="mt-8">
        <GoogleOAuthButton onClick={handleGoogleSignIn} disabled={isSubmitting || isGoogleSubmitting} />
        <AuthDivider />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <AuthInputField
          id="register-first-name"
          label="First Name"
          value={firstName}
          onChange={setFirstName}
          onBlur={() => markTouched("firstName")}
          required
          autoComplete="given-name"
          touched={touched.firstName}
          error={errors.firstName}
        />

        <AuthInputField
          id="register-last-name"
          label="Last Name"
          value={lastName}
          onChange={setLastName}
          onBlur={() => markTouched("lastName")}
          required
          autoComplete="family-name"
          touched={touched.lastName}
          error={errors.lastName}
        />

        <AuthInputField
          id="register-email"
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
          id="register-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
          onBlur={() => markTouched("password")}
          required
          autoComplete="new-password"
          touched={touched.password}
          error={errors.password}
          trailingControl={
            <button
              type="button"
              onClick={() => setShowPassword((previous) => !previous)}
              className="inline-flex text-[#888888] transition-colors hover:text-[#1A1A1A]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
            </button>
          }
        />

        <AuthInputField
          id="register-confirm-password"
          label="Confirm Password"
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
              className="inline-flex text-[#888888] transition-colors hover:text-[#1A1A1A]"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
            </button>
          }
        />

        <AuthCheckbox
          id="register-marketing-opt-in"
          checked={marketingOptIn}
          onChange={setMarketingOptIn}
          label="Send me updates on new arrivals and offers"
        />

        {generalError ? <p className="mt-4 font-body text-[11px] text-[#C0392B]">{generalError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || isGoogleSubmitting}
          className="mt-8 w-full rounded-[2px] bg-[#1A1A1A] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[#F5F0E8] transition-colors duration-300 hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? "Please wait..." : "Create Account"}
        </button>
      </form>

      <p className="mt-6 font-body text-[12px] text-[#888888]">
        Already have an account?{" "}
        <Link to="/auth/login" className="text-[#1A1A1A] transition-colors hover:text-[#C4A882]">
          Sign in
        </Link>
      </p>
    </AuthPageLayout>
  );
};

export default Register;
