import { supabase } from "@/integrations/supabase/client";
import type { Database, Json, Tables } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export type AdminNotification = Tables<"admin_notifications">;

export interface AdminProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalRevenueTrend: number | null;
  ordersToday: number;
  ordersTodayTrend: number | null;
  ordersThisMonth: number;
  ordersThisMonthTrend: number | null;
  totalCustomers: number;
  totalCustomersTrend: number | null;
}

export type RevenuePeriod = "7d" | "30d" | "90d" | "12m";

export interface RevenuePoint {
  key: string;
  label: string;
  revenue: number;
}

export interface DashboardRecentOrder {
  id: string;
  order_number: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  customer_name: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface TopSellerProduct {
  id: string;
  name: string;
  image_url: string | null;
  total_orders: number;
  price: number;
}

export interface AdminOrdersFilters {
  searchTerm?: string;
  statusFilter?: "" | OrderStatus;
  paymentFilter?: "" | PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminOrderListItem {
  id: string;
  order_number: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  created_at: string;
  customer: {
    id: string | null;
    first_name: string;
    last_name: string;
    email: string;
  };
  items: number;
  item_names: string[];
  shipping_address_snapshot: Json;
}

export interface AdminOrderListResult {
  rows: AdminOrderListItem[];
  totalCount: number;
}

export interface AdminOrderDetail {
  id: string;
  order_number: string;
  customer_id: string;
  created_at: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_reference: string | null;
  mobile_money_number: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number | null;
  total: number;
  notes: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  shipping_address_snapshot: Json;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    total_orders: number | null;
    total_spent: number | null;
  };
  order_items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    product_sku: string | null;
    product_image_url: string | null;
    unit_price: number;
    compare_at_price: number | null;
    quantity: number;
    subtotal: number;
    variant_id: string | null;
    variant_label: string | null;
    variant_sku: string | null;
    product_slug: string | null;
  }>;
  order_status_history: Array<{
    previous_status: OrderStatus | null;
    new_status: OrderStatus;
    changed_by: string | null;
    note: string | null;
    notified_customer: boolean | null;
    changed_at: string;
  }>;
}

export interface AdminProductListFilters {
  searchTerm?: string;
  categorySlug?: string;
  availability?: "all" | "available" | "unavailable";
  page?: number;
  pageSize?: number;
}

export interface AdminProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number | null;
  is_available: boolean | null;
  is_featured: boolean | null;
  created_at: string;
  image_url: string | null;
  category_name: string | null;
  category_slug: string | null;
}

export interface AdminProductListResult {
  rows: AdminProductListItem[];
  totalCount: number;
}

export interface ProductImageObject {
  url: string;
  alt_text: string;
  is_primary: boolean;
  display_order: number;
}

export interface AdminCategoryWithCount {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  display_order: number | null;
  is_active: boolean | null;
  products_count: number;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const toIso = (date: Date) => date.toISOString();

const safeNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toTitleCase = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const mapMaybeEmbeddedRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    return value[0] && typeof value[0] === "object" ? (value[0] as Record<string, unknown>) : null;
  }

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
};

const parseImageObject = (entry: unknown): ProductImageObject | null => {
  if (typeof entry === "string" && entry.trim()) {
    return {
      url: entry.trim(),
      alt_text: "",
      is_primary: false,
      display_order: 0,
    };
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const urlCandidate = [record.url, record.image_url, record.src].find(
    (candidate) => typeof candidate === "string" && candidate.trim().length > 0,
  );

  if (!urlCandidate || typeof urlCandidate !== "string") {
    return null;
  }

  return {
    url: urlCandidate.trim(),
    alt_text: typeof record.alt_text === "string" ? record.alt_text : "",
    is_primary: record.is_primary === true || record.primary === true,
    display_order: Number.isFinite(Number(record.display_order)) ? Number(record.display_order) : 0,
  };
};

export const normalizeProductImages = (images: Json | null | undefined): ProductImageObject[] => {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((entry) => parseImageObject(entry))
    .filter((entry): entry is ProductImageObject => Boolean(entry))
    .sort((a, b) => a.display_order - b.display_order)
    .map((entry, index) => ({
      ...entry,
      display_order: index,
      is_primary: index === 0,
    }));
};

export const extractPrimaryImageUrl = (images: Json | null | undefined): string | null => {
  const normalized = normalizeProductImages(images);
  return normalized[0]?.url ?? null;
};

const escapeSearchTerm = (value: string) => value.replace(/[%_,]/g, "").trim();

const toTrend = (current: number, previous: number): number | null => {
  if (current <= 0 && previous <= 0) {
    return null;
  }

  if (previous <= 0) {
    return 100;
  }

  return ((current - previous) / previous) * 100;
};

const ensureDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const bucketByDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const bucketByMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatBucketLabel = (date: Date, byMonth: boolean) => {
  if (byMonth) {
    return date.toLocaleDateString("en-GH", {
      month: "short",
      year: "2-digit",
    });
  }

  return date.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
  });
};

const flattenAddress = (snapshot: Json) => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return "";
  }

  const record = snapshot as Record<string, unknown>;
  return [
    record.recipient_name,
    record.address_line1,
    record.address_line2,
    record.city,
    record.state,
    record.country,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => String(value).trim())
    .join(", ");
};

export const fetchAdminProfile = async (userId: string): Promise<AdminProfile | null> => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data;
};

export const fetchAdminNotifications = async (limit = 30): Promise<AdminNotification[]> => {
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchAdminUnreadNotificationsCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("admin_notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  if (error) {
    throw error;
  }

  return count ?? 0;
};

export const markAdminNotificationRead = async (id: string): Promise<void> => {
  const { error } = await supabase.from("admin_notifications").update({ is_read: true }).eq("id", id);

  if (error) {
    throw error;
  }
};

export const markAllAdminNotificationsRead = async (): Promise<void> => {
  const { error } = await supabase.from("admin_notifications").update({ is_read: true }).eq("is_read", false);

  if (error) {
    throw error;
  }
};

export const subscribeToAdminNotifications = (onInsert: (notification: AdminNotification) => void) => {
  const channel = supabase
    .channel(`admin_notifications_realtime_${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "admin_notifications",
      },
      (payload) => {
        onInsert(payload.new as AdminNotification);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};

export const logAdminActivity = async (
  action: string,
  targetTable: string | null,
  targetId: string | null,
  metadata: Json,
) => {
  const { error } = await supabase.rpc("log_admin_activity", {
    p_action: action,
    p_target_table: targetTable,
    p_target_id: targetId,
    p_metadata: metadata,
  });

  if (error) {
    throw error;
  }
};

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  const monthStart = startOfMonth(now);
  const previousMonthStart = addMonths(monthStart, -1);

  const [
    paidOrdersResult,
    ordersTodayResult,
    ordersYesterdayResult,
    ordersMonthResult,
    ordersPreviousMonthResult,
    totalCustomersResult,
    customersThisMonthResult,
    customersPreviousMonthResult,
  ] = await Promise.all([
    supabase.from("orders").select("total, created_at").eq("payment_status", "paid"),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", toIso(todayStart)),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", toIso(yesterdayStart))
      .lt("created_at", toIso(todayStart)),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", toIso(monthStart)),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", toIso(previousMonthStart))
      .lt("created_at", toIso(monthStart)),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .gte("created_at", toIso(monthStart)),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .gte("created_at", toIso(previousMonthStart))
      .lt("created_at", toIso(monthStart)),
  ]);

  if (paidOrdersResult.error) throw paidOrdersResult.error;
  if (ordersTodayResult.error) throw ordersTodayResult.error;
  if (ordersYesterdayResult.error) throw ordersYesterdayResult.error;
  if (ordersMonthResult.error) throw ordersMonthResult.error;
  if (ordersPreviousMonthResult.error) throw ordersPreviousMonthResult.error;
  if (totalCustomersResult.error) throw totalCustomersResult.error;
  if (customersThisMonthResult.error) throw customersThisMonthResult.error;
  if (customersPreviousMonthResult.error) throw customersPreviousMonthResult.error;

  const paidOrders = paidOrdersResult.data ?? [];
  const totalRevenue = paidOrders.reduce((sum, order) => sum + safeNumber(order.total), 0);

  const currentMonthRevenue = paidOrders.reduce((sum, order) => {
    const createdAt = ensureDate(order.created_at);
    if (!createdAt || createdAt < monthStart) {
      return sum;
    }
    return sum + safeNumber(order.total);
  }, 0);

  const previousMonthRevenue = paidOrders.reduce((sum, order) => {
    const createdAt = ensureDate(order.created_at);
    if (!createdAt || createdAt < previousMonthStart || createdAt >= monthStart) {
      return sum;
    }
    return sum + safeNumber(order.total);
  }, 0);

  const ordersToday = ordersTodayResult.count ?? 0;
  const ordersYesterday = ordersYesterdayResult.count ?? 0;
  const ordersThisMonth = ordersMonthResult.count ?? 0;
  const ordersPreviousMonth = ordersPreviousMonthResult.count ?? 0;
  const totalCustomers = totalCustomersResult.count ?? 0;
  const customersThisMonth = customersThisMonthResult.count ?? 0;
  const customersPreviousMonth = customersPreviousMonthResult.count ?? 0;

  return {
    totalRevenue,
    totalRevenueTrend: toTrend(currentMonthRevenue, previousMonthRevenue),
    ordersToday,
    ordersTodayTrend: toTrend(ordersToday, ordersYesterday),
    ordersThisMonth,
    ordersThisMonthTrend: toTrend(ordersThisMonth, ordersPreviousMonth),
    totalCustomers,
    totalCustomersTrend: toTrend(customersThisMonth, customersPreviousMonth),
  };
};

const periodStartByKey = (period: RevenuePeriod) => {
  const now = new Date();
  if (period === "7d") return startOfDay(addDays(now, -6));
  if (period === "30d") return startOfDay(addDays(now, -29));
  if (period === "90d") return startOfDay(addDays(now, -89));
  return startOfMonth(addMonths(now, -11));
};

export const fetchRevenueOverview = async (period: RevenuePeriod): Promise<RevenuePoint[]> => {
  const startDate = periodStartByKey(period);
  const byMonth = period === "12m";
  const { data, error } = await supabase
    .from("orders")
    .select("total, created_at")
    .eq("payment_status", "paid")
    .gte("created_at", toIso(startDate))
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const totals = new Map<string, number>();

  for (const row of data ?? []) {
    const createdAt = ensureDate(row.created_at);
    if (!createdAt) continue;
    const key = byMonth ? bucketByMonth(createdAt) : bucketByDay(createdAt);
    totals.set(key, (totals.get(key) ?? 0) + safeNumber(row.total));
  }

  const points: RevenuePoint[] = [];
  const now = new Date();

  if (byMonth) {
    let cursor = startOfMonth(startDate);
    const endMonth = startOfMonth(now);

    while (cursor <= endMonth) {
      const key = bucketByMonth(cursor);
      points.push({
        key,
        label: formatBucketLabel(cursor, true),
        revenue: totals.get(key) ?? 0,
      });
      cursor = startOfMonth(addMonths(cursor, 1));
    }

    return points;
  }

  let cursor = startOfDay(startDate);
  const endDay = startOfDay(now);

  while (cursor <= endDay) {
    const key = bucketByDay(cursor);
    points.push({
      key,
      label: formatBucketLabel(cursor, false),
      revenue: totals.get(key) ?? 0,
    });
    cursor = startOfDay(addDays(cursor, 1));
  }

  return points;
};

export const fetchDashboardRecentOrders = async (): Promise<DashboardRecentOrder[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      total,
      status,
      created_at,
      customers ( first_name, last_name )
    `)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const customer = mapMaybeEmbeddedRecord(row.customers);
    const firstName = typeof customer?.first_name === "string" ? customer.first_name : "Customer";
    const lastName = typeof customer?.last_name === "string" ? customer.last_name : "";

    return {
      id: row.id,
      order_number: row.order_number,
      total: safeNumber(row.total),
      status: row.status,
      created_at: row.created_at,
      customer_name: `${firstName} ${lastName}`.trim(),
    };
  });
};

export const fetchLowStockProducts = async (): Promise<LowStockProduct[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, images, stock_quantity, low_stock_threshold")
    .order("stock_quantity", { ascending: true })
    .limit(60);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      image_url: extractPrimaryImageUrl(row.images),
      stock_quantity: safeNumber(row.stock_quantity),
      low_stock_threshold: safeNumber(row.low_stock_threshold ?? 5),
    }))
    .filter((product) => product.stock_quantity <= product.low_stock_threshold)
    .slice(0, 10);
};

export const fetchTopSellerProducts = async (): Promise<TopSellerProduct[]> => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, images, total_orders, price")
    .order("total_orders", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    image_url: extractPrimaryImageUrl(row.images),
    total_orders: safeNumber(row.total_orders),
    price: safeNumber(row.price),
  }));
};

const buildOrdersBaseQuery = (filters: AdminOrdersFilters) => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  let query = supabase.from("orders").select(
    `
      id,
      order_number,
      total,
      subtotal,
      shipping_fee,
      discount_amount,
      status,
      payment_status,
      payment_method,
      created_at,
      shipping_address_snapshot,
      customers!inner ( id, first_name, last_name, email ),
      order_items ( id, product_name, quantity )
    `,
    { count: "exact" },
  );

  if (filters.statusFilter) {
    query = query.eq("status", filters.statusFilter);
  }

  if (filters.paymentFilter) {
    query = query.eq("payment_status", filters.paymentFilter);
  }

  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
  }

  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`);
  }

  if (filters.searchTerm?.trim()) {
    const safeSearchTerm = escapeSearchTerm(filters.searchTerm);
    if (safeSearchTerm) {
      query = query.or(
        `order_number.ilike.%${safeSearchTerm}%,customers.first_name.ilike.%${safeSearchTerm}%,customers.last_name.ilike.%${safeSearchTerm}%,customers.email.ilike.%${safeSearchTerm}%`,
      );
    }
  }

  query = query.order("created_at", { ascending: false });

  return {
    query,
    page,
    pageSize,
    offset,
  };
};

const mapOrderRow = (row: Record<string, unknown>): AdminOrderListItem => {
  const customer = mapMaybeEmbeddedRecord(row.customers);
  const orderItems = Array.isArray(row.order_items) ? row.order_items : [];
  const itemNames = orderItems
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).product_name : null))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return {
    id: String(row.id ?? ""),
    order_number: String(row.order_number ?? ""),
    total: safeNumber(row.total),
    subtotal: safeNumber(row.subtotal),
    shipping_fee: safeNumber(row.shipping_fee),
    discount_amount:
      row.discount_amount === null || row.discount_amount === undefined ? null : safeNumber(row.discount_amount),
    status: String(row.status ?? "pending") as OrderStatus,
    payment_status: String(row.payment_status ?? "unpaid") as PaymentStatus,
    payment_method: typeof row.payment_method === "string" ? row.payment_method : null,
    created_at: String(row.created_at ?? ""),
    customer: {
      id: typeof customer?.id === "string" ? customer.id : null,
      first_name: typeof customer?.first_name === "string" ? customer.first_name : "",
      last_name: typeof customer?.last_name === "string" ? customer.last_name : "",
      email: typeof customer?.email === "string" ? customer.email : "",
    },
    items: orderItems.length,
    item_names: itemNames,
    shipping_address_snapshot: (row.shipping_address_snapshot as Json) ?? {},
  };
};

export const fetchAdminOrders = async (filters: AdminOrdersFilters): Promise<AdminOrderListResult> => {
  const { query, pageSize, offset } = buildOrdersBaseQuery(filters);

  const { data, count, error } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []).map((row) => mapOrderRow(row as unknown as Record<string, unknown>));
  return {
    rows,
    totalCount: count ?? 0,
  };
};

export const fetchAdminOrdersForExport = async (filters: AdminOrdersFilters): Promise<AdminOrderListItem[]> => {
  const { query } = buildOrdersBaseQuery(filters);

  const { data, error } = await query.limit(5000);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapOrderRow(row as unknown as Record<string, unknown>));
};

export const buildOrdersCsv = (rows: AdminOrderListItem[]): string => {
  const header = [
    "Order #",
    "Date",
    "Customer Name",
    "Customer Email",
    "Items",
    "Subtotal",
    "Shipping",
    "Discount",
    "Total",
    "Payment Method",
    "Payment Status",
    "Order Status",
    "Delivery Address",
  ];

  const escapeCell = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : String(value);
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const lines = rows.map((row) =>
    [
      row.order_number,
      row.created_at,
      `${row.customer.first_name} ${row.customer.last_name}`.trim(),
      row.customer.email,
      row.items,
      row.subtotal,
      row.shipping_fee,
      row.discount_amount ?? 0,
      row.total,
      row.payment_method ? toTitleCase(row.payment_method) : "Not specified",
      toTitleCase(row.payment_status),
      toTitleCase(row.status),
      flattenAddress(row.shipping_address_snapshot),
    ]
      .map(escapeCell)
      .join(","),
  );

  return [header.map((value) => `"${value}"`).join(","), ...lines].join("\n");
};

export const fetchAdminOrderDetail = async (orderNumber: string): Promise<AdminOrderDetail> => {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      customers (
        id,
        first_name,
        last_name,
        email,
        phone,
        total_orders,
        total_spent
      ),
      order_items (
        id,
        product_id,
        product_name,
        product_sku,
        product_image_url,
        unit_price,
        compare_at_price,
        quantity,
        subtotal,
        variant_id,
        variant_label,
        variant_sku,
        products ( id, slug )
      ),
      order_status_history (
        previous_status,
        new_status,
        changed_by,
        note,
        notified_customer,
        changed_at
      )
    `,
    )
    .eq("order_number", orderNumber)
    .single();

  if (error) {
    throw error;
  }

  const customer = mapMaybeEmbeddedRecord(data.customers);
  const items = Array.isArray(data.order_items) ? data.order_items : [];
  const historyRows = Array.isArray(data.order_status_history) ? data.order_status_history : [];

  const orderItems = items.map((item) => {
    const itemRecord = item as Record<string, unknown>;
    const product = mapMaybeEmbeddedRecord(itemRecord.products);

    return {
      id: String(itemRecord.id ?? ""),
      product_id: String(itemRecord.product_id ?? ""),
      product_name: String(itemRecord.product_name ?? ""),
      product_sku: typeof itemRecord.product_sku === "string" ? itemRecord.product_sku : null,
      product_image_url: typeof itemRecord.product_image_url === "string" ? itemRecord.product_image_url : null,
      unit_price: safeNumber(itemRecord.unit_price),
      compare_at_price:
        itemRecord.compare_at_price === null || itemRecord.compare_at_price === undefined
          ? null
          : safeNumber(itemRecord.compare_at_price),
      quantity: safeNumber(itemRecord.quantity),
      subtotal: safeNumber(itemRecord.subtotal),
      variant_id: typeof itemRecord.variant_id === "string" ? itemRecord.variant_id : null,
      variant_label: typeof itemRecord.variant_label === "string" ? itemRecord.variant_label : null,
      variant_sku: typeof itemRecord.variant_sku === "string" ? itemRecord.variant_sku : null,
      product_slug: typeof product?.slug === "string" ? product.slug : null,
    };
  });

  const orderHistory = historyRows
    .map((entry) => {
      const row = entry as Record<string, unknown>;
      return {
        previous_status: (row.previous_status ?? null) as OrderStatus | null,
        new_status: String(row.new_status ?? "pending") as OrderStatus,
        changed_by: typeof row.changed_by === "string" ? row.changed_by : null,
        note: typeof row.note === "string" ? row.note : null,
        notified_customer: typeof row.notified_customer === "boolean" ? row.notified_customer : null,
        changed_at: String(row.changed_at ?? ""),
      };
    })
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

  return {
    id: data.id,
    order_number: data.order_number,
    customer_id: data.customer_id,
    created_at: data.created_at,
    status: data.status,
    payment_status: data.payment_status,
    payment_method: data.payment_method,
    payment_reference: data.payment_reference,
    mobile_money_number: data.mobile_money_number,
    subtotal: safeNumber(data.subtotal),
    shipping_fee: safeNumber(data.shipping_fee),
    discount_amount: data.discount_amount === null ? null : safeNumber(data.discount_amount),
    total: safeNumber(data.total),
    notes: data.notes,
    cancel_reason: data.cancel_reason,
    cancelled_at: data.cancelled_at,
    shipping_address_snapshot: data.shipping_address_snapshot,
    customer: {
      id: typeof customer?.id === "string" ? customer.id : data.customer_id,
      first_name: typeof customer?.first_name === "string" ? customer.first_name : "",
      last_name: typeof customer?.last_name === "string" ? customer.last_name : "",
      email: typeof customer?.email === "string" ? customer.email : "",
      phone: typeof customer?.phone === "string" ? customer.phone : null,
      total_orders:
        customer?.total_orders === null || customer?.total_orders === undefined
          ? null
          : safeNumber(customer.total_orders),
      total_spent:
        customer?.total_spent === null || customer?.total_spent === undefined
          ? null
          : safeNumber(customer.total_spent),
    },
    order_items: orderItems,
    order_status_history: orderHistory,
  };
};

interface UpdateOrderStatusInput {
  order: AdminOrderDetail;
  nextStatus: OrderStatus;
  note: string;
  notifyCustomer: boolean;
  adminEmail: string;
}

export const updateAdminOrderStatus = async ({
  order,
  nextStatus,
  note,
  notifyCustomer,
  adminEmail,
}: UpdateOrderStatusInput) => {
  const trimmedNote = note.trim();
  const nowIso = new Date().toISOString();
  const updates: Database["public"]["Tables"]["orders"]["Update"] = {
    status: nextStatus,
    updated_at: nowIso,
  };

  if (nextStatus === "delivered") {
    updates.delivered_at = nowIso;
  }

  const { error: orderError } = await supabase.from("orders").update(updates).eq("id", order.id);
  if (orderError) {
    throw orderError;
  }

  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    previous_status: order.status,
    new_status: nextStatus,
    changed_by: adminEmail,
    note: trimmedNote || null,
    notified_customer: notifyCustomer,
  });

  if (historyError) {
    throw historyError;
  }

  if (notifyCustomer) {
    const { error: emailError } = await supabase.functions.invoke("send_order_status_update_email", {
      body: {
        order_number: order.order_number,
        new_status: nextStatus,
        cancel_reason: nextStatus === "cancelled" && trimmedNote ? trimmedNote : undefined,
      },
    });

    if (emailError) {
      throw emailError;
    }
  }

  await logAdminActivity("order.status_updated", "orders", order.id, {
    order_number: order.order_number,
    previous_status: order.status,
    new_status: nextStatus,
    note: trimmedNote || null,
    notified_customer: notifyCustomer,
  });
};

interface UpdatePaymentStatusInput {
  order: AdminOrderDetail;
  paymentStatus: PaymentStatus;
  paymentReference: string;
}

export const updateAdminPaymentStatus = async ({ order, paymentStatus, paymentReference }: UpdatePaymentStatusInput) => {
  const updates: Database["public"]["Tables"]["orders"]["Update"] = {
    payment_status: paymentStatus,
    payment_reference: paymentReference.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("orders").update(updates).eq("id", order.id);
  if (error) {
    throw error;
  }

  await logAdminActivity("order.payment_status_updated", "orders", order.id, {
    order_number: order.order_number,
    previous_payment_status: order.payment_status,
    new_payment_status: paymentStatus,
    payment_reference: paymentReference.trim() || null,
  });
};

interface CancelOrderInput {
  order: AdminOrderDetail;
  reason: string;
  adminEmail: string;
}

export const cancelAdminOrder = async ({ order, reason, adminEmail }: CancelOrderInput) => {
  const nowIso = new Date().toISOString();
  const trimmedReason = reason.trim();

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: nowIso,
      cancel_reason: trimmedReason,
      updated_at: nowIso,
    })
    .eq("id", order.id);

  if (orderError) {
    throw orderError;
  }

  for (const item of order.order_items) {
    const { data: productData, error: productReadError } = await supabase
      .from("products")
      .select("stock_quantity")
      .eq("id", item.product_id)
      .single();

    if (productReadError) {
      throw productReadError;
    }

    const { error: updateProductError } = await supabase
      .from("products")
      .update({
        stock_quantity: safeNumber(productData.stock_quantity) + safeNumber(item.quantity),
        updated_at: nowIso,
      })
      .eq("id", item.product_id);

    if (updateProductError) {
      throw updateProductError;
    }
  }

  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: order.id,
    previous_status: order.status,
    new_status: "cancelled",
    changed_by: adminEmail,
    note: trimmedReason,
    notified_customer: false,
  });

  if (historyError) {
    throw historyError;
  }

  await logAdminActivity("order.cancelled", "orders", order.id, {
    order_number: order.order_number,
    previous_status: order.status,
    reason: trimmedReason,
    changed_by: adminEmail,
  });
};

export const fetchAdminProducts = async (filters: AdminProductListFilters): Promise<AdminProductListResult> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 20, 100));
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("products")
    .select(
      `
      id,
      name,
      slug,
      sku,
      price,
      compare_at_price,
      stock_quantity,
      low_stock_threshold,
      is_available,
      is_featured,
      images,
      created_at,
      categories ( name, slug )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.searchTerm?.trim()) {
    const safeSearchTerm = escapeSearchTerm(filters.searchTerm);
    if (safeSearchTerm) {
      query = query.or(`name.ilike.%${safeSearchTerm}%,sku.ilike.%${safeSearchTerm}%`);
    }
  }

  if (filters.categorySlug) {
    query = query.eq("categories.slug", filters.categorySlug);
  }

  if (filters.availability === "available") {
    query = query.eq("is_available", true);
  } else if (filters.availability === "unavailable") {
    query = query.eq("is_available", false);
  }

  const { data, count, error } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []).map((row) => {
    const category = mapMaybeEmbeddedRecord(row.categories);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      price: safeNumber(row.price),
      compare_at_price: row.compare_at_price === null ? null : safeNumber(row.compare_at_price),
      stock_quantity: safeNumber(row.stock_quantity),
      low_stock_threshold: row.low_stock_threshold === null ? null : safeNumber(row.low_stock_threshold),
      is_available: row.is_available,
      is_featured: row.is_featured,
      created_at: row.created_at,
      image_url: extractPrimaryImageUrl(row.images),
      category_name: typeof category?.name === "string" ? category.name : null,
      category_slug: typeof category?.slug === "string" ? category.slug : null,
    };
  });

  return {
    rows,
    totalCount: count ?? 0,
  };
};

export const fetchAdminProductById = async (id: string) => {
  const { data, error } = await supabase
    .from("products")
    .select(
      `
      *,
      categories ( id, name, slug )
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const createAdminProduct = async (payload: Database["public"]["Tables"]["products"]["Insert"]) => {
  const { data, error } = await supabase.from("products").insert(payload).select().single();
  if (error) throw error;

  await logAdminActivity("product.created", "products", data.id, {
    name: data.name,
    slug: data.slug,
    sku: data.sku,
  });

  return data;
};

export const updateAdminProduct = async (
  id: string,
  payload: Database["public"]["Tables"]["products"]["Update"],
  previous?: Json,
) => {
  const { data, error } = await supabase
    .from("products")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await logAdminActivity("product.updated", "products", id, {
    before: previous ?? null,
    after: data,
  });

  return data;
};

export const fetchProductOrderCount = async (productId: string) => {
  const { count, error } = await supabase
    .from("order_items")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);

  if (error) {
    throw error;
  }

  return count ?? 0;
};

export const deleteAdminProduct = async (productId: string, metadata: Json) => {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    throw error;
  }

  await logAdminActivity("product.deleted", "products", productId, metadata);
};

export const uploadProductImage = async (productId: string, file: File) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  const filePath = `products/${productId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from("product-images").upload(filePath, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
  return {
    path: filePath,
    url: data.publicUrl,
  };
};

const extractStoragePathFromPublicUrl = (url: string, bucket: string): string | null => {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(url.slice(markerIndex + marker.length));
};

export const deleteProductImageFromStorage = async (url: string) => {
  const path = extractStoragePathFromPublicUrl(url, "product-images");
  if (!path) {
    return;
  }

  const { error } = await supabase.storage.from("product-images").remove([path]);
  if (error) {
    throw error;
  }
};

export const fetchAdminCategories = async (): Promise<AdminCategoryWithCount[]> => {
  const { data, error } = await supabase
    .from("categories")
    .select(
      `
      id,
      name,
      slug,
      description,
      image_url,
      display_order,
      is_active,
      products ( count )
    `,
    )
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const productCountRelation = Array.isArray(row.products) ? row.products[0] : null;
    const productsCount =
      productCountRelation && typeof productCountRelation === "object" && "count" in productCountRelation
        ? safeNumber((productCountRelation as Record<string, unknown>).count)
        : 0;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      image_url: row.image_url,
      display_order: row.display_order,
      is_active: row.is_active,
      products_count: productsCount,
    };
  });
};

export const createAdminCategory = async (payload: Database["public"]["Tables"]["categories"]["Insert"]) => {
  const { data, error } = await supabase.from("categories").insert(payload).select().single();
  if (error) {
    throw error;
  }

  await logAdminActivity("category.created", "categories", data.id, {
    name: data.name,
    slug: data.slug,
  });

  return data;
};

export const updateAdminCategory = async (
  id: string,
  payload: Database["public"]["Tables"]["categories"]["Update"],
  previous?: Json,
) => {
  const { data, error } = await supabase
    .from("categories")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  await logAdminActivity("category.updated", "categories", id, {
    before: previous ?? null,
    after: data,
  });

  return data;
};

export const uploadCategoryImage = async (slug: string, file: File) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  const filePath = `categories/${slug}/hero-${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from("category-images").upload(filePath, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("category-images").getPublicUrl(filePath);
  return {
    path: filePath,
    url: data.publicUrl,
  };
};

export const deleteAdminCategory = async (category: AdminCategoryWithCount) => {
  const { error } = await supabase.from("categories").delete().eq("id", category.id);

  if (error) {
    throw error;
  }

  await logAdminActivity("category.deleted", "categories", category.id, {
    name: category.name,
    slug: category.slug,
  });
};

export const buildStatusLabel = (value: string) => toTitleCase(value);
