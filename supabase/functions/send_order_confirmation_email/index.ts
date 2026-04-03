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

interface OrderPayload {
  id: string;
  order_number: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number | null;
  total: number;
  payment_method: string | null;
  mobile_money_number: string | null;
  shipping_address_snapshot: Record<string, unknown> | null;
  confirmation_email_sent: boolean;
  customer: {
    first_name: string | null;
    email: string | null;
  } | null;
  order_items: Array<{
    product_name: string;
    product_image_url: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    variant_label: string | null;
  }>;
}

const formatAmount = (value: number) => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.max(0, Number(value || 0)));
  } catch {
    return Math.max(0, Number(value || 0)).toLocaleString("en-GH");
  }
};

const titleCase = (value: string): string =>
  value
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const normalizeBusinessDayWindow = (
  snapshot: Record<string, unknown> | null,
): { minDays: number; maxDays: number } => {
  const minCandidate = snapshot?.estimated_days_min;
  const maxCandidate = snapshot?.estimated_days_max;

  const minDays =
    typeof minCandidate === "number" && Number.isFinite(minCandidate)
      ? Math.max(1, Math.round(minCandidate))
      : 2;
  const maxDays =
    typeof maxCandidate === "number" && Number.isFinite(maxCandidate)
      ? Math.max(minDays, Math.round(maxCandidate))
      : Math.max(minDays + 2, 5);

  return { minDays, maxDays };
};

const buildAddressLines = (snapshot: Record<string, unknown> | null): string[] => {
  if (!snapshot) {
    return [];
  }

  const recipient = typeof snapshot.recipient_name === "string" ? snapshot.recipient_name.trim() : "";
  const addressLine1 = typeof snapshot.address_line1 === "string" ? snapshot.address_line1.trim() : "";
  const addressLine2 = typeof snapshot.address_line2 === "string" ? snapshot.address_line2.trim() : "";
  const city = typeof snapshot.city === "string" ? snapshot.city.trim() : "";
  const state = typeof snapshot.state === "string" ? snapshot.state.trim() : "";
  const country = typeof snapshot.country === "string" ? snapshot.country.trim() : "";

  const cityStateLine = [city, state].filter(Boolean).join(", ");

  return [recipient, addressLine1, addressLine2, cityStateLine, country].filter(Boolean);
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables for edge function");
    }

    const body = (await request.json().catch(() => ({}))) as { order_number?: string };
    const orderNumber = typeof body.order_number === "string" ? body.order_number.trim() : "";

    if (!orderNumber) {
      return new Response(JSON.stringify({ error: "order_number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rpcData, error: rpcError } = await adminClient.rpc("get_order_confirmation_details", {
      p_order_number: orderNumber,
    });

    if (rpcError) {
      throw rpcError;
    }

    const order = (rpcData ?? null) as OrderPayload | null;
    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.confirmation_email_sent) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: orderItemsData, error: orderItemsError } = await adminClient
      .from("order_items")
      .select("product_name, product_image_url, quantity, unit_price, subtotal, variant_label")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    if (orderItemsError) {
      throw orderItemsError;
    }

    const orderItems = (orderItemsData ?? order.order_items ?? []) as OrderPayload["order_items"];

    const customerEmail = order.customer?.email?.trim();
    if (!customerEmail) {
      throw new Error("Order customer email is missing");
    }

    if (!resendApiKey) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: "RESEND_API_KEY not set" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstNameRaw = order.customer?.first_name?.trim() || "there";
    const discountAmount = Math.max(0, Number(order.discount_amount || 0));
    const addressLines = buildAddressLines(order.shipping_address_snapshot);
    const { minDays, maxDays } = normalizeBusinessDayWindow(order.shipping_address_snapshot);
    const snapshot = await loadEmailBranding(adminClient, { fallbackSiteUrl: SITE_URL });
    const trackingBaseUrl = normalizeSiteUrl(snapshot.identity.siteUrl);
    const trackingUrl = `${trackingBaseUrl}/orders/${encodeURIComponent(order.order_number)}`;

    const itemRows = orderItems
      .map((item) => {
        const imageHtml = item.product_image_url
          ? `<img src="${escapeHtml(item.product_image_url)}" alt="${escapeHtml(item.product_name)}" width="54" height="72" style="width:54px;height:72px;object-fit:cover;border:1px solid ${snapshot.colors.border};" />`
          : `<div style="width:54px;height:72px;border:1px solid ${snapshot.colors.border};"></div>`;
        const variantLabel =
          typeof item.variant_label === "string" && item.variant_label.trim() ? item.variant_label.trim() : null;
        const variantHtml = variantLabel
          ? `<div style="font-family:${snapshot.typography.body};font-size:11px;color:${snapshot.colors.textMuted};margin-top:2px;">${escapeHtml(
              variantLabel,
            )}</div>`
          : "";

        return `
          <tr>
            <td style="padding:10px 0;vertical-align:top;border-top:1px solid ${snapshot.colors.border};">${imageHtml}</td>
            <td style="padding:10px 12px 10px 12px;vertical-align:top;border-top:1px solid ${snapshot.colors.border};">
              <div style="font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};">${escapeHtml(item.product_name)}</div>
              ${variantHtml}
              <div style="font-family:${snapshot.typography.body};font-size:11px;color:${snapshot.colors.textMuted};">Qty: ${item.quantity}</div>
            </td>
            <td style="padding:10px 0;vertical-align:top;text-align:right;border-top:1px solid ${snapshot.colors.border};font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textPrimary};">
              ${formatAmount(item.subtotal)}
            </td>
          </tr>
        `;
      })
      .join("");

    const addressHtml = addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("");

    const mobileMoneyLine = order.mobile_money_number
      ? `<div style="font-family:${snapshot.typography.body};font-size:12px;color:${snapshot.colors.textMuted};">${escapeHtml(order.mobile_money_number)}</div>`
      : "";

    const contentHtml = `
      <div style="font-family:${snapshot.typography.body};font-size:10px;letter-spacing:0.2em;color:${snapshot.colors.accent};text-transform:uppercase;">Order Confirmed</div>
      <h1 style="font-family:${snapshot.typography.heading};font-size:38px;font-weight:400;color:${snapshot.colors.textPrimary};margin:10px 0 12px 0;">Thank you, ${escapeHtml(firstNameRaw)}.</h1>
      <p style="font-family:${snapshot.typography.body};font-size:14px;color:${snapshot.colors.textMuted};line-height:1.8;margin:0 0 20px 0;">
        Your order <strong>${escapeHtml(order.order_number)}</strong> has been placed and is being processed.
      </p>

      <div style="border-top:1px solid ${snapshot.colors.border};padding-top:16px;">
        <div style="font-family:${snapshot.typography.body};font-size:10px;letter-spacing:0.2em;color:${snapshot.colors.accent};text-transform:uppercase;margin-bottom:8px;">Items</div>
        <table style="width:100%;border-collapse:collapse;">${itemRows}</table>
      </div>

      <div style="border-top:1px solid ${snapshot.colors.border};margin-top:14px;padding-top:14px;">
        <div style="display:flex;justify-content:space-between;font-family:${snapshot.typography.body};font-size:12px;color:${snapshot.colors.textMuted};margin-bottom:6px;"><span>Subtotal</span><span>${formatAmount(order.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;font-family:${snapshot.typography.body};font-size:12px;color:${snapshot.colors.textMuted};margin-bottom:6px;"><span>Shipping</span><span>${formatAmount(order.shipping_fee)}</span></div>
        ${
          discountAmount > 0
            ? `<div style="display:flex;justify-content:space-between;font-family:${snapshot.typography.body};font-size:12px;color:${snapshot.colors.accent};margin-bottom:6px;"><span>Discount</span><span>- ${formatAmount(
                discountAmount,
              )}</span></div>`
            : ""
        }
        <div style="display:flex;justify-content:space-between;font-family:${snapshot.typography.body};font-size:14px;color:${snapshot.colors.textPrimary};font-weight:600;"><span>Total</span><span>${formatAmount(order.total)}</span></div>
      </div>

      <div style="border-top:1px solid ${snapshot.colors.border};margin-top:16px;padding-top:16px;display:grid;gap:16px;">
        <div>
          <div style="font-family:${snapshot.typography.body};font-size:10px;letter-spacing:0.2em;color:${snapshot.colors.accent};text-transform:uppercase;margin-bottom:6px;">Delivery Address</div>
          <div style="font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textMuted};line-height:1.7;">${addressHtml}</div>
          <div style="font-family:${snapshot.typography.body};font-size:11px;color:${snapshot.colors.textMuted};margin-top:6px;">${minDays}-${maxDays} business days</div>
        </div>
        <div>
          <div style="font-family:${snapshot.typography.body};font-size:10px;letter-spacing:0.2em;color:${snapshot.colors.accent};text-transform:uppercase;margin-bottom:6px;">Payment</div>
          <div style="font-family:${snapshot.typography.body};font-size:13px;color:${snapshot.colors.textMuted};">${escapeHtml(
            titleCase(order.payment_method ?? "not specified"),
          )}</div>
          ${mobileMoneyLine}
        </div>
      </div>

      <div style="margin-top:22px;">
        <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:${snapshot.colors.primary};color:${snapshot.colors.primaryForeground};text-decoration:none;font-family:${snapshot.typography.body};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;padding:12px 16px;">
          View Order Status
        </a>
      </div>
    `;

    const emailHtml = renderEmailShell({
      snapshot,
      contentHtml,
      footerNote: `${snapshot.identity.storeName} order confirmation`,
    });

    const plainTextItems = orderItems
      .map((item) => {
        const variantLabel =
          typeof item.variant_label === "string" && item.variant_label.trim() ? item.variant_label.trim() : null;
        const itemName = variantLabel ? `${item.product_name} (${variantLabel})` : item.product_name;
        return `- ${itemName} x ${item.quantity}: ${formatAmount(item.subtotal)}`;
      })
      .join("\n");

    const plainText = [
      `Order Confirmed: ${order.order_number}`,
      "",
      `Hi ${firstNameRaw}, your order has been placed with ${snapshot.identity.storeName}.`,
      "",
      "Items:",
      plainTextItems,
      "",
      `Subtotal: ${formatAmount(order.subtotal)}`,
      `Shipping: ${formatAmount(order.shipping_fee)}`,
      discountAmount > 0 ? `Discount: - ${formatAmount(discountAmount)}` : null,
      `Total: ${formatAmount(order.total)}`,
      "",
      "Delivery Address:",
      ...addressLines,
      `${minDays}-${maxDays} business days`,
      "",
      "Payment:",
      titleCase(order.payment_method ?? "not specified"),
      order.mobile_money_number ?? "",
      "",
      `Track your order: ${trackingUrl}`,
      "",
      `Instagram: ${snapshot.identity.instagramUrl || "-"}`,
      `TikTok: ${snapshot.identity.tiktokUrl || "-"}`,
      `Facebook: ${snapshot.identity.facebookUrl || "-"}`,
      `Unsubscribe: ${snapshot.identity.unsubscribeUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formatFromEmail(
          snapshot.identity.storeName,
          Deno.env.get("ORDER_CONFIRMATION_FROM_EMAIL") || "orders@store.com",
        ),
        to: [customerEmail],
        reply_to: snapshot.identity.supportEmail,
        subject: `Order ${order.order_number} confirmed`,
        html: emailHtml,
        text: plainText,
        headers: {
          "List-Unsubscribe": `<${snapshot.identity.unsubscribeUrl}>`,
        },
      }),
    });

    if (!resendResponse.ok) {
      const message = await resendResponse.text();
      throw new Error(`Failed to send confirmation email: ${message}`);
    }

    const { error: updateError } = await adminClient
      .from("orders")
      .update({ confirmation_email_sent: true })
      .eq("id", order.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
