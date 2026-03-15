import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://luxuriantgh.store";
const fromEmail = "Luxuriant Orders <orders@luxuriantgh.store>";

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

const safeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const safeNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toTitleCase = (value: string) =>
  value
    .split(/[_\s-]+/)
    .map((token) => (token ? token[0].toUpperCase() + token.slice(1).toLowerCase() : ""))
    .join(" ");

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatAmountGhs = (value: number): string =>
  `GH₵${Math.max(0, value).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

const buildItemsRowsHtml = (items: OrderItemRow[]): string =>
  items
    .map((item, index) => {
      const rowColor = index % 2 === 0 ? "#F5F0E8" : "#EDE8DF";
      return `
        <tr style="background:${rowColor};">
          <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;">${escapeHtml(item.product_name)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;text-align:center;">${Math.max(
            1,
            Math.round(safeNumber(item.quantity, 1)),
          )}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;text-align:right;">${escapeHtml(
            formatAmountGhs(safeNumber(item.unit_price)),
          )}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;text-align:right;">${escapeHtml(
            formatAmountGhs(safeNumber(item.subtotal)),
          )}</td>
        </tr>
      `;
    })
    .join("");

const buildEmailHtml = (params: {
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  adminOrderUrl: string;
  order: OrderRow;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLines: string[];
  deliveryInstructions: string | null;
  paymentMethodLabel: string;
  itemsRowsHtml: string;
}) => {
  const {
    instagramUrl,
    tiktokUrl,
    facebookUrl,
    adminOrderUrl,
    order,
    customerName,
    customerEmail,
    customerPhone,
    addressLines,
    deliveryInstructions,
    paymentMethodLabel,
    itemsRowsHtml,
  } = params;

  const subtotal = safeNumber(order.subtotal);
  const shippingFee = safeNumber(order.shipping_fee);
  const discount = Math.max(0, safeNumber(order.discount_amount));
  const total = safeNumber(order.total);

  return `
    <div style="background:#F5F0E8;padding:28px 14px;font-family:Georgia,'Times New Roman',Times,serif;">
      <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E3DDD4;">
        <div style="background:#1A1A1A;padding:32px;text-align:center;">
          <p style="margin:0;font-size:20px;color:#F5F0E8;letter-spacing:0.2em;">LUXURIANT</p>
        </div>

        <div style="padding:40px;">
          <p style="margin:0 0 16px 0;font-size:18px;color:#1A1A1A;">A new order has been placed.</p>

          <div style="border:1px solid #E3DDD4;background:#F9F6F1;padding:16px 18px;">
            <p style="margin:0 0 8px 0;font-size:13px;color:#1A1A1A;"><strong>Order #:</strong> ${escapeHtml(
              order.order_number,
            )}</p>
            <p style="margin:0 0 8px 0;font-size:13px;color:#1A1A1A;"><strong>Date:</strong> ${escapeHtml(
              formatDateLong(order.created_at),
            )}</p>
            <p style="margin:0 0 8px 0;font-size:13px;color:#1A1A1A;"><strong>Customer:</strong> ${escapeHtml(
              customerName,
            )}</p>
            <p style="margin:0 0 8px 0;font-size:13px;color:#1A1A1A;"><strong>Email:</strong> ${escapeHtml(
              customerEmail,
            )}</p>
            <p style="margin:0 0 8px 0;font-size:13px;color:#1A1A1A;"><strong>Phone:</strong> ${escapeHtml(
              customerPhone,
            )}</p>
            <p style="margin:0;font-size:13px;color:#1A1A1A;"><strong>Payment:</strong> ${escapeHtml(paymentMethodLabel)}</p>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:24px;border:1px solid #E3DDD4;">
            <thead>
              <tr style="background:#1A1A1A;color:#F5F0E8;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Product</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Qty</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Unit Price</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:normal;letter-spacing:0.08em;text-transform:uppercase;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>

          <div style="margin-top:18px;text-align:right;">
            <div style="font-size:14px;color:#1A1A1A;line-height:1.7;">Subtotal: ${escapeHtml(formatAmountGhs(subtotal))}</div>
            <div style="font-size:14px;color:#1A1A1A;line-height:1.7;">Shipping: ${escapeHtml(formatAmountGhs(shippingFee))}</div>
            <div style="font-size:14px;color:#1A1A1A;line-height:1.7;">Discount: ${escapeHtml(formatAmountGhs(discount))}</div>
            <div style="font-size:16px;color:#1A1A1A;line-height:1.7;font-weight:bold;">Total: ${escapeHtml(formatAmountGhs(total))}</div>
          </div>

          <div style="margin-top:24px;">
            <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#1A1A1A;">Delivery Address</p>
            <div style="font-size:14px;line-height:1.8;color:#1A1A1A;">
              ${addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
            </div>
            ${
              deliveryInstructions
                ? `<p style="margin:10px 0 0 0;font-size:13px;line-height:1.7;color:#1A1A1A;"><strong>Instructions:</strong> ${escapeHtml(
                    deliveryInstructions,
                  )}</p>`
                : ""
            }
          </div>

          <div style="margin-top:22px;">
            <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#1A1A1A;">Payment Method</p>
            <div style="font-size:14px;line-height:1.8;color:#1A1A1A;">
              <div>${escapeHtml(paymentMethodLabel)}</div>
              ${
                safeString(order.mobile_money_number)
                  ? `<div>Mobile Money: ${escapeHtml(safeString(order.mobile_money_number) || "")}</div>`
                  : ""
              }
            </div>
          </div>

          <div style="margin-top:28px;">
            <a href="${escapeHtml(adminOrderUrl)}" style="display:inline-block;background:#1A1A1A;color:#F5F0E8;padding:14px 32px;text-decoration:none;border-radius:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
              View Order in Admin
            </a>
          </div>
        </div>

        <div style="padding:22px 40px 34px;border-top:1px solid #E3DDD4;text-align:center;">
          <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">Luxuriant - Luxury Fashion & Hair Care</p>
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">
            <a href="${escapeHtml(instagramUrl)}" style="color:#AAAAAA;text-decoration:none;">Instagram</a>
            &nbsp;|&nbsp;
            <a href="${escapeHtml(tiktokUrl)}" style="color:#AAAAAA;text-decoration:none;">TikTok</a>
            &nbsp;|&nbsp;
            <a href="${escapeHtml(facebookUrl)}" style="color:#AAAAAA;text-decoration:none;">Facebook</a>
          </p>
        </div>
      </div>
    </div>
  `;
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
          product_name, product_image_url, unit_price, quantity, subtotal
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
    const firstName = safeString(customer?.first_name) || "Customer";
    const lastName = safeString(customer?.last_name) || "";
    const customerName = `${firstName} ${lastName}`.trim();
    const customerEmail = safeString(customer?.email) || "No email";
    const customerPhone = safeString(customer?.phone) || "No phone";
    const paymentMethodLabel = toTitleCase(safeString(order.payment_method) || "Not specified");
    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
    const shippingSnapshot = asRecord(order.shipping_address_snapshot);
    const addressLines = getAddressLines(shippingSnapshot);
    const deliveryInstructions = safeString(shippingSnapshot?.delivery_instructions);

    const siteUrl = (await getSettingValue(adminClient, "site_url")) || SITE_URL;
    const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
    const adminOrderUrl = `${normalizedSiteUrl}/admin/orders/${encodeURIComponent(order.order_number)}`;
    const instagramUrl = (await getSettingValue(adminClient, "instagram_url")) || "https://instagram.com/luxuriant";
    const tiktokUrl = (await getSettingValue(adminClient, "tiktok_url")) || "https://tiktok.com/@luxuriant";
    const facebookUrl = (await getSettingValue(adminClient, "facebook_url")) || "https://facebook.com/luxuriant";

    const notificationPayload = {
      type: "new_order",
      title: "New Order Received",
      description: `Order ${order.order_number} from ${customerName} — ${formatAmountGhs(safeNumber(order.total))}`,
      link: `/admin/orders/${order.order_number}`,
      is_read: false,
    };

    const adminNotificationEmail = await getSettingValue(adminClient, "new_order_email");
    if (!adminNotificationEmail) {
      console.warn("new_order_email is not configured in site_settings; skipping admin email send.");

      const { error: insertError } = await adminClient.from("admin_notifications").insert(notificationPayload);
      if (insertError) {
        console.error("Failed to insert admin notification", insertError);
        return jsonResponse(500, { success: false, message: "Failed to create admin notification" });
      }

      return jsonResponse(200, {
        success: true,
        message: "Notification created, email skipped — no admin email configured",
      });
    }

    let resendFailed = false;
    let resendErrorMessage = "";

    if (!resendApiKey) {
      resendFailed = true;
      resendErrorMessage = "RESEND_API_KEY is not configured";
      console.error(resendErrorMessage);
    } else {
      const itemsRowsHtml = buildItemsRowsHtml(orderItems);
      const emailHtml = buildEmailHtml({
        instagramUrl,
        tiktokUrl,
        facebookUrl,
        adminOrderUrl,
        order,
        customerName,
        customerEmail,
        customerPhone,
        addressLines,
        deliveryInstructions,
        paymentMethodLabel,
        itemsRowsHtml,
      });

      const emailText = [
        "A new order has been placed.",
        "",
        `Order #: ${order.order_number}`,
        `Date: ${formatDateLong(order.created_at)}`,
        `Customer: ${customerName}`,
        `Email: ${customerEmail}`,
        `Phone: ${customerPhone}`,
        `Payment: ${paymentMethodLabel}`,
        "",
        "Items:",
        ...orderItems.map(
          (item) =>
            `- ${item.product_name} | Qty: ${Math.max(1, Math.round(safeNumber(item.quantity, 1)))} | Unit: ${formatAmountGhs(
              safeNumber(item.unit_price),
            )} | Subtotal: ${formatAmountGhs(safeNumber(item.subtotal))}`,
        ),
        "",
        `Subtotal: ${formatAmountGhs(safeNumber(order.subtotal))}`,
        `Shipping: ${formatAmountGhs(safeNumber(order.shipping_fee))}`,
        `Discount: ${formatAmountGhs(Math.max(0, safeNumber(order.discount_amount)))}`,
        `Total: ${formatAmountGhs(safeNumber(order.total))}`,
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
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: [adminNotificationEmail],
            from: fromEmail,
            subject: `New Order ${order.order_number} — ${formatAmountGhs(safeNumber(order.total))}`,
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

    const { error: insertError } = await adminClient.from("admin_notifications").insert(notificationPayload);
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
