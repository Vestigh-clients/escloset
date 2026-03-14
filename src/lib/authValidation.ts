export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sanitizeInputText = (value: string): string => value.replace(/\s+/g, " ").trim();

export const getRequiredError = (label: string, value: string): string | undefined => {
  if (!sanitizeInputText(value)) {
    return `${label} is required`;
  }

  return undefined;
};

export const getEmailError = (value: string): string | undefined => {
  const requiredError = getRequiredError("Email", value);
  if (requiredError) {
    return requiredError;
  }

  if (!EMAIL_PATTERN.test(sanitizeInputText(value))) {
    return "Enter a valid email address";
  }

  return undefined;
};

export const getPasswordError = (value: string): string | undefined => {
  if (!value.trim()) {
    return "Password is required";
  }

  if (value.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
    return "Password must include uppercase, lowercase, and a number";
  }

  return undefined;
};

export const getConfirmPasswordError = (password: string, confirmPassword: string): string | undefined => {
  if (!confirmPassword.trim()) {
    return "Confirm password is required";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return undefined;
};

