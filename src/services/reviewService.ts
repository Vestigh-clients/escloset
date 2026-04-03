import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type ReviewStatus = "pending" | "approved" | "rejected";

interface ProductReviewRow {
  id: string;
  product_id: string;
  customer_id: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  author_display_name: string;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  authorDisplayName: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewSummary {
  averageRating: number;
  totalReviews: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ProductReviewListResult {
  reviews: ProductReview[];
  summary: ProductReviewSummary;
}

export interface SubmitProductReviewInput {
  productId: string;
  customerId: string;
  rating: number;
  title?: string;
  body: string;
  authorDisplayName: string;
}

export interface SubmitProductReviewResult {
  review: ProductReview;
  moderationRequired: boolean;
}

export interface AdminProductReviewRow {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  authorDisplayName: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}

export interface AdminProductReviewFilters {
  searchTerm?: string;
  status?: "all" | ReviewStatus;
  page?: number;
  pageSize?: number;
}

export interface AdminProductReviewListResult {
  rows: AdminProductReviewRow[];
  totalCount: number;
}

const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "yes", "on"]);

const parseBooleanSetting = (value: unknown, fallback: boolean) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return BOOLEAN_TRUE_VALUES.has(normalized);
};

const readEmbeddedRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
};

const toReview = (row: ProductReviewRow): ProductReview => ({
  id: row.id,
  productId: row.product_id,
  customerId: row.customer_id,
  rating: Number(row.rating) || 0,
  title: row.title,
  body: row.body,
  status: row.status,
  authorDisplayName: row.author_display_name,
  approvedAt: row.approved_at,
  rejectedAt: row.rejected_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const emptySummary = (): ProductReviewSummary => ({
  averageRating: 0,
  totalReviews: 0,
  distribution: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  },
});

const computeSummary = (reviews: ProductReview[]): ProductReviewSummary => {
  if (reviews.length === 0) {
    return emptySummary();
  }

  const distribution: ProductReviewSummary["distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let total = 0;
  for (const review of reviews) {
    const bounded = Math.max(1, Math.min(5, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[bounded] += 1;
    total += bounded;
  }

  return {
    averageRating: total / reviews.length,
    totalReviews: reviews.length,
    distribution,
  };
};

const escapeSearchTerm = (value: string) => value.replace(/[%_,]/g, "").trim();

export const fetchReviewModerationRequired = async (): Promise<boolean> => {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "review_moderation_required")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return parseBooleanSetting(data?.value, true);
};

export const fetchProductReviews = async (productId: string): Promise<ProductReviewListResult> => {
  const { data, error } = await (supabase as any)
    .from("product_reviews")
    .select("id, product_id, customer_id, rating, title, body, status, author_display_name, approved_at, rejected_at, created_at, updated_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const reviews = ((data ?? []) as ProductReviewRow[]).map(toReview);
  return {
    reviews,
    summary: computeSummary(reviews),
  };
};

export const fetchCustomerProductReview = async (
  productId: string,
  customerId: string,
): Promise<ProductReview | null> => {
  const { data, error } = await (supabase as any)
    .from("product_reviews")
    .select("id, product_id, customer_id, rating, title, body, status, author_display_name, approved_at, rejected_at, created_at, updated_at")
    .eq("product_id", productId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    return null;
  }

  return toReview(data as ProductReviewRow);
};

export const buildReviewerDisplayName = (user: User | null): string => {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const firstName =
    (typeof metadata.first_name === "string" ? metadata.first_name : "") ||
    (typeof metadata.given_name === "string" ? metadata.given_name : "");
  const lastName =
    (typeof metadata.last_name === "string" ? metadata.last_name : "") ||
    (typeof metadata.family_name === "string" ? metadata.family_name : "");

  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) {
    return fullName;
  }

  const fallbackName = (user?.email ?? "").split("@")[0]?.trim();
  if (fallbackName) {
    return fallbackName;
  }

  return "Customer";
};

export const submitProductReview = async (input: SubmitProductReviewInput): Promise<SubmitProductReviewResult> => {
  const moderationRequired = await fetchReviewModerationRequired();
  const status: ReviewStatus = moderationRequired ? "pending" : "approved";
  const nowIso = new Date().toISOString();

  const payload = {
    product_id: input.productId,
    customer_id: input.customerId,
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    title: input.title?.trim() || null,
    body: input.body.trim(),
    status,
    author_display_name: input.authorDisplayName.trim() || "Customer",
    approved_at: status === "approved" ? nowIso : null,
    rejected_at: null,
  };

  const { data, error } = await (supabase as any)
    .from("product_reviews")
    .insert(payload)
    .select("id, product_id, customer_id, rating, title, body, status, author_display_name, approved_at, rejected_at, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    review: toReview(data as ProductReviewRow),
    moderationRequired,
  };
};

export const fetchAdminProductReviews = async (
  filters: AdminProductReviewFilters,
): Promise<AdminProductReviewListResult> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  let query = (supabase as any)
    .from("product_reviews")
    .select(
      `
        id,
        product_id,
        customer_id,
        rating,
        title,
        body,
        status,
        author_display_name,
        approved_at,
        rejected_at,
        created_at,
        products ( name, slug ),
        customers ( first_name, last_name, email )
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const searchTerm = escapeSearchTerm(filters.searchTerm ?? "");
  if (searchTerm) {
    query = query.or(`title.ilike.%${searchTerm}%,body.ilike.%${searchTerm}%,author_display_name.ilike.%${searchTerm}%`);
  }

  const { data, count, error } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const rows: AdminProductReviewRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const productRecord = readEmbeddedRecord(row.products);
    const customerRecord = readEmbeddedRecord(row.customers);
    const firstName = typeof customerRecord?.first_name === "string" ? customerRecord.first_name : "";
    const lastName = typeof customerRecord?.last_name === "string" ? customerRecord.last_name : "";
    const customerName = `${firstName} ${lastName}`.trim() || "Customer";

    return {
      id: typeof row.id === "string" ? row.id : "",
      productId: typeof row.product_id === "string" ? row.product_id : "",
      productName: typeof productRecord?.name === "string" ? productRecord.name : "Unknown product",
      productSlug: typeof productRecord?.slug === "string" ? productRecord.slug : "",
      customerId: typeof row.customer_id === "string" ? row.customer_id : "",
      customerName,
      customerEmail: typeof customerRecord?.email === "string" ? customerRecord.email : "",
      rating: Number(row.rating) || 0,
      title: typeof row.title === "string" ? row.title : null,
      body: typeof row.body === "string" ? row.body : "",
      status: (row.status as ReviewStatus) ?? "pending",
      authorDisplayName: typeof row.author_display_name === "string" ? row.author_display_name : customerName,
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      approvedAt: typeof row.approved_at === "string" ? row.approved_at : null,
      rejectedAt: typeof row.rejected_at === "string" ? row.rejected_at : null,
    };
  });

  return {
    rows,
    totalCount: count ?? 0,
  };
};

export const updateAdminProductReviewStatus = async (reviewId: string, status: ReviewStatus) => {
  const nowIso = new Date().toISOString();
  const payload =
    status === "approved"
      ? { status, approved_at: nowIso, rejected_at: null }
      : status === "rejected"
        ? { status, approved_at: null, rejected_at: nowIso }
        : { status, approved_at: null, rejected_at: null };

  const { error } = await (supabase as any).from("product_reviews").update(payload).eq("id", reviewId);

  if (error) {
    throw error;
  }
};
