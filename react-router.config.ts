import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

const loadedEnv = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");
for (const [key, value] of Object.entries(loadedEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const readPrerenderEnv = (key: string) => {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`${key} is required for prerendering`);
  }

  return value.trim();
};

const fetchAllActiveProductSlugsForPrerender = async () => {
  const supabase = createClient(
    readPrerenderEnv("VITE_SUPABASE_URL"),
    readPrerenderEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data, error } = await supabase
    .from("products_with_stock")
    .select("slug")
    .eq("is_available", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => (typeof row.slug === "string" ? row.slug.trim() : ""))
    .filter((slug): slug is string => Boolean(slug));
};

export default {
  appDirectory: "src",
  ssr: false,
  presets: [vercelPreset()],
  async prerender() {
    const slugs = await fetchAllActiveProductSlugsForPrerender();
    if (slugs.length === 0) {
      throw new Error("No product slugs returned - aborting build");
    }

    return ["/", "/shop", "/about", "/contact", ...slugs.map((slug) => `/shop/${slug}`)];
  },
} satisfies Config;
