import { useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import AuthCheckbox from "@/components/auth/AuthCheckbox";
import AuthInputField from "@/components/auth/AuthInputField";
import AuthPageLayout from "@/components/auth/AuthPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { GHANAIAN_PHONE_HELPER_TEXT, getGhanaianPhoneError } from "@/lib/phoneValidation";
import {
  getConfirmPasswordError,
  getEmailError,
  getPasswordError,
  getRequiredError,
  sanitizeInputText,
} from "@/lib/authValidation";
import { buildAuthModalSearch, buildPathWithSearch } from "@/lib/authModal";
import { AuthServiceError } from "@/services/authService";

type RegisterField = "firstName" | "lastName" | "email" | "phone" | "password" | "confirmPassword";

const Register = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [touched, setTouched] = useState<Record<RegisterField, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
  });
  const [errors, setErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldErrors = useMemo(
    () => ({
      firstName: getRequiredError("First name", firstName),
      lastName: getRequiredError("Last name", lastName),
      email: getEmailError(email),
      phone: getGhanaianPhoneError(phone),
      password: getPasswordError(password),
      confirmPassword: getConfirmPasswordError(password, confirmPassword),
    }),
    [firstName, lastName, email, phone, password, confirmPassword],
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
      phone: true,
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
        phone: sanitizeInputText(phone),
        password,
        marketingOptIn,
      });

      navigate(
        buildPathWithSearch(
          location.pathname,
          buildAuthModalSearch(location.search, {
            mode: "login",
            justRegistered: true,
            email: normalizedEmail,
          }),
          location.hash,
        ),
        {
        replace: true,
        },
      );
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

  return (
    <AuthPageLayout showPanelImage={false}>
      <h1 className="font-display text-[42px] italic leading-none text-[var(--color-primary)]">Create your account</h1>
      <p className="mt-3 font-body text-[13px] font-light leading-[1.8] text-[var(--color-muted)]">
        Sign up to save your details, check out faster, and track your orders.
      </p>

      <form onSubmit={handleSubmit} className="mt-8" noValidate>
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
          id="register-phone"
          label="Phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          onBlur={() => markTouched("phone")}
          autoComplete="tel"
          touched={touched.phone}
          error={errors.phone}
          helperText={GHANAIAN_PHONE_HELPER_TEXT}
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
              className="inline-flex text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
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
              className="inline-flex text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
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

        {generalError ? <p className="mt-4 font-body text-[11px] text-[var(--color-danger)]">{generalError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 w-full rounded-[var(--border-radius)] bg-[var(--color-primary)] px-4 py-[18px] font-body text-[11px] uppercase tracking-[0.18em] text-[var(--color-secondary)] transition-colors duration-300 hover:bg-[var(--color-accent)] hover:text-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? "Please wait..." : "Create Account"}
        </button>
      </form>

      <p className="mt-6 font-body text-[12px] text-[var(--color-muted)]">
        Already have an account?{" "}
        <Link
          to={buildPathWithSearch(
            location.pathname,
            buildAuthModalSearch(location.search, {
              mode: "login",
              justRegistered: false,
              email: null,
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

export default Register;


