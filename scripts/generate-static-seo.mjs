import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const mode = process.env.NODE_ENV || "production";
const envFiles = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];

for (const fileName of envFiles) {
  const filePath = path.join(rootDir, fileName);
  if (!existsSync(filePath)) {
    continue;
  }

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    const rawValue = match[2].trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const readRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`${key} is required to generate static SEO files`);
  }

  return value.trim();
};

const escapeXml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const siteUrl = readRequiredEnv("VITE_SITE_URL").replace(/\/+$/, "");
const supabase = createClient(
  readRequiredEnv("VITE_SUPABASE_URL"),
  readRequiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
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

const productPaths = (data ?? [])
  .map((row) => (typeof row.slug === "string" ? row.slug.trim() : ""))
  .filter(Boolean)
  .map((slug) => `/shop/${slug}`);

if (productPaths.length === 0) {
  throw new Error("No product slugs returned - aborting static SEO generation");
}

const paths = ["/", "/shop", "/about", "/contact", ...productPaths];
const clientDir = path.join(rootDir, "build", "client");
mkdirSync(clientDir, { recursive: true });

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...paths.map((urlPath) => `  <url><loc>${escapeXml(`${siteUrl}${urlPath}`)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");

const robots = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /admin",
  "Disallow: /account",
  "Disallow: /checkout",
  `Sitemap: ${siteUrl}/sitemap.xml`,
  "",
].join("\n");

writeFileSync(path.join(clientDir, "sitemap.xml"), sitemap, "utf8");
writeFileSync(path.join(clientDir, "robots.txt"), robots, "utf8");
