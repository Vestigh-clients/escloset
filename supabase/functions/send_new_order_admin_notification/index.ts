import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import {
  escapeHtml,
  formatFromEmail,
  loadEmailBranding,
  normalizeSiteUrl,
  renderEmailShell,
  safeString,
} from "../_shared/emailBrand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://escloset.vestigh.com";

interface OrderItemRow {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  product_image_url: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  variant_label: string | null;
}

interface OrderRow {
  id: string;
  order_number: string;
  created_at: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number | null;
  total: number;
  payment_method: string | null;
  mobile_money_number: string | null;
  shipping_address_snapshot: Record<string, unknown> | null;
  customers: Record<string, unknown> | Record<string, unknown>[] | null;
  order_items: OrderItemRow[] | null;
}

const jsonResponse = (status: number, payload: { success: boolean; message: string }) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const mapMaybeEmbeddedRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) {
    return asRecord(value[0]);
  }
  return asRecord(value);
};

const safeNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getVariantLabel = (item: Pick<OrderItemRow, "variant_label">): string | null => safeString(item.variant_label);

const toTitleCase = (value: string) =>
  value
    .split(/[_\s-]+/)
    .map((token) => (token ? token[0].toUpperCase() + token.slice(1).toLowerCase() : ""))
    .join(" ");

const formatAmount = (value: number): string => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.max(0, value));
  } catch {
    return Math.max(0, value).toLocaleString("en-GH");
  }
};

const formatDateLong = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-GH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAddressLines = (snapshot: Record<string, unknown> | null): string[] => {
  if (!snapshot) {
    return [];
  }

  const recipient = safeString(snapshot.recipient_name) || "";
  const line1 = safeString(snapshot.address_line1) || "";
  const line2 = safeString(snapshot.address_line2) || "";
  const city = safeString(snapshot.city) || "";
  const state = safeString(snapshot.state) || "";
  const country = safeString(snapshot.country) || "";
  const cityState = [city, state].filter(Boolean).join(", ");

  return [recipient, line1, line2, cityState, country].filter(Boolean);
};

const resolveCustomerEmail = (
  shippingSnapshot: Record<string, unknown> | null,
  fallbackCustomerEmail: string | null,
): string | null => {
  const snapshotEmail = safeString(
    shippingSnapshot?.email ?? shippingSnapshot?.contact_email ?? shippingSnapshot?.recipient_email,
  );
  const customerEmail = safeString(fallbackCustomerEmail);
  return snapshotEmail ?? customerEmail;
};

const getSettingValue = async (
  adminClient: ReturnType<typeof createClient>,
  key: string,
): Promise<string | null> => {
  const { data, error } = await adminClient.from("site_settings").select("value").eq("key", key).maybeSingle();

  if (error) {
    if (!["PGRST116", "PGRST205", "42P01"].includes(error.code ?? "")) {
      console.warn(`Unable to fetch site setting: ${key}`, error);
    }
    return null;
  }

  const raw = asRecord(data)?.value;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  if (typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }

  const nestedRecord = asRecord(raw);
  if (!nestedRecord) {
    return null;
  }

  for (const nestedKey of ["value", "email", "address", "url"]) {
    const candidate = safeString(nestedRecord[nestedKey]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const buildLowStockNotifications = async (
  adminClient: ReturnType<typeof createClient>,
  orderItems: OrderItemRow[],
) => {
  const productIds = [...new Set(orderItems.map((item) => safeString(item.product_id)).filter((id): id is string => Boolean(id)))];

  if (productIds.length === 0) {
    return [] as Array<{
      type: string;
      title: string;
      description: string;
      link: string;
      is_read: boolean;
    }>;
  }

  const notifications: Array<{
    type: string;
    title: string;
    description: string;
    link: string;
    is_read: boolean;
  }> = [];

  const { data: lowProducts, error: lowProductsError } = await adminClient
    .from("products")
    .select("id,name,stock_quantity,low_stock_threshold,is_available")
    .in("id", productIds)
    .eq("is_available", true);

  if (!lowProductsError && Array.isArray(lowProducts)) {
    for (const productEntry of lowProducts) {
      const product = productEntry as Record<string, unknown>;
      const stockQuantity = Math.max(0, Math.trunc(safeNumber(product.stock_quantity)));
      const threshold = Math.max(0, Math.trunc(safeNumber(product.low_stock_threshold, 5)));

      if (stockQuantity > threshold) {
        continue;
      }

      const productId = safeString(product.id);
      const productName = safeString(product.name) || "Product";
      if (!productId) {
        continue;
      }

      notifications.push({
        type: "low_stock",
        title: "Low Stock Alert",
        description: `${productName} - only ${stockQuantity} left in stock`,
        link: `/admin/products/${productId}/edit`,
        is_read: false,
      });
    }
  } else if (lowProductsError) {
    console.warn("Unable to evaluate low stock products", lowProductsError);
  }

  const { data: variantsData, error: variantsError } = await adminClient
    .from("product_variants")
    .select(
      `
      id,
      product_id,
      sku,
      stock_quantity,
      low_stock_threshold,
      label,
      is_available,
      products (
        id,
        name
      )
    `,
    )
    .in("product_id", productIds)
    .eq("is_available", true);

  if (variantsError) {
    console.warn("Unable to evaluate low stock variants", variantsError);
    return notifications;
  }

  if (!Array.isArray(variantsData)) {
    return notifications;
  }

  for (const variantEntry of variantsData) {
    const variant = variantEntry as Record<string, unknown>;
    const stockQuantity = Math.max(0, Math.trunc(safeNumber(variant.stock_quantity)));
    const threshold = Math.max(0, Math.trunc(safeNumber(variant.low_stock_threshold, 5)));

    if (stockQuantity > threshold) {
      continue;
    }

    const productRecord = mapMaybeEmbeddedRecord(variant.products);
    const productId = safeString(productRecord?.id) || safeString(variant.product_id);
    const productName = safeString(productRecord?.name) || "Product";
    if (!productId) {
      continue;
    }

    const variantLabelRaw = safeString(variant.label);
    const variantLabel = variantLabelRaw || safeString(variant.sku) || "Variant";

    notifications.push({
      type: "low_stock",
      title: "Low Stock Alert",
      description: `${productName} (${variantLabel}) - only ${stockQuantity} left in stock`,
      link: `/admin/products/${productId}/edit`,
      is_read: false,
    });
  }

  return notifications;
};

const buildItemsRowsHtml = (
  items: OrderItemRow[],
  styles: {
    border: string;
    textPrimary: string;
    textMuted: string;
    primary: string;
    primaryForeground: string;
    bodyFont: string;
  },
): string =>
  items
    .map((item) => {
      const variantLabel = getVariantLabel(item);
      const variantHtml = variantLabel
        ? `<div style="font-family:${styles.bodyFont};font-size:11px;color:${styles.textMuted};margin-top:2px;">${escapeHtml(variantLabel)}</div>`
        : "";
      return `
        <tr>
          <td style="padding:10px 12px;font-family:${styles.bodyFont};font-size:13px;color:${styles.textPrimary};border-top:1px solid ${styles.border};">
            ${escapeHtml(item.product_name)}
            ${variantHtml}
          </td>
          <td style="padding:10px 12px;font-family:${styles.bodyFont};font-size:13px;color:${styles.textPrimary};text-align:center;border-top:1px solid ${styles.border};">${Math.max(
            1,
            Math.round(safeNumber(item.quantity, 1)),
          )}</td>
          <td style="padding:10px 12px;font-family:${styles.bodyFont};font-size:13px;color:${styles.textPrimary};text-align:right;border-top:1px solid ${styles.border};">${escapeHtml(
            formatAmount(safeNumber(item.unit_price)),
          )}</td>
          <td style="padding:10px 12px;font-family:${styles.bodyFont};font-size:13px;color:${styles.textPrimary};text-align:right;border-top:1px solid ${styles.border};">${escapeHtml(
            formatAmount(safeNumber(item.subtotal)),
          )}</td>
        </tr>
      `;
    })
    .join("");

const buildEmailHtml = (params: {
  adminOrderUrl: string;
  order: OrderRow;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLines: string[];
  deliveryInstructions: string | null;
  paymentMethodLabel: string;
  itemsRowsHtml: string;
  storeName: string;
  snapshot: Awaited<ReturnType<typeof loadEmailBranding>>;
}) => {
  const {
    adminOrderUrl,
    order,
    customerName,
    customerEmail,
    customerPhone,
    addressLines,
    deliveryInstructions,
    paymentMethodLabel,
    itemsRowsHtml,
    storeName,
    snapshot,
  } = params;

  const subtotal = safeNumber(order.subtotal);
  const shippingFee = safeNumber(order.shipping_fee);
  const discount = Math.max(0, safeNumber(order.discount_amount));
  const total = safeNumber(order.total);

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-family:${snapshot.typography.body};font-size:18px;color:${snapshot.colors.textPrimary};">
      A new order has been placed on ${escapeHtml(storeName)}.
    </p>

    <div style="border:1px solid ${snapshot.colors.border};background:${snapshot.colors.canvas};padding:16px 18px;">
      <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};"><strong>Order #:</strong> ${escapeHtml(
        order.order_number,
      )}</p>
      <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};"><strong>Date:</strong> ${escapeHtml(
        formatDateLong(order.created_at),
      )}</p>
      <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};"><strong>Customer:</strong> ${escapeHtml(
        customerName,
      )}</p>
      <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};"><strong>Email:</strong> ${escapeHtml(
        customerEmail,
      )}</p>
      <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};"><strong>Phone:</strong> ${escapeHtml(
        customerPhone,
      )}</p>
      <p style="margin:0;font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};"><strong>Payment:</strong> ${escapeHtml(paymentMethodLabel)}</p>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:24px;border:1px solid ${snapshot.colors.border};">
      <thead>
        <tr style="background:${snapshot.colors.primary};color:${snapshot.colors.primaryForeground};">
          <th style="padding:10px 12px;text-align:left;font-family:${snapshot.typography.body};font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Product</th>
          <th style="padding:10px 12px;text-align:center;font-family:${snapshot.typography.body};font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-family:${snapshot.typography.body};font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Unit Price</th>
          <th style="padding:10px 12px;text-align:right;font-family:${snapshot.typography.body};font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div style="margin-top:18px;text-align:right;font-family:${snapshot.typography.body};color:${snapshot.colors.textPrimary};">
      <div style="font-size:14px;line-height:1.7;">Subtotal: ${escapeHtml(formatAmount(subtotal))}</div>
      <div style="font-size:14px;line-height:1.7;">Shipping: ${escapeHtml(formatAmount(shippingFee))}</div>
      <div style="font-size:14px;line-height:1.7;">Discount: ${escapeHtml(formatAmount(discount))}</div>
      <div style="font-size:16px;line-height:1.7;font-weight:600;">Total: ${escapeHtml(formatAmount(total))}</div>
    </div>

    <div style="margin-top:24px;">
      <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${snapshot.colors.textPrimary};">Delivery Address</p>
      <div style="font-family:${snapshot.typography.body};font-size:14px;line-height:1.8;color:${snapshot.colors.textPrimary};">
        ${addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
      </div>
      ${
        deliveryInstructions
          ? `<p style="margin:10px 0 0 0;font-family:${snapshot.typography.body};font-size:13px;line-height:1.7;color:${snapshot.colors.textPrimary};"><strong>Instructions:</strong> ${escapeHtml(
              deliveryInstructions,
            )}</p>`
          : ""
      }
    </div>

    <div style="margin-top:22px;">
      <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${snapshot.colors.textPrimary};">Payment Method</p>
      <div style="font-family:${snapshot.typography.body};font-size:14px;line-height:1.8;color:${snapshot.colors.textPrimary};">
        <div>${escapeHtml(paymentMethodLabel)}</div>
        ${
          safeString(order.mobile_money_number)
            ? `<div>Mobile Money: ${escapeHtml(safeString(order.mobile_money_number) || "")}</div>`
            : ""
        }
      </div>
    </div>

    <div style="margin-top:28px;">
      <a href="${escapeHtml(adminOrderUrl)}" style="display:inline-block;background:${snapshot.colors.primary};color:${snapshot.colors.primaryForeground};padding:14px 32px;text-decoration:none;font-family:${snapshot.typography.body};font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
        View Order in Admin
      </a>
    </div>
  `;

  return renderEmailShell({
    snapshot,
    contentHtml,
    footerNote: `${storeName} admin order alert`,
  });
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { success: false, message: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, message: "Missing Supabase environment variables" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = (await request.json().catch(() => ({}))) as { order_number?: string };
    const orderNumber = safeString(body.order_number);

    if (!orderNumber) {
      return jsonResponse(400, { success: false, message: "order_number is required" });
    }

    const { data, error } = await adminClient
      .from("orders")
      .select(
        `
        *,
        customers (
          first_name, last_name, email, phone
        ),
        order_items (
          product_id,
          variant_id,
          product_name,
          product_image_url,
          unit_price,
          quantity,
          subtotal,
          variant_label
        )
      `,
      )
      .eq("order_number", orderNumber)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return jsonResponse(404, { success: false, message: "Order not found" });
      }
      throw error;
    }

    const order = data as unknown as OrderRow;
    if (!order) {
      return jsonResponse(404, { success: false, message: "Order not found" });
    }

    const customer = mapMaybeEmbeddedRecord(order.customers);
    const shippingSnapshot = asRecord(order.shipping_address_snapshot);
    const firstName = safeString(customer?.first_name) || "Customer";
    const lastName = safeString(customer?.last_name) || "";
    const customerName = `${firstName} ${lastName}`.trim();
    const customerEmail = resolveCustomerEmail(shippingSnapshot, safeString(customer?.email)) || "No email";
    const customerPhone = safeString(customer?.phone) || "No phone";
    const paymentMethodLabel = toTitleCase(safeString(order.payment_method) || "Not specified");
    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
    const addressLines = getAddressLines(shippingSnapshot);
    const deliveryInstructions = safeString(shippingSnapshot?.delivery_instructions);
    const snapshot = await loadEmailBranding(adminClient, { fallbackSiteUrl: SITE_URL });
    const normalizedSiteUrl = normalizeSiteUrl(snapshot.identity.siteUrl);
    const adminOrderUrl = `${normalizedSiteUrl}/admin/orders/${encodeURIComponent(order.order_number)}`;

    const notificationPayload = {
      type: "new_order",
      title: "New Order Received",
      description: `Order ${order.order_number} from ${customerName} - ${formatAmount(safeNumber(order.total))}`,
      link: `/admin/orders/${order.order_number}`,
      is_read: false,
    };
    const lowStockNotifications = await buildLowStockNotifications(adminClient, orderItems);
    const allNotifications = [notificationPayload, ...lowStockNotifications];

    const adminNotificationEmail = await getSettingValue(adminClient, "new_order_email");
    if (!adminNotificationEmail) {
      console.warn("new_order_email is not configured in site_settings; skipping admin email send.");

      const { error: insertError } = await adminClient.from("admin_notifications").insert(allNotifications);
      if (insertError) {
        console.error("Failed to insert admin notification", insertError);
        return jsonResponse(500, { success: false, message: "Failed to create admin notification" });
      }

      return jsonResponse(200, {
        success: true,
        message: "Notification created, email skipped - no admin email configured",
      });
    }

    let resendFailed = false;
    let resendErrorMessage = "";

    if (!resendApiKey) {
      resendFailed = true;
      resendErrorMessage = "RESEND_API_KEY is not configured";
      console.error(resendErrorMessage);
    } else {
      const itemsRowsHtml = buildItemsRowsHtml(orderItems, {
        border: snapshot.colors.border,
        textPrimary: snapshot.colors.textPrimary,
        textMuted: snapshot.colors.textMuted,
        primary: snapshot.colors.primary,
        primaryForeground: snapshot.colors.primaryForeground,
        bodyFont: snapshot.typography.body,
      });
      const emailHtml = buildEmailHtml({
        adminOrderUrl,
        order,
        customerName,
        customerEmail,
        customerPhone,
        addressLines,
        deliveryInstructions,
        paymentMethodLabel,
        itemsRowsHtml,
        storeName: snapshot.identity.storeName,
        snapshot,
      });

      const emailText = [
        `A new order has been placed on ${snapshot.identity.storeName}.`,
        "",
        `Order #: ${order.order_number}`,
        `Date: ${formatDateLong(order.created_at)}`,
        `Customer: ${customerName}`,
        `Email: ${customerEmail}`,
        `Phone: ${customerPhone}`,
        `Payment: ${paymentMethodLabel}`,
        "",
        "Items:",
        ...orderItems.map((item) => {
          const variantLabel = getVariantLabel(item);
          const itemName = variantLabel ? `${item.product_name} (${variantLabel})` : item.product_name;
          return `- ${itemName} | Qty: ${Math.max(1, Math.round(safeNumber(item.quantity, 1)))} | Unit: ${formatAmount(
            safeNumber(item.unit_price),
          )} | Subtotal: ${formatAmount(safeNumber(item.subtotal))}`;
        }),
        "",
        `Subtotal: ${formatAmount(safeNumber(order.subtotal))}`,
        `Shipping: ${formatAmount(safeNumber(order.shipping_fee))}`,
        `Discount: ${formatAmount(Math.max(0, safeNumber(order.discount_amount)))}`,
        `Total: ${formatAmount(safeNumber(order.total))}`,
        "",
        "Delivery Address:",
        ...(addressLines.length > 0 ? addressLines : ["No delivery address provided"]),
        ...(deliveryInstructions ? [`Instructions: ${deliveryInstructions}`] : []),
        "",
        "Payment Method:",
        paymentMethodLabel,
        ...(safeString(order.mobile_money_number) ? [`Mobile Money: ${safeString(order.mobile_money_number)}`] : []),
        "",
        `View Order in Admin: ${adminOrderUrl}`,
      ].join("\n");

      try {
        const senderEmailAddress =
          safeString(Deno.env.get("ADMIN_NOTIFICATION_FROM_EMAIL_ADDRESS")) || snapshot.identity.supportEmail;

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: [adminNotificationEmail],
            from: formatFromEmail(
              `${snapshot.identity.storeName} Orders`,
              senderEmailAddress,
            ),
            subject: `New Order ${order.order_number} - ${formatAmount(safeNumber(order.total))}`,
            html: emailHtml,
            text: emailText,
          }),
        });

        if (!resendResponse.ok) {
          resendFailed = true;
          resendErrorMessage = await resendResponse.text();
          console.error("Failed to send new-order admin email via Resend", resendErrorMessage);
        }
      } catch (emailError) {
        resendFailed = true;
        resendErrorMessage = emailError instanceof Error ? emailError.message : "Unknown error while sending email";
        console.error("Unexpected error sending new-order admin email", emailError);
      }
    }

    const { error: insertError } = await adminClient.from("admin_notifications").insert(allNotifications);
    if (insertError) {
      console.error("Failed to insert admin notification", insertError);
      return jsonResponse(500, { success: false, message: "Failed to create admin notification" });
    }

    if (resendFailed) {
      return jsonResponse(500, {
        success: false,
        message: resendErrorMessage
          ? `Notification created, but admin email failed: ${resendErrorMessage}`
          : "Notification created, but admin email failed",
      });
    }

    return jsonResponse(200, { success: true, message: "Admin notification created and email sent" });
  } catch (error) {
    console.error("Unexpected error in send_new_order_admin_notification", error);
    return jsonResponse(500, { success: false, message: "Unexpected error while creating admin notification" });
  }
});
