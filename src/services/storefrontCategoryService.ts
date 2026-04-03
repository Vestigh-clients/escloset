import { supabase } from "@/integrations/supabase/client";

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  displayOrder: number | null;
}

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const fetchStorefrontCategories = async (): Promise<StorefrontCategory[]> => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, description, image_url, display_order, is_active")
    .eq("is_active", true)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const seenSlugs = new Set<string>();

  return (data ?? [])
    .map((row) => {
      const slug = normalizeString(row.slug).toLowerCase();
      if (!slug || seenSlugs.has(slug)) {
        return null;
      }

      seenSlugs.add(slug);
      return {
        id: normalizeString(row.id),
        name: normalizeString(row.name) || "Category",
        slug,
        description: normalizeString(row.description),
        imageUrl: normalizeString(row.image_url) || null,
        displayOrder: typeof row.display_order === "number" ? row.display_order : null,
      } satisfies StorefrontCategory;
    })
    .filter((category): category is StorefrontCategory => Boolean(category));
};
