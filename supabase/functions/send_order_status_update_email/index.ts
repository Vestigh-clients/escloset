import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supportedStatuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"] as const;
type SupportedStatus = (typeof supportedStatuses)[number];
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://luxuriantgh.store";
const fromEmail = "Luxuriant <orders@luxuriantgh.store>";

interface OrderItemRow {
  product_name: string;
  product_image_url: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface OrderRow {
  id: string;
  order_number: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number | null;
  total: number;
  currency: string | null;
  cancel_reason: string | null;
  shipping_address_snapshot: Record<string, unknown> | null;
  customers: Record<string, unknown> | Record<string, unknown>[] | null;
  order_items: OrderItemRow[] | null;
  order_status_history: Array<{
    new_status: string;
    note: string | null;
    changed_at: string;
  }> | null;
}

interface SiteSettings {
  supportEmail: string;
  siteUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  unsubscribeUrl: string;
}

interface EmailTemplate {
  subject: string;
  ctaLabel: string;
  ctaUrl: string;
  includeOrderSummary: boolean;
  includeDeliveryAddress: boolean;
  greetingLine: string;
  bodyLines: string[];
}

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

const safeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const safeNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatCurrency = (value: number, currency: string | null) => {
  const normalizedCurrency = safeString(currency) || "GHS";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.max(0, value));
  } catch {
    return Math.max(0, value).toLocaleString("en-GH");
  }
};

const jsonResponse = (status: number, payload: { success: boolean; message: string }) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const normalizeSiteUrl = (value: string) => value.replace(/\/+$/, "");

const pickFirstString = (record: Record<string, unknown> | null, keys: string[]) => {
  if (!record) return null;
  for (const key of keys) {
    const candidate = safeString(record[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
};

const getAddressLines = (snapshot: Record<string, unknown> | null): string[] => {
  if (!snapshot) {
    return [];
  }

  const recipient = safeString(snapshot.recipient_name) || "";
  const addressLine1 = safeString(snapshot.address_line1) || "";
  const addressLine2 = safeString(snapshot.address_line2) || "";
  const city = safeString(snapshot.city) || "";
  const state = safeString(snapshot.state) || "";
  const country = safeString(snapshot.country) || "";
  const cityState = [city, state].filter(Boolean).join(", ");

  return [recipient, addressLine1, addressLine2, cityState, country].filter(Boolean);
};

const resolveDeliveryWindow = async (
  adminClient: ReturnType<typeof createClient>,
  shippingSnapshot: Record<string, unknown> | null,
): Promise<{ minDays: number; maxDays: number }> => {
  const defaultMin = Math.max(1, Math.round(safeNumber(shippingSnapshot?.estimated_days_min, 2)));
  const defaultMax = Math.max(defaultMin, Math.round(safeNumber(shippingSnapshot?.estimated_days_max, 5)));

  const state = safeString(shippingSnapshot?.state);
  if (!state) {
    return { minDays: defaultMin, maxDays: defaultMax };
  }

  const resolveMinMax = (row: Record<string, unknown> | null) => {
    const minDays = Math.max(1, Math.round(safeNumber(row?.estimated_days_min, defaultMin)));
    const maxDays = Math.max(minDays, Math.round(safeNumber(row?.estimated_days_max, defaultMax)));
    return { minDays, maxDays };
  };

  const { data: stateRate, error: stateError } = await adminClient
    .from("shipping_rates")
    .select("estimated_days_min, estimated_days_max")
    .eq("is_active", true)
    .contains("states", [state])
    .maybeSingle();

  if (!stateError && stateRate) {
    return resolveMinMax(stateRate as Record<string, unknown>);
  }

  if (stateError && stateError.code !== "PGRST116") {
    console.warn("Unable to resolve shipping rate for state", stateError);
  }

  const { data: fallbackRate, error: fallbackError } = await adminClient
    .from("shipping_rates")
    .select("estimated_days_min, estimated_days_max")
    .eq("is_active", true)
    .filter("states", "eq", "[]")
    .maybeSingle();

  if (!fallbackError && fallbackRate) {
    return resolveMinMax(fallbackRate as Record<string, unknown>);
  }

  if (fallbackError && fallbackError.code !== "PGRST116") {
    console.warn("Unable to resolve fallback shipping rate", fallbackError);
  }

  return { minDays: defaultMin, maxDays: defaultMax };
};

const loadSiteSettings = async (
  adminClient: ReturnType<typeof createClient>,
): Promise<SiteSettings> => {
  const fallbackSiteUrl = normalizeSiteUrl(SITE_URL);

  const defaults: SiteSettings = {
    supportEmail: safeString(Deno.env.get("SUPPORT_EMAIL")) || "support@yourdomain.com",
    siteUrl: fallbackSiteUrl,
    instagramUrl: safeString(Deno.env.get("INSTAGRAM_URL")) || "https://instagram.com/luxuriant",
    tiktokUrl: safeString(Deno.env.get("TIKTOK_URL")) || "https://tiktok.com/@luxuriant",
    facebookUrl: safeString(Deno.env.get("FACEBOOK_URL")) || "https://facebook.com/luxuriant",
    unsubscribeUrl: safeString(Deno.env.get("UNSUBSCRIBE_URL")) || `${fallbackSiteUrl}/unsubscribe`,
  };

  const { data, error } = await adminClient.from("site_settings").select("*").limit(1).maybeSingle();

  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") {
      console.warn("Unable to load site settings, using defaults", error);
    }
    return defaults;
  }

  const settingsRecord = asRecord(data);
  const siteUrl = normalizeSiteUrl(
    pickFirstString(settingsRecord, ["site_url", "website_url", "public_site_url", "storefront_url"]) ||
      defaults.siteUrl,
  );

  return {
    supportEmail:
      pickFirstString(settingsRecord, ["support_email", "customer_support_email", "contact_email", "email"]) ||
      defaults.supportEmail,
    siteUrl,
    instagramUrl: pickFirstString(settingsRecord, ["instagram_url", "instagram", "instagram_link"]) || defaults.instagramUrl,
    tiktokUrl: pickFirstString(settingsRecord, ["tiktok_url", "tiktok", "tiktok_link"]) || defaults.tiktokUrl,
    facebookUrl: pickFirstString(settingsRecord, ["facebook_url", "facebook", "facebook_link"]) || defaults.facebookUrl,
    unsubscribeUrl:
      pickFirstString(settingsRecord, ["unsubscribe_url", "email_unsubscribe_url"]) || `${siteUrl}/unsubscribe`,
  };
};

const buildOrderRowsHtml = (items: OrderItemRow[], currency: string | null) =>
  items
    .map((item, index) => {
      const rowColor = index % 2 === 0 ? "#F5F0E8" : "#EDE8DF";
      const imageHtml = item.product_image_url
        ? `<img src="${escapeHtml(item.product_image_url)}" alt="${escapeHtml(item.product_name)}" width="60" height="80" style="display:block;width:60px;height:80px;object-fit:cover;" />`
        : `<div style="width:60px;height:80px;background:#DED8CF;"></div>`;

      return `
        <tr style="background:${rowColor};">
          <td style="padding:10px 12px;vertical-align:middle;">
            ${imageHtml}
          </td>
          <td style="padding:10px 12px;vertical-align:middle;font-size:14px;color:#1A1A1A;">
            ${escapeHtml(item.product_name)}
          </td>
          <td style="padding:10px 12px;vertical-align:middle;font-size:13px;color:#1A1A1A;text-align:center;">
            ${Math.max(1, Math.round(safeNumber(item.quantity, 1)))}
          </td>
          <td style="padding:10px 12px;vertical-align:middle;font-size:13px;color:#1A1A1A;text-align:right;">
            ${escapeHtml(formatCurrency(safeNumber(item.subtotal), currency))}
          </td>
        </tr>
      `;
    })
    .join("");

const buildTotalsHtml = (
  subtotal: number,
  shippingFee: number,
  discountAmount: number,
  total: number,
  currency: string | null,
) => `
  <div style="margin-top:20px;text-align:right;">
    <div style="font-size:14px;color:#1A1A1A;line-height:1.7;">Subtotal: ${escapeHtml(formatCurrency(subtotal, currency))}</div>
    <div style="font-size:14px;color:#1A1A1A;line-height:1.7;">Shipping: ${escapeHtml(formatCurrency(shippingFee, currency))}</div>
    ${
      discountAmount > 0
        ? `<div style="font-size:14px;color:#1A1A1A;line-height:1.7;">Discount: -${escapeHtml(
            formatCurrency(discountAmount, currency),
          )}</div>`
        : ""
    }
    <div style="font-size:16px;color:#1A1A1A;line-height:1.7;font-weight:bold;">Total: ${escapeHtml(
      formatCurrency(total, currency),
    )}</div>
  </div>
`;

const buildEmailTemplate = (
  status: SupportedStatus,
  order: OrderRow,
  firstName: string,
  cancelReason: string | null,
  deliveryWindow: { minDays: number; maxDays: number } | null,
  siteUrl: string,
): EmailTemplate => {
  const safeOrderNumber = order.order_number;
  const orderStatusUrl = `${siteUrl}/orders/${encodeURIComponent(order.order_number)}`;
  const shopUrl = `${siteUrl}/shop`;

  if (status === "confirmed") {
    return {
      subject: `Your order ${safeOrderNumber} is confirmed`,
      ctaLabel: "View Order Status",
      ctaUrl: orderStatusUrl,
      includeOrderSummary: true,
      includeDeliveryAddress: true,
      greetingLine: `Hi ${firstName},`,
      bodyLines: [
        "Your order has been confirmed and is being prepared.",
        "We'll update you when your order ships. Questions? Reply to this email.",
      ],
    };
  }

  if (status === "processing") {
    return {
      subject: `We're preparing your order ${safeOrderNumber}`,
      ctaLabel: "View Order Status",
      ctaUrl: orderStatusUrl,
      includeOrderSummary: true,
      includeDeliveryAddress: false,
      greetingLine: `Hi ${firstName},`,
      bodyLines: ["Great news - your order is currently being prepared for dispatch."],
    };
  }

  if (status === "shipped") {
    const range = deliveryWindow ? `${deliveryWindow.minDays}-${deliveryWindow.maxDays} business days` : "2-5 business days";
    return {
      subject: `Your order ${safeOrderNumber} is on its way`,
      ctaLabel: "Track Your Order",
      ctaUrl: orderStatusUrl,
      includeOrderSummary: true,
      includeDeliveryAddress: true,
      greetingLine: `Hi ${firstName},`,
      bodyLines: [
        "Your order has been dispatched and is on its way to you.",
        `Estimated delivery: ${range}`,
        "Please confirm your delivery address below.",
      ],
    };
  }

  if (status === "delivered") {
    return {
      subject: `Your order ${safeOrderNumber} has been delivered`,
      ctaLabel: "Shop Again",
      ctaUrl: shopUrl,
      includeOrderSummary: true,
      includeDeliveryAddress: false,
      greetingLine: `Hi ${firstName},`,
      bodyLines: ["Your order has been delivered. We hope you love everything.", "Thank you for shopping with Luxuriant."],
    };
  }

  return {
    subject: `Your order ${safeOrderNumber} has been cancelled`,
    ctaLabel: "Continue Shopping",
    ctaUrl: shopUrl,
    includeOrderSummary: false,
    includeDeliveryAddress: false,
    greetingLine: `Hi ${firstName},`,
    bodyLines: [
      "Your order has been cancelled.",
      ...(cancelReason ? [`Reason: ${cancelReason}`] : []),
      "If you have any questions please reply to this email.",
    ],
  };
};

const buildEmailHtml = (
  order: OrderRow,
  items: OrderItemRow[],
  addressLines: string[],
  template: EmailTemplate,
  siteSettings: SiteSettings,
) => {
  const rowsHtml = buildOrderRowsHtml(items, order.currency);
  const subtotal = safeNumber(order.subtotal);
  const shippingFee = safeNumber(order.shipping_fee);
  const discountAmount = Math.max(0, safeNumber(order.discount_amount));
  const total = safeNumber(order.total);

  const summaryTable = template.includeOrderSummary
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:26px;border:1px solid #E3DDD4;">
        <thead>
          <tr style="background:#1A1A1A;color:#F5F0E8;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Item</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Name</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Price</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${buildTotalsHtml(subtotal, shippingFee, discountAmount, total, order.currency)}
    `
    : "";

  const addressBlock =
    template.includeDeliveryAddress && addressLines.length > 0
      ? `
      <div style="margin-top:24px;">
        <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#1A1A1A;">Delivery Address</p>
        <div style="font-size:14px;line-height:1.8;color:#1A1A1A;">
          ${addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
        </div>
      </div>
    `
      : "";

  const bodyLines = template.bodyLines
    .map((line) => `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:#1A1A1A;">${escapeHtml(line)}</p>`)
    .join("");

  return `
    <div style="background:#F5F0E8;padding:28px 14px;font-family:Georgia,'Times New Roman',Times,serif;">
      <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E3DDD4;">
        <div style="background:#1A1A1A;padding:32px;text-align:center;">
          <p style="margin:0;font-size:20px;color:#F5F0E8;letter-spacing:0.2em;">LUXURIANT</p>
        </div>

        <div style="padding:40px;">
          <p style="margin:0 0 14px 0;font-size:18px;line-height:1.6;color:#1A1A1A;">${escapeHtml(template.greetingLine)}</p>
          ${bodyLines}
          ${summaryTable}
          ${addressBlock}

          <div style="margin-top:28px;">
            <a href="${escapeHtml(template.ctaUrl)}" style="display:inline-block;background:#1A1A1A;color:#F5F0E8;padding:14px 32px;text-decoration:none;border-radius:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
              ${escapeHtml(template.ctaLabel)}
            </a>
          </div>
        </div>

        <div style="padding:22px 40px 34px;border-top:1px solid #E3DDD4;text-align:center;">
          <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">Luxuriant - Luxury Fashion & Hair Care</p>
          <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">
            <a href="${escapeHtml(siteSettings.instagramUrl)}" style="color:#AAAAAA;text-decoration:none;">Instagram</a>
            &nbsp;|&nbsp;
            <a href="${escapeHtml(siteSettings.tiktokUrl)}" style="color:#AAAAAA;text-decoration:none;">TikTok</a>
            &nbsp;|&nbsp;
            <a href="${escapeHtml(siteSettings.facebookUrl)}" style="color:#AAAAAA;text-decoration:none;">Facebook</a>
          </p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">
            <a href="${escapeHtml(siteSettings.unsubscribeUrl)}" style="color:#AAAAAA;text-decoration:underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    </div>
  `;
};

const buildEmailText = (
  order: OrderRow,
  items: OrderItemRow[],
  addressLines: string[],
  template: EmailTemplate,
  siteSettings: SiteSettings,
) => {
  const lines: string[] = [template.greetingLine, "", ...template.bodyLines, ""];

  if (template.includeOrderSummary) {
    lines.push("Order summary:");
    lines.push(
      ...items.map(
        (item) =>
          `- ${item.product_name} x ${Math.max(1, Math.round(safeNumber(item.quantity, 1)))}: ${formatCurrency(
            safeNumber(item.subtotal),
            order.currency,
          )}`,
      ),
    );
    lines.push("");
    lines.push(`Subtotal: ${formatCurrency(safeNumber(order.subtotal), order.currency)}`);
    lines.push(`Shipping: ${formatCurrency(safeNumber(order.shipping_fee), order.currency)}`);
    if (safeNumber(order.discount_amount) > 0) {
      lines.push(`Discount: -${formatCurrency(safeNumber(order.discount_amount), order.currency)}`);
    }
    lines.push(`Total: ${formatCurrency(safeNumber(order.total), order.currency)}`);
    lines.push("");
  }

  if (template.includeDeliveryAddress && addressLines.length > 0) {
    lines.push("Delivery address:");
    lines.push(...addressLines);
    lines.push("");
  }

  lines.push(`${template.ctaLabel}: ${template.ctaUrl}`);
  lines.push("");
  lines.push(`Instagram: ${siteSettings.instagramUrl}`);
  lines.push(`TikTok: ${siteSettings.tiktokUrl}`);
  lines.push(`Facebook: ${siteSettings.facebookUrl}`);
  lines.push(`Unsubscribe: ${siteSettings.unsubscribeUrl}`);

  return lines.join("\n");
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
    const body = (await request.json().catch(() => ({}))) as {
      order_number?: string;
      new_status?: string;
      cancel_reason?: string;
    };

    const orderNumber = safeString(body.order_number);
    const newStatusRaw = safeString(body.new_status)?.toLowerCase();
    const cancelReasonFromBody = safeString(body.cancel_reason);

    if (!orderNumber) {
      return jsonResponse(400, { success: false, message: "order_number is required" });
    }

    if (!newStatusRaw || !supportedStatuses.includes(newStatusRaw as SupportedStatus)) {
      return jsonResponse(400, { success: false, message: "new_status is required and must be a valid status" });
    }

    const newStatus = newStatusRaw as SupportedStatus;

    const { data, error } = await adminClient
      .from("orders")
      .select(
        `
        *,
        customers (
          first_name, last_name, email
        ),
        order_items (
          product_name, product_image_url, unit_price, quantity, subtotal
        ),
        order_status_history (
          new_status, note, changed_at
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
    const customerEmail = safeString(customer?.email);
    const firstName = safeString(customer?.first_name) || "there";
    const shippingSnapshot = asRecord(order.shipping_address_snapshot);
    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
    const addressLines = getAddressLines(shippingSnapshot);

    if (!customerEmail) {
      return jsonResponse(500, { success: false, message: "Order customer email is missing" });
    }

    if (!resendApiKey) {
      return jsonResponse(500, { success: false, message: "RESEND_API_KEY is not configured" });
    }

    const siteSettings = await loadSiteSettings(adminClient);
    const deliveryWindow = newStatus === "shipped" ? await resolveDeliveryWindow(adminClient, shippingSnapshot) : null;
    const cancelReason = cancelReasonFromBody || safeString(order.cancel_reason);

    const template = buildEmailTemplate(newStatus, order, firstName, cancelReason, deliveryWindow, siteSettings.siteUrl);
    const html = buildEmailHtml(order, orderItems, addressLines, template, siteSettings);
    const text = buildEmailText(order, orderItems, addressLines, template, siteSettings);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [customerEmail],
        reply_to: siteSettings.supportEmail,
        subject: template.subject,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${siteSettings.unsubscribeUrl}>`,
        },
      }),
    });

    if (!resendResponse.ok) {
      const resendErrorBody = await resendResponse.text();
      console.error("Resend failed while sending order status update email", resendErrorBody);
      return jsonResponse(500, { success: false, message: "Failed to send order status update email" });
    }

    const { error: updateError } = await adminClient
      .from("order_status_history")
      .update({ notified_customer: true })
      .eq("order_id", order.id)
      .eq("new_status", newStatus)
      .order("changed_at", { ascending: false })
      .limit(1);

    if (updateError) {
      console.error("Failed to update notified_customer on order_status_history", updateError);
      return jsonResponse(200, {
        success: true,
        message: "Email sent, but notification flag could not be updated",
      });
    }

    return jsonResponse(200, { success: true, message: "Order status update email sent successfully" });
  } catch (error) {
    console.error("Unexpected error in send_order_status_update_email", error);
    return jsonResponse(500, { success: false, message: "Unexpected error while sending status update email" });
  }
});
