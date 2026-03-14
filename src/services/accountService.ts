import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type AccountOrderStatus = Enums<"order_status">;
export type AccountGender = Enums<"gender_type">;

export interface AccountCustomerProfile
  extends Pick<
    Tables<"customers">,
    | "id"
    | "first_name"
    | "last_name"
    | "email"
    | "phone"
    | "date_of_birth"
    | "gender"
    | "avatar_url"
    | "total_orders"
    | "total_spent"
    | "created_at"
  > {}

export interface AccountOrderSummary
  extends Pick<Tables<"orders">, "id" | "order_number" | "status" | "total" | "created_at"> {
  first_item_name: string;
  item_count: number;
}

export interface AccountAddress
  extends Pick<
    Tables<"addresses">,
    | "id"
    | "label"
    | "recipient_name"
    | "recipient_phone"
    | "address_line1"
    | "address_line2"
    | "city"
    | "state"
    | "country"
    | "postal_code"
    | "delivery_instructions"
    | "is_default"
  > {}

export interface AccountAddressInput {
  label: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  country: string;
  postal_code: string | null;
  delivery_instructions: string | null;
}

export interface AccountProfileUpdateInput
  extends Pick<TablesUpdate<"customers">, "first_name" | "last_name" | "phone" | "date_of_birth" | "gender"> {}

const ORDER_LIST_COLUMNS = "id,order_number,status,total,created_at";
const ORDER_ITEM_LIST_COLUMNS = "order_id,product_name,created_at";

const getFirstItemMap = (
  rows: Pick<Tables<"order_items">, "order_id" | "product_name" | "created_at">[],
): Map<string, { firstItem: string; count: number }> => {
  const map = new Map<string, { firstItem: string; count: number }>();

  for (const row of rows) {
    const existing = map.get(row.order_id);

    if (!existing) {
      map.set(row.order_id, {
        firstItem: row.product_name,
        count: 1,
      });
      continue;
    }

    map.set(row.order_id, {
      firstItem: existing.firstItem,
      count: existing.count + 1,
    });
  }

  return map;
};

export const fetchAccountCustomerProfile = async (customerId: string): Promise<AccountCustomerProfile | null> => {
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id,first_name,last_name,email,phone,date_of_birth,gender,avatar_url,total_orders,total_spent,created_at",
    )
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as AccountCustomerProfile | null;
};

export const fetchAccountOrderSummaries = async (
  customerId: string,
  options?: { limit?: number },
): Promise<AccountOrderSummary[]> => {
  let query = supabase
    .from("orders")
    .select(ORDER_LIST_COLUMNS)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (options?.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data: ordersData, error: ordersError } = await query;

  if (ordersError) {
    throw ordersError;
  }

  const orders = (ordersData ?? []) as Pick<Tables<"orders">, "id" | "order_number" | "status" | "total" | "created_at">[];
  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);

  const { data: itemsData, error: itemsError } = await supabase
    .from("order_items")
    .select(ORDER_ITEM_LIST_COLUMNS)
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const itemMap = getFirstItemMap(
    (itemsData ?? []) as Pick<Tables<"order_items">, "order_id" | "product_name" | "created_at">[],
  );

  return orders.map((order) => {
    const summary = itemMap.get(order.id);

    return {
      ...order,
      first_item_name: summary?.firstItem ?? "Order item",
      item_count: summary?.count ?? 0,
    };
  });
};

export const fetchAccountAddresses = async (customerId: string): Promise<AccountAddress[]> => {
  const { data, error } = await supabase
    .from("addresses")
    .select(
      "id,label,recipient_name,recipient_phone,address_line1,address_line2,city,state,country,postal_code,delivery_instructions,is_default",
    )
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AccountAddress[];
};

const toAddressInsertPayload = (customerId: string, input: AccountAddressInput): TablesInsert<"addresses"> => ({
  customer_id: customerId,
  label: input.label,
  recipient_name: input.recipient_name,
  recipient_phone: input.recipient_phone,
  address_line1: input.address_line1,
  address_line2: input.address_line2,
  city: input.city,
  state: input.state,
  country: input.country,
  postal_code: input.postal_code,
  delivery_instructions: input.delivery_instructions,
});

const toAddressUpdatePayload = (input: AccountAddressInput): TablesUpdate<"addresses"> => ({
  label: input.label,
  recipient_name: input.recipient_name,
  recipient_phone: input.recipient_phone,
  address_line1: input.address_line1,
  address_line2: input.address_line2,
  city: input.city,
  state: input.state,
  country: input.country,
  postal_code: input.postal_code,
  delivery_instructions: input.delivery_instructions,
});

export const createAccountAddress = async (
  customerId: string,
  input: AccountAddressInput,
  options?: { isDefault?: boolean },
): Promise<AccountAddress> => {
  const payload: TablesInsert<"addresses"> = {
    ...toAddressInsertPayload(customerId, input),
    is_default: options?.isDefault ?? false,
  };

  const { data, error } = await supabase
    .from("addresses")
    .insert(payload)
    .select(
      "id,label,recipient_name,recipient_phone,address_line1,address_line2,city,state,country,postal_code,delivery_instructions,is_default",
    )
    .single();

  if (error) {
    throw error;
  }

  return data as AccountAddress;
};

export const updateAccountAddress = async (
  customerId: string,
  addressId: string,
  input: AccountAddressInput,
): Promise<AccountAddress> => {
  const payload = toAddressUpdatePayload(input);

  const { data, error } = await supabase
    .from("addresses")
    .update(payload)
    .eq("customer_id", customerId)
    .eq("id", addressId)
    .select(
      "id,label,recipient_name,recipient_phone,address_line1,address_line2,city,state,country,postal_code,delivery_instructions,is_default",
    )
    .single();

  if (error) {
    throw error;
  }

  return data as AccountAddress;
};

export const deleteAccountAddress = async (customerId: string, addressId: string): Promise<void> => {
  const { error } = await supabase.from("addresses").delete().eq("customer_id", customerId).eq("id", addressId);

  if (error) {
    throw error;
  }
};

export const setAccountDefaultAddress = async (customerId: string, addressId: string): Promise<void> => {
  const { error: resetError } = await supabase
    .from("addresses")
    .update({
      is_default: false,
    })
    .eq("customer_id", customerId)
    .neq("id", addressId);

  if (resetError) {
    throw resetError;
  }

  const { error: setError } = await supabase
    .from("addresses")
    .update({
      is_default: true,
    })
    .eq("customer_id", customerId)
    .eq("id", addressId);

  if (setError) {
    throw setError;
  }
};

export const updateAccountPersonalDetails = async (
  customerId: string,
  updates: AccountProfileUpdateInput,
): Promise<void> => {
  const { error } = await supabase.from("customers").update(updates).eq("id", customerId);

  if (error) {
    throw error;
  }
};

export const updateAccountAvatarUrl = async (customerId: string, avatarUrl: string | null): Promise<void> => {
  const { error } = await supabase.from("customers").update({ avatar_url: avatarUrl }).eq("id", customerId);

  if (error) {
    throw error;
  }
};

export const updateMarketingPreference = async (marketingOptIn: boolean): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    data: {
      marketing_opt_in: marketingOptIn,
    },
  });

  if (error) {
    throw error;
  }
};

export const verifyCurrentPassword = async (email: string, password: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw error;
  }
};

export const updateAccountPassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
};
