export const GHANAIAN_PHONE_HELPER_TEXT = "e.g. 024 123 4567 or +233 24 123 4567";

export const validateGhanaianPhone = (phone: string): boolean => {
  // Ghana mobile numbers:
  // Local format:  0XX XXX XXXX (10 digits)
  // International: +233XX XXX XXXX
  // Networks: 020, 023, 024, 025, 026,
  //           027, 028, 029, 050, 054,
  //           055, 056, 057, 059
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  const localFormat = /^0[2-5][0-9]{8}$/;
  const intlFormat = /^\+233[2-5][0-9]{8}$/;
  return localFormat.test(cleaned) || intlFormat.test(cleaned);
};

export const getGhanaianPhoneError = (phone: string): string | undefined => {
  const trimmed = phone.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!validateGhanaianPhone(trimmed)) {
    return "Enter a valid Ghanaian phone number";
  }

  return undefined;
};
