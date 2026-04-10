import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const readEnv = (key: string): string => {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  const fromImportMeta = import.meta.env?.[key] as string | undefined;
  const value = fromProcess || fromImportMeta;

  if (!value?.trim()) {
    throw new Error(`${key} is required for prerendering`);
  }

  return value.trim();
};

export const createSupabaseServerClient = () =>
  createClient<Database>(readEnv("VITE_SUPABASE_URL"), readEnv("VITE_SUPABASE_PUBLISHABLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
