import { supabase } from "@/integrations/supabase/client";
import type { Database, Json, Tables } from "@/integrations/supabase/types";
import { logAdminActivity } from "@/services/adminService";
import { buildZipBlob } from "@/lib/zip";

type OrderStatus = Database["public"]["Enums"]["order_status"];
type CustomerRole = Database["public"]["Enums"]["customer_role"];
type DiscountType = Database["public"]["Enums"]["discount_type"];

const safeNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const escapeSearchTerm = (value: string) => value.replace(/[%_,]/g, "").trim();

const mapEmbeddedRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
};

const csvEscape = (value: unknown) => {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
};

export interface AdminCustomerListFilters {
  searchTerm?: string;
  status?: "all" | "active" | "inactive";
  sortBy?: "newest" | "oldest" | "most_orders" | "most_spent";
  page?: number;
  pageSize?: number;
}

export interface AdminCustomerListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  total_orders: number | null;
  total_spent: number | null;
  is_active: boolean | null;
  created_at: string;
  avatar_url: string | null;
}

export interface AdminCustomerListResult {
  rows: AdminCustomerListItem[];
  totalCount: number;
}

const applyCustomerListFilters = (
  query: any,
  filters: AdminCustomerListFilters,
) => {
  let next = query.select(
    "id, first_name, last_name, email, phone, total_orders, total_spent, is_active, created_at, avatar_url",
    { count: "exact" },
  );

  const trimmedSearch = escapeSearchTerm(filters.searchTerm ?? "");
  if (trimmedSearch) {
    next = next.or(
      `first_name.ilike.%${trimmedSearch}%,last_name.ilike.%${trimmedSearch}%,email.ilike.%${trimmedSearch}%,phone.ilike.%${trimmedSearch}%`,
    );
  }

  if (filters.status === "active") {
    next = next.eq("is_active", true);
  } else if (filters.status === "inactive") {
    next = next.eq("is_active", false);
  }

  const sortBy = filters.sortBy ?? "newest";
  if (sortBy === "oldest") {
    next = next.order("created_at", { ascending: true });
  } else if (sortBy === "most_orders") {
    next = next.order("total_orders", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  } else if (sortBy === "most_spent") {
    next = next.order("total_spent", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  } else {
    next = next.order("created_at", { ascending: false });
  }

  return next;
};

export const fetchAdminCustomers = async (filters: AdminCustomerListFilters): Promise<AdminCustomerListResult> => {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const query = applyCustomerListFilters(supabase.from("customers"), filters);
  const { data, count, error } = await query.range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  return {
    rows: (data ?? []) as AdminCustomerListItem[],
    totalCount: count ?? 0,
  };
};

export const fetchAdminCustomersForExport = async (
  filters: Omit<AdminCustomerListFilters, "page" | "pageSize">,
): Promise<AdminCustomerListItem[]> => {
  const query = applyCustomerListFilters(supabase.from("customers"), filters);
  const { data, error } = await query.limit(5000);

  if (error) {
    throw error;
  }

  return (data ?? []) as AdminCustomerListItem[];
};

export const buildCustomersCsv = (rows: AdminCustomerListItem[]): string => {
  const header = ["Name", "Email", "Phone", "Total Orders", "Total Spent", "Join Date", "Status"];
  const lines = rows.map((row) =>
    [
      `${row.first_name} ${row.last_name}`.trim(),
      row.email,
      row.phone || "",
      row.total_orders ?? 0,
      row.total_spent ?? 0,
      row.created_at,
      row.is_active ? "Active" : "Inactive",
    ]
      .map(csvEscape)
      .join(","),
  );

  return [header.map(csvEscape).join(","), ...lines].join("\n");
};

export interface AdminCustomerRoleRecord {
  role: CustomerRole;
  assigned_by: string | null;
  assigned_at: string | null;
  assigned_by_customer: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface AdminCustomerDetail {
  customer: Tables<"customers">;
  roleRecord: AdminCustomerRoleRecord | null;
}

export const fetchAdminCustomerDetail = async (customerId: string): Promise<AdminCustomerDetail> => {
  const [customerResult, roleResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, total_orders, total_spent, is_active, created_at, avatar_url, notes")
      .eq("id", customerId)
      .single(),
    supabase
      .from("customer_roles")
      .select(
        `
          role,
          assigned_by,
          assigned_at,
          assigned_by_customer:customers!customer_roles_assigned_by_fkey (
            first_name,
            last_name,
            email
          )
        `,
      )
      .eq("customer_id", customerId)
      .maybeSingle(),
  ]);

  if (customerResult.error) {
    throw customerResult.error;
  }

  if (roleResult.error && roleResult.error.code !== "PGRST116") {
    throw roleResult.error;
  }

  const roleRaw = roleResult.data as Record<string, unknown> | null;
  const assignedByRaw = mapEmbeddedRecord(roleRaw?.assigned_by_customer);

  return {
    customer: customerResult.data as Tables<"customers">,
    roleRecord: roleRaw
      ? {
          role: (roleRaw.role as CustomerRole) ?? "customer",
          assigned_by: typeof roleRaw.assigned_by === "string" ? roleRaw.assigned_by : null,
          assigned_at: typeof roleRaw.assigned_at === "string" ? roleRaw.assigned_at : null,
          assigned_by_customer: assignedByRaw
            ? {
                first_name: typeof assignedByRaw.first_name === "string" ? assignedByRaw.first_name : "",
                last_name: typeof assignedByRaw.last_name === "string" ? assignedByRaw.last_name : "",
                email: typeof assignedByRaw.email === "string" ? assignedByRaw.email : "",
              }
            : null,
        }
      : null,
  };
};

export interface AdminCustomerOrderRow {
  order_number: string;
  total: number;
  status: OrderStatus;
  payment_status: Database["public"]["Enums"]["payment_status"];
  created_at: string;
  items_count: number;
}

export const fetchAdminCustomerOrders = async (customerId: string): Promise<AdminCustomerOrderRow[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        order_number,
        total,
        status,
        payment_status,
        created_at,
        order_items ( count )
      `,
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const countRecord = Array.isArray(row.order_items) ? (row.order_items[0] as Record<string, unknown> | undefined) : undefined;
    return {
      order_number: row.order_number,
      total: safeNumber(row.total),
      status: row.status,
      payment_status: row.payment_status,
      created_at: row.created_at,
      items_count: safeNumber(countRecord?.count),
    };
  });
};

export interface AdminCustomerAddressRow {
  id: string;
  label: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  country: string;
  is_default: boolean | null;
  usage_count: number;
}

export const fetchAdminCustomerAddresses = async (customerId: string): Promise<AdminCustomerAddressRow[]> => {
  const [addressResult, orderAddressUsageResult] = await Promise.all([
    supabase
      .from("addresses")
      .select(
        "id, label, recipient_name, recipient_phone, address_line1, address_line2, city, state, country, is_default",
      )
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false }),
    supabase.from("orders").select("shipping_address_id").eq("customer_id", customerId).not("shipping_address_id", "is", null),
  ]);

  if (addressResult.error) {
    throw addressResult.error;
  }

  if (orderAddressUsageResult.error) {
    throw orderAddressUsageResult.error;
  }

  const usageMap = new Map<string, number>();
  for (const row of orderAddressUsageResult.data ?? []) {
    if (!row.shipping_address_id) {
      continue;
    }
    usageMap.set(row.shipping_address_id, (usageMap.get(row.shipping_address_id) ?? 0) + 1);
  }

  return (addressResult.data ?? []).map((row) => ({
    ...row,
    usage_count: usageMap.get(row.id) ?? 0,
  }));
};

export const updateAdminCustomerNote = async (customerId: string, noteText: string) => {
  const { data: previous, error: previousError } = await supabase
    .from("customers")
    .select("notes")
    .eq("id", customerId)
    .maybeSingle();
  if (previousError) {
    throw previousError;
  }

  const { error } = await supabase.from("customers").update({ notes: noteText }).eq("id", customerId);
  if (error) {
    throw error;
  }

  await logAdminActivity("customer.note_updated", "customers", customerId, {
    previous_note: previous?.notes ?? null,
    new_note: noteText,
  });
};

export const updateAdminCustomerStatus = async (customerId: string, isActive: boolean) => {
  const { data: previous, error: previousError } = await supabase
    .from("customers")
    .select("is_active")
    .eq("id", customerId)
    .maybeSingle();
  if (previousError) {
    throw previousError;
  }

  const { error } = await supabase
    .from("customers")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  if (error) {
    throw error;
  }

  await logAdminActivity(isActive ? "customer.reactivated" : "customer.deactivated", "customers", customerId, {
    previous_status: previous?.is_active ? "active" : "inactive",
    new_status: isActive ? "active" : "inactive",
  });
};

export const getCustomerRole = async (customerId: string): Promise<CustomerRole> => {
  const { data, error } = await supabase.from("customer_roles").select("role").eq("customer_id", customerId).maybeSingle();
  if (error) {
    throw error;
  }
  return (data?.role as CustomerRole) ?? "customer";
};

export const assignCustomerRole = async (
  targetCustomerId: string,
  newRole: CustomerRole,
  metadata?: Json,
) => {
  const previousRole = await getCustomerRole(targetCustomerId);

  const { error } = await supabase.rpc("assign_customer_role", {
    target_customer_id: targetCustomerId,
    new_role: newRole,
  });

  if (error) {
    throw error;
  }

  await logAdminActivity("customer.role_changed", "customers", targetCustomerId, {
    previous_role: previousRole,
    new_role: newRole,
    ...(metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {}),
  });
};

export interface CustomerSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
}

export const fetchCustomerByIdBasic = async (customerId: string): Promise<CustomerSearchResult | null> => {
  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, avatar_url")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return data as CustomerSearchResult;
};

export const searchCustomersByEmail = async (emailInput: string): Promise<CustomerSearchResult[]> => {
  const searchTerm = escapeSearchTerm(emailInput);
  if (!searchTerm) {
    return [];
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, avatar_url")
    .ilike("email", `%${searchTerm}%`)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data ?? []) as CustomerSearchResult[];
};

export const searchCustomerPromotionCandidates = async (emailInput: string): Promise<CustomerSearchResult[]> => {
  const searchTerm = escapeSearchTerm(emailInput);
  if (!searchTerm) {
    return [];
  }

  const { data, error } = await supabase
    .from("customer_roles")
    .select(
      `
        customer_id,
        role,
        customers!customer_roles_customer_id_fkey (
          id,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `,
    )
    .eq("role", "customer")
    .ilike("customers.email", `%${searchTerm}%`)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapEmbeddedRecord(row.customers))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      first_name: typeof entry.first_name === "string" ? entry.first_name : "",
      last_name: typeof entry.last_name === "string" ? entry.last_name : "",
      email: typeof entry.email === "string" ? entry.email : "",
      avatar_url: typeof entry.avatar_url === "string" ? entry.avatar_url : null,
    }))
    .filter((entry) => entry.id.length > 0 && entry.email.length > 0);
};

export interface AdminUserListItem {
  customer_id: string;
  role: CustomerRole;
  assigned_by: string | null;
  assigned_at: string | null;
  created_at: string;
  customer: CustomerSearchResult;
  promoted_by_name: string;
}

export const fetchAdminUsers = async (): Promise<AdminUserListItem[]> => {
  const { data, error } = await supabase
    .from("customer_roles")
    .select(
      `
        customer_id,
        role,
        assigned_by,
        assigned_at,
        created_at,
        customers!customer_roles_customer_id_fkey (
          id,
          first_name,
          last_name,
          email,
          avatar_url
        ),
        assigned_by_customer:customers!customer_roles_assigned_by_fkey (
          first_name,
          last_name
        )
      `,
    )
    .in("role", ["admin", "super_admin"])
    .order("assigned_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => {
      const customer = mapEmbeddedRecord(row.customers);
      const assignedBy = mapEmbeddedRecord(row.assigned_by_customer);
      const assignedByName = assignedBy
        ? `${typeof assignedBy.first_name === "string" ? assignedBy.first_name : ""} ${
            typeof assignedBy.last_name === "string" ? assignedBy.last_name : ""
          }`.trim()
        : "";

      return {
        customer_id: row.customer_id,
        role: row.role as CustomerRole,
        assigned_by: row.assigned_by,
        assigned_at: row.assigned_at,
        created_at: row.created_at,
        customer: {
          id: typeof customer?.id === "string" ? customer.id : row.customer_id,
          first_name: typeof customer?.first_name === "string" ? customer.first_name : "",
          last_name: typeof customer?.last_name === "string" ? customer.last_name : "",
          email: typeof customer?.email === "string" ? customer.email : "",
          avatar_url: typeof customer?.avatar_url === "string" ? customer.avatar_url : null,
        },
        promoted_by_name: assignedByName || "System",
      };
    })
    .filter((row) => row.customer.email.length > 0);
};

export const promoteCustomerRole = async (
  targetCustomerId: string,
  selectedRole: Extract<CustomerRole, "admin" | "super_admin">,
  metadata: Json,
) => {
  const { error } = await supabase.rpc("assign_customer_role", {
    target_customer_id: targetCustomerId,
    new_role: selectedRole,
  });

  if (error) {
    throw error;
  }

  await logAdminActivity("admin.role_assigned", "customer_roles", targetCustomerId, metadata);
};

export const demoteCustomerToRole = async (targetCustomerId: string, metadata: Json) => {
  const { error } = await supabase.rpc("assign_customer_role", {
    target_customer_id: targetCustomerId,
    new_role: "customer",
  });

  if (error) {
    throw error;
  }

  await logAdminActivity("admin.role_removed", "customer_roles", targetCustomerId, metadata);
};

export interface AdminDiscountCodeRow {
  id: string;
  code: string;
  description: string | null;
  type: DiscountType;
  value: number;
  minimum_order_amount: number | null;
  usage_limit: number | null;
  usage_count: number | null;
  customer_id: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  created_at: string;
}

export const fetchAdminDiscountCodes = async (): Promise<AdminDiscountCodeRow[]> => {
  const { data, error } = await supabase.from("discount_codes").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    ...row,
    value: safeNumber(row.value),
    minimum_order_amount: row.minimum_order_amount === null ? null : safeNumber(row.minimum_order_amount),
    usage_limit: row.usage_limit === null ? null : safeNumber(row.usage_limit),
    usage_count: row.usage_count === null ? 0 : safeNumber(row.usage_count),
  }));
};

export type DiscountCodeUpsertInput = Database["public"]["Tables"]["discount_codes"]["Insert"];

export const createAdminDiscountCode = async (payload: DiscountCodeUpsertInput) => {
  const { data, error } = await supabase.from("discount_codes").insert(payload).select().single();
  if (error) {
    throw error;
  }

  await logAdminActivity("discount_code.created", "discount_codes", data.id, {
    code: data.code,
    type: data.type,
    value: data.value,
    usage_limit: data.usage_limit,
    expires_at: data.expires_at,
  });

  return data;
};

export const updateAdminDiscountCode = async (
  id: string,
  payload: Database["public"]["Tables"]["discount_codes"]["Update"],
  previous?: AdminDiscountCodeRow,
) => {
  const { data, error } = await supabase
    .from("discount_codes")
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

  await logAdminActivity("discount_code.updated", "discount_codes", id, {
    before: previous ?? null,
    after: data,
  } as unknown as Json);

  return data;
};

export const deleteAdminDiscountCode = async (codeId: string, code: string) => {
  const { error } = await supabase.from("discount_codes").delete().eq("id", codeId);
  if (error) {
    throw error;
  }

  await logAdminActivity("discount_code.deleted", "discount_codes", codeId, {
    code,
  });
};

export interface AdminShippingRateRow {
  id: string;
  name: string;
  states: string[];
  base_rate: number;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_active: boolean | null;
  created_at: string;
}

const parseStates = (raw: Json | null): string[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
};

export const fetchAdminShippingRates = async (): Promise<AdminShippingRateRow[]> => {
  const { data, error } = await supabase
    .from("shipping_rates")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    states: parseStates(row.states),
    base_rate: safeNumber(row.base_rate),
    estimated_days_min: row.estimated_days_min === null ? null : safeNumber(row.estimated_days_min),
    estimated_days_max: row.estimated_days_max === null ? null : safeNumber(row.estimated_days_max),
    is_active: row.is_active,
    created_at: row.created_at,
  }));
};

export type ShippingRateUpsertInput = Database["public"]["Tables"]["shipping_rates"]["Insert"];

export const createAdminShippingRate = async (payload: ShippingRateUpsertInput) => {
  const { data, error } = await supabase.from("shipping_rates").insert(payload).select().single();
  if (error) {
    throw error;
  }

  await logAdminActivity("shipping_rate.created", "shipping_rates", data.id, {
    name: data.name,
    states: data.states,
    base_rate: data.base_rate,
    estimated_days_min: data.estimated_days_min,
    estimated_days_max: data.estimated_days_max,
    is_active: data.is_active,
  });

  return data;
};

export const updateAdminShippingRate = async (
  id: string,
  payload: Database["public"]["Tables"]["shipping_rates"]["Update"],
  previous?: AdminShippingRateRow,
) => {
  const { data, error } = await supabase
    .from("shipping_rates")
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

  await logAdminActivity("shipping_rate.updated", "shipping_rates", id, {
    before: previous ?? null,
    after: data,
  } as unknown as Json);

  return data;
};

export const deleteAdminShippingRate = async (shippingRate: AdminShippingRateRow) => {
  const { error } = await supabase.from("shipping_rates").delete().eq("id", shippingRate.id);
  if (error) {
    throw error;
  }

  await logAdminActivity("shipping_rate.deleted", "shipping_rates", shippingRate.id, {
    name: shippingRate.name,
    states: shippingRate.states,
  });
};

export interface SiteSettingRow {
  key: string;
  value: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_customer: {
    first_name: string;
    last_name: string;
  } | null;
}

export const fetchSiteSettings = async (): Promise<SiteSettingRow[]> => {
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      `
        key,
        value,
        updated_at,
        updated_by,
        updated_by_customer:customers!site_settings_updated_by_fkey (
          first_name,
          last_name
        )
      `,
    )
    .order("key", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const updatedBy = mapEmbeddedRecord(row.updated_by_customer);
    return {
      key: row.key,
      value: row.value,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
      updated_by_customer: updatedBy
        ? {
            first_name: typeof updatedBy.first_name === "string" ? updatedBy.first_name : "",
            last_name: typeof updatedBy.last_name === "string" ? updatedBy.last_name : "",
          }
        : null,
    };
  });
};

interface SaveSiteSettingInput {
  key: string;
  value: string;
  oldValue: string | null;
  sectionName: string;
  currentAdminId: string;
}

export const saveSiteSetting = async ({ key, value, oldValue, sectionName, currentAdminId }: SaveSiteSettingInput) => {
  const nowIso = new Date().toISOString();

  const { error } = await supabase.from("site_settings").upsert(
    {
      key,
      value,
      updated_by: currentAdminId,
      updated_at: nowIso,
    },
    { onConflict: "key" },
  );

  if (error) {
    throw error;
  }

  await logAdminActivity("settings.updated", "site_settings", null, {
    section: sectionName,
    changes: {
      key,
      old_value: oldValue,
      new_value: value,
    },
  });
};

const buildGenericCsv = (header: string[], rows: Array<Array<string | number | null>>) => {
  return [header.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
};

export const buildFullDataExportZip = async (): Promise<Blob> => {
  const [ordersResult, customersResult, productsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `
          order_number,
          total,
          status,
          payment_status,
          created_at,
          customers ( first_name, last_name, email )
        `,
      )
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("customers")
      .select("first_name, last_name, email, phone, total_orders, total_spent, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("products")
      .select("name, slug, sku, price, stock_quantity, is_available, created_at")
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (customersResult.error) throw customersResult.error;
  if (productsResult.error) throw productsResult.error;

  const ordersCsv = buildGenericCsv(
    ["Order #", "Customer Name", "Customer Email", "Total", "Status", "Payment Status", "Date"],
    (ordersResult.data ?? []).map((row) => {
      const customer = mapEmbeddedRecord(row.customers);
      const customerName = `${typeof customer?.first_name === "string" ? customer.first_name : ""} ${
        typeof customer?.last_name === "string" ? customer.last_name : ""
      }`.trim();

      return [
        row.order_number,
        customerName,
        typeof customer?.email === "string" ? customer.email : "",
        safeNumber(row.total),
        row.status,
        row.payment_status,
        row.created_at,
      ];
    }),
  );

  const customersCsv = buildGenericCsv(
    ["Name", "Email", "Phone", "Total Orders", "Total Spent", "Status", "Joined"],
    (customersResult.data ?? []).map((row) => [
      `${row.first_name} ${row.last_name}`.trim(),
      row.email,
      row.phone,
      row.total_orders ?? 0,
      row.total_spent ?? 0,
      row.is_active ? "Active" : "Inactive",
      row.created_at,
    ]),
  );

  const productsCsv = buildGenericCsv(
    ["Name", "Slug", "SKU", "Price", "Stock", "Available", "Created At"],
    (productsResult.data ?? []).map((row) => [
      row.name,
      row.slug,
      row.sku,
      safeNumber(row.price),
      row.stock_quantity,
      row.is_available ? "Yes" : "No",
      row.created_at,
    ]),
  );

  return buildZipBlob([
    { name: "orders.csv", content: ordersCsv },
    { name: "customers.csv", content: customersCsv },
    { name: "products.csv", content: productsCsv },
  ]);
};

export const clearTestOrders = async () => {
  const [byEmailResult, byZeroTotalResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `
          id,
          order_number,
          total,
          customers!inner ( email )
        `,
      )
      .ilike("customers.email", "%test%"),
    supabase.from("orders").select("id, order_number, total").eq("total", 0),
  ]);

  if (byEmailResult.error) throw byEmailResult.error;
  if (byZeroTotalResult.error) throw byZeroTotalResult.error;

  const ids = new Set<string>();

  for (const row of byEmailResult.data ?? []) {
    ids.add(row.id);
  }

  for (const row of byZeroTotalResult.data ?? []) {
    ids.add(row.id);
  }

  const orderIds = Array.from(ids);
  if (orderIds.length === 0) {
    return 0;
  }

  const { error } = await supabase.from("orders").delete().in("id", orderIds);
  if (error) {
    throw error;
  }

  await logAdminActivity("orders.test_cleared", "orders", null, {
    deleted_count: orderIds.length,
  });

  return orderIds.length;
};
