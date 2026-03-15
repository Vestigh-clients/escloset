import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AccountInputField } from "@/components/account/AccountFields";
import { useAuth } from "@/contexts/AuthContext";
import { getConfirmPasswordError, getPasswordError } from "@/lib/authValidation";
import { updateAccountPassword, verifyCurrentPassword } from "@/services/accountService";

type PasswordField = "currentPassword" | "newPassword" | "confirmNewPassword";

const getCurrentPasswordError = (value: string): string | undefined => {
  if (!value.trim()) {
    return "Current password is required";
  }

  return undefined;
};

const getCurrentPasswordFailureMessage = (error: unknown): string => {
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();

  if (message.includes("invalid login credentials") || message.includes("invalid_credentials")) {
    return "Current password is incorrect.";
  }

  return "We couldn't update your password right now.";
};

const AccountPassword = () => {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<Record<PasswordField, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  });
  const [errors, setErrors] = useState<Partial<Record<PasswordField, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldErrors = useMemo(
    () => ({
      currentPassword: getCurrentPasswordError(currentPassword),
      newPassword: getPasswordError(newPassword),
      confirmNewPassword: getConfirmPasswordError(newPassword, confirmNewPassword),
    }),
    [currentPassword, newPassword, confirmNewPassword],
  );

  const markTouched = (field: PasswordField) => {
    setTouched((previous) => ({
      ...previous,
      [field]: true,
    }));

    setErrors((previous) => ({
      ...previous,
      [field]: fieldErrors[field],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nextTouched: Record<PasswordField, boolean> = {
      currentPassword: true,
      newPassword: true,
      confirmNewPassword: true,
    };
    setTouched(nextTouched);
    setErrors(fieldErrors);

    if (Object.values(fieldErrors).some(Boolean)) {
      return;
    }

    if (!user?.email) {
      setSubmitError("We couldn't verify your account email.");
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyCurrentPassword(user.email, currentPassword);
      await updateAccountPassword(newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTouched({
        currentPassword: false,
        newPassword: false,
        confirmNewPassword: false,
      });
      setErrors({});
      setSuccessMessage("Password updated successfully.");
    } catch (error) {
      setSubmitError(getCurrentPasswordFailureMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-[42px] italic text-[#1A1A1A]">Change Password</h1>

      <form onSubmit={handleSubmit} className="mt-8 max-w-[400px]">
        <AccountInputField
          id="account-current-password"
          type={showCurrentPassword ? "text" : "password"}
          label="Current Password"
          required
          value={currentPassword}
          touched={touched.currentPassword}
          error={errors.currentPassword}
          onChange={setCurrentPassword}
          onBlur={() => markTouched("currentPassword")}
          trailingControl={
            <button
              type="button"
              onClick={() => setShowCurrentPassword((previous) => !previous)}
              className="inline-flex text-[#555555] transition-colors hover:text-[#1A1A1A]"
              aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
            >
              {showCurrentPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
            </button>
          }
        />

        <AccountInputField
          id="account-new-password"
          type={showNewPassword ? "text" : "password"}
          label="New Password"
          required
          value={newPassword}
          touched={touched.newPassword}
          error={errors.newPassword}
          onChange={setNewPassword}
          onBlur={() => markTouched("newPassword")}
          trailingControl={
            <button
              type="button"
              onClick={() => setShowNewPassword((previous) => !previous)}
              className="inline-flex text-[#555555] transition-colors hover:text-[#1A1A1A]"
              aria-label={showNewPassword ? "Hide new password" : "Show new password"}
            >
              {showNewPassword ? <EyeOff size={16} strokeWidth={1.35} /> : <Eye size={16} strokeWidth={1.35} />}
            </button>
          }
        />

        <AccountInputField
          id="account-confirm-new-password"
          type={showConfirmPassword ? "text" : "password"}
          label="Confirm New Password"
          required
          value={confirmNewPassword}
          touched={touched.confirmNewPassword}
          error={errors.confirmNewPassword}
          onChange={setConfirmNewPassword}
          onBlur={() => markTouched("confirmNewPassword")}
          trailingControl={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((previous) => !previous)}
              className="inline-flex text-[#555555] transition-colors hover:text-[#1A1A1A]"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? (
                <EyeOff size={16} strokeWidth={1.35} />
              ) : (
                <Eye size={16} strokeWidth={1.35} />
              )}
            </button>
          }
        />

        {submitError ? <p className="mt-4 font-body text-[11px] text-[#C0392B]">{submitError}</p> : null}
        {successMessage ? <p className="mt-4 font-body text-[12px] text-[#C4A882]">{successMessage}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 rounded-[2px] bg-[#1A1A1A] px-8 py-3 font-body text-[11px] uppercase tracking-[0.14em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
};

export default AccountPassword;

