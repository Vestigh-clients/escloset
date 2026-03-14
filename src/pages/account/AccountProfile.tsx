import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  updateAccountAvatarUrl,
  updateAccountPersonalDetails,
  updateMarketingPreference,
} from "@/services/accountService";
import { AccountInputField, AccountSelectField } from "@/components/account/AccountFields";
import { useAccountLayoutContext } from "./AccountLayout";

type ProfileField = "firstName" | "lastName" | "phone" | "dateOfBirth" | "gender";

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  marketingOptIn: boolean;
}

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const sanitizeInput = (value: string): string => value.replace(/\s+/g, " ").trim();
const toNullable = (value: string): string | null => {
  const normalized = sanitizeInput(value);
  return normalized ? normalized : null;
};

const validateForm = (values: ProfileFormValues): Partial<Record<ProfileField, string>> => {
  const errors: Partial<Record<ProfileField, string>> = {};

  if (!sanitizeInput(values.firstName)) {
    errors.firstName = "First name is required";
  }

  if (!sanitizeInput(values.lastName)) {
    errors.lastName = "Last name is required";
  }

  return errors;
};

const AccountProfile = () => {
  const { user, refreshAuthState } = useAuth();
  const { profile, refreshProfile } = useAccountLayoutContext();

  const [formValues, setFormValues] = useState<ProfileFormValues>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "prefer_not_to_say",
    marketingOptIn: false,
  });
  const [touched, setTouched] = useState<Record<ProfileField, boolean>>({
    firstName: false,
    lastName: false,
    phone: false,
    dateOfBirth: false,
    gender: false,
  });
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const marketingFromMetadata =
      typeof metadata.marketing_opt_in === "boolean" ? metadata.marketing_opt_in : false;

    setFormValues({
      firstName: profile?.first_name || "",
      lastName: profile?.last_name || "",
      email: profile?.email || user?.email || "",
      phone: profile?.phone || "",
      dateOfBirth: profile?.date_of_birth || "",
      gender: profile?.gender || "prefer_not_to_say",
      marketingOptIn: marketingFromMetadata,
    });
    setErrors({});
    setTouched({
      firstName: false,
      lastName: false,
      phone: false,
      dateOfBirth: false,
      gender: false,
    });
  }, [profile, user?.email, user?.user_metadata]);

  useEffect(() => {
    if (!showSavedMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowSavedMessage(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [showSavedMessage]);

  const markTouched = (field: ProfileField) => {
    setTouched((previous) => ({
      ...previous,
      [field]: true,
    }));

    setErrors(validateForm(formValues));
  };

  const handleAvatarSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setAvatarError(null);

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Only JPG, PNG, or WEBP files are allowed.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError("Image must be 2MB or smaller.");
      return;
    }

    if (!user?.id) {
      setAvatarError("You need to be signed in to upload a photo.");
      return;
    }

    setIsAvatarUploading(true);

    try {
      const path = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateAccountAvatarUrl(user.id, data.publicUrl);
      await refreshProfile();
      setAvatarVersion(Date.now());
    } catch {
      setAvatarError("We couldn't upload your photo right now.");
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) {
      return;
    }

    const nextTouched: Record<ProfileField, boolean> = {
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
    };
    const nextErrors = validateForm(formValues);

    setTouched(nextTouched);
    setErrors(nextErrors);
    setSubmitError(null);
    setShowSavedMessage(false);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await updateAccountPersonalDetails(user.id, {
        first_name: sanitizeInput(formValues.firstName),
        last_name: sanitizeInput(formValues.lastName),
        phone: toNullable(formValues.phone),
        date_of_birth: toNullable(formValues.dateOfBirth),
        gender: formValues.gender === "prefer_not_to_say" ? "prefer_not_to_say" : (formValues.gender as "male" | "female"),
      });

      await updateMarketingPreference(formValues.marketingOptIn);
      await refreshAuthState();
      await refreshProfile();
      setShowSavedMessage(true);
    } catch {
      setSubmitError("We couldn't save your changes right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const avatarInitial = useMemo(() => {
    const firstName = sanitizeInput(formValues.firstName);
    if (firstName) {
      return firstName.slice(0, 1).toUpperCase();
    }

    return (formValues.email.slice(0, 1) || "U").toUpperCase();
  }, [formValues.email, formValues.firstName]);

  const avatarUrl = profile?.avatar_url
    ? `${profile.avatar_url}${profile.avatar_url.includes("?") ? "&" : "?"}v=${avatarVersion}`
    : null;

  return (
    <div>
      <h1 className="font-display text-[42px] italic text-[#1A1A1A]">Personal Details</h1>

      <form onSubmit={handleSubmit} className="mt-8">
        <div className="mb-8">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#1A1A1A]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="font-body text-[30px] text-[#F5F0E8]">{avatarInitial}</span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => void handleAvatarSelection(event)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAvatarUploading}
            className="mt-3 font-body text-[10px] uppercase tracking-[0.12em] text-[#C4A882] transition-colors hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAvatarUploading ? "Uploading..." : "Change Photo"}
          </button>

          {avatarError ? <p className="mt-2 font-body text-[11px] text-[#C0392B]">{avatarError}</p> : null}
        </div>

        <div className="grid gap-x-6 md:grid-cols-2">
          <AccountInputField
            id="profile-first-name"
            label="First Name"
            required
            value={formValues.firstName}
            touched={touched.firstName}
            error={errors.firstName}
            onChange={(value) => setFormValues((previous) => ({ ...previous, firstName: value }))}
            onBlur={() => markTouched("firstName")}
          />

          <AccountInputField
            id="profile-last-name"
            label="Last Name"
            required
            value={formValues.lastName}
            touched={touched.lastName}
            error={errors.lastName}
            onChange={(value) => setFormValues((previous) => ({ ...previous, lastName: value }))}
            onBlur={() => markTouched("lastName")}
          />

          <AccountInputField
            id="profile-email"
            label="Email"
            value={formValues.email}
            readOnly
            helperText="Contact support to change email"
            onChange={() => undefined}
            onBlur={() => undefined}
          />

          <AccountInputField
            id="profile-phone"
            label="Phone"
            value={formValues.phone}
            touched={touched.phone}
            error={errors.phone}
            onChange={(value) => setFormValues((previous) => ({ ...previous, phone: value }))}
            onBlur={() => markTouched("phone")}
          />

          <AccountInputField
            id="profile-date-of-birth"
            type="date"
            label="Date of Birth"
            value={formValues.dateOfBirth}
            touched={touched.dateOfBirth}
            error={errors.dateOfBirth}
            onChange={(value) => setFormValues((previous) => ({ ...previous, dateOfBirth: value }))}
            onBlur={() => markTouched("dateOfBirth")}
          />

          <AccountSelectField
            id="profile-gender"
            label="Gender"
            value={formValues.gender}
            touched={touched.gender}
            error={errors.gender}
            options={[
              { value: "prefer_not_to_say", label: "Prefer not to say" },
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ]}
            onChange={(value) => setFormValues((previous) => ({ ...previous, gender: value }))}
            onBlur={() => markTouched("gender")}
          />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={formValues.marketingOptIn}
            onClick={() =>
              setFormValues((previous) => ({
                ...previous,
                marketingOptIn: !previous.marketingOptIn,
              }))
            }
            className={`relative h-[22px] w-[42px] rounded-full transition-colors ${
              formValues.marketingOptIn ? "bg-[#1A1A1A]" : "bg-[#d4ccc2]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-transform ${
                formValues.marketingOptIn ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>

          <p className="font-body text-[12px] text-[#888888]">Receive updates on new arrivals and offers</p>
        </div>

        {submitError ? <p className="mt-4 font-body text-[11px] text-[#C0392B]">{submitError}</p> : null}
        <p
          className={`mt-4 font-body text-[12px] text-[#C4A882] transition-opacity duration-500 ${
            showSavedMessage ? "opacity-100" : "opacity-0"
          }`}
        >
          Changes saved.
        </p>

        <button
          type="submit"
          disabled={isSaving}
          className="mt-8 rounded-[2px] bg-[#1A1A1A] px-8 py-3 font-body text-[11px] uppercase tracking-[0.14em] text-[#F5F0E8] transition-colors hover:bg-[#C4A882] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
};

export default AccountProfile;
