import { supabase } from "@/integrations/supabase/client";

const PUBLIC_SITE_SETTING_KEYS = [
  "site_name",
  "site_tagline",
  "support_email",
  "support_phone",
  "whatsapp_number",
  "site_theme_preset",
  "review_moderation_required",
] as const;

export interface PublicSiteSettings {
  siteName?: string;
  siteTagline?: string;
  supportEmail?: string;
  supportPhone?: string;
  whatsappNumber?: string;
  siteThemePreset?: string;
  reviewModerationRequired?: boolean;
}

const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "yes", "on"]);

type SupabaseQueryClient = typeof supabase;

export const fetchPublicSiteSettings = async (client: SupabaseQueryClient = supabase): Promise<PublicSiteSettings> => {
  const { data, error } = await client
    .from("site_settings")
    .select("key, value")
    .in("key", [...PUBLIC_SITE_SETTING_KEYS]);

  if (error) {
    throw error;
  }

  const values = new Map<string, string>(
    ((data ?? []) as Array<{ key: unknown; value: unknown }>).map((row) => [
      typeof row.key === "string" ? row.key : "",
      typeof row.value === "string" ? row.value.trim() : "",
    ]),
  );

  return {
    siteName: values.get("site_name") || undefined,
    siteTagline: values.get("site_tagline") || undefined,
    supportEmail: values.get("support_email") || undefined,
    supportPhone: values.get("support_phone") || undefined,
    whatsappNumber: values.get("whatsapp_number") || undefined,
    siteThemePreset: values.get("site_theme_preset") || undefined,
    reviewModerationRequired: BOOLEAN_TRUE_VALUES.has((values.get("review_moderation_required") || "").toLowerCase()),
  };
};
