import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://luxuriantgh.store";
const fromEmail = "Luxuriant <hello@luxuriantgh.store>";

interface CustomerRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
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

const safeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

  const value = asRecord(data)?.value;
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const nested = asRecord(value);
  if (!nested) {
    return null;
  }

  for (const nestedKey of ["value", "email", "address", "url"]) {
    const candidate = safeString(nested[nestedKey]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const resolveFulfillmentDays = async (adminClient: ReturnType<typeof createClient>): Promise<number> => {
  const explicitValue = await getSettingValue(adminClient, "fulfillment_days");
  const explicitDays = Number(explicitValue);
  if (Number.isFinite(explicitDays) && explicitDays > 0) {
    return Math.max(1, Math.round(explicitDays));
  }

  const { data, error } = await adminClient
    .from("shipping_rates")
    .select("estimated_days_max")
    .eq("is_active", true);

  if (error) {
    console.warn("Unable to fetch shipping rates for fulfillment days fallback", error);
    return 5;
  }

  const maxDays = (data ?? []).reduce((currentMax, row) => {
    const candidate = Number((row as Record<string, unknown>).estimated_days_max);
    if (!Number.isFinite(candidate) || candidate <= 0) {
      return currentMax;
    }
    return Math.max(currentMax, Math.round(candidate));
  }, 0);

  return maxDays > 0 ? maxDays : 5;
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
    const body = (await request.json().catch(() => ({}))) as { customer_id?: string };
    const customerId = safeString(body.customer_id);

    if (!customerId) {
      return jsonResponse(400, { success: false, message: "customer_id is required" });
    }

    const { data, error } = await adminClient
      .from("customers")
      .select("first_name, last_name, email")
      .eq("id", customerId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return jsonResponse(404, { success: false, message: "Customer not found" });
      }
      throw error;
    }

    const customer = data as CustomerRow | null;
    if (!customer) {
      return jsonResponse(404, { success: false, message: "Customer not found" });
    }

    const customerEmail = safeString(customer.email);
    if (!customerEmail) {
      return jsonResponse(500, { success: false, message: "Customer email is missing" });
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured for send_welcome_email");
      return jsonResponse(500, { success: false, message: "Welcome email failed to send" });
    }

    const firstName = safeString(customer.first_name) || "there";
    const siteUrl =
      safeString(await getSettingValue(adminClient, "site_url")) ||
      SITE_URL;
    const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
    const instagramUrl = safeString(await getSettingValue(adminClient, "instagram_url")) || "https://instagram.com/luxuriant";
    const tiktokUrl = safeString(await getSettingValue(adminClient, "tiktok_url")) || "https://tiktok.com/@luxuriant";
    const facebookUrl = safeString(await getSettingValue(adminClient, "facebook_url")) || "https://facebook.com/luxuriant";
    const unsubscribeUrl =
      safeString(await getSettingValue(adminClient, "unsubscribe_url")) || `${normalizedSiteUrl}/unsubscribe`;
    const fulfillmentDays = await resolveFulfillmentDays(adminClient);

    const categories = [
      { label: "Hair Care", href: `${normalizedSiteUrl}/hair-care` },
      { label: "Men", href: `${normalizedSiteUrl}/men` },
      { label: "Women", href: `${normalizedSiteUrl}/women` },
      { label: "Bags", href: `${normalizedSiteUrl}/bags` },
      { label: "Shoes", href: `${normalizedSiteUrl}/shoes` },
    ];

    const categoriesHtml = categories
      .map(
        (category) =>
          `<a href="${escapeHtml(category.href)}" style="color:#C4A882;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(
            category.label,
          )}</a>`,
      )
      .join('<span style="color:#C4A882;">&nbsp;|&nbsp;</span>');

    const shopUrl = `${normalizedSiteUrl}/shop`;
    const emailHtml = `
      <div style="background:#F5F0E8;padding:28px 14px;font-family:Georgia,'Times New Roman',Times,serif;">
        <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E3DDD4;">
          <div style="background:#1A1A1A;padding:32px;text-align:center;">
            <p style="margin:0;font-size:20px;color:#F5F0E8;letter-spacing:0.2em;">LUXURIANT</p>
          </div>

          <div style="padding:40px;">
            <p style="margin:0 0 14px 0;font-size:18px;line-height:1.6;color:#1A1A1A;">Hi ${escapeHtml(firstName)},</p>
            <p style="margin:0 0 14px 0;font-size:16px;line-height:1.7;color:#1A1A1A;">
              Welcome to Luxuriant. You now have access to our full collection of luxury fashion and hair care essentials.
            </p>

            <div style="margin:16px 0 22px 0;">
              <p style="margin:0 0 8px 0;font-size:14px;line-height:1.7;color:#1A1A1A;">- Premium quality, curated with care</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:1.7;color:#1A1A1A;">- Nationwide delivery across Ghana</p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#1A1A1A;">- Orders fulfilled within ${fulfillmentDays} days</p>
            </div>

            <div style="margin-top:24px;">
              <a href="${escapeHtml(shopUrl)}" style="display:inline-block;background:#1A1A1A;color:#F5F0E8;padding:14px 32px;text-decoration:none;border-radius:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
                Start Shopping
              </a>
            </div>

            <div style="margin-top:18px;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#1A1A1A;">Browse by category:</p>
              <div style="white-space:nowrap;overflow-x:auto;">${categoriesHtml}</div>
            </div>

            <div style="margin-top:24px;">
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.7;color:#1A1A1A;">Thank you for joining us.</p>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#1A1A1A;">- The Luxuriant Team</p>
            </div>
          </div>

          <div style="padding:22px 40px 34px;border-top:1px solid #E3DDD4;text-align:center;">
            <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">
              <a href="${escapeHtml(instagramUrl)}" style="color:#AAAAAA;text-decoration:none;">Instagram</a>
              &nbsp;|&nbsp;
              <a href="${escapeHtml(tiktokUrl)}" style="color:#AAAAAA;text-decoration:none;">TikTok</a>
              &nbsp;|&nbsp;
              <a href="${escapeHtml(facebookUrl)}" style="color:#AAAAAA;text-decoration:none;">Facebook</a>
            </p>
            <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">
              <a href="${escapeHtml(unsubscribeUrl)}" style="color:#AAAAAA;text-decoration:underline;">Unsubscribe</a>
            </p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#AAAAAA;">
              You're receiving this because you created an account at ${escapeHtml(normalizedSiteUrl)}
            </p>
          </div>
        </div>
      </div>
    `;

    const emailText = [
      `Hi ${firstName},`,
      "",
      "Welcome to Luxuriant. You now have access to our full collection of luxury fashion and hair care essentials.",
      "",
      "- Premium quality, curated with care",
      "- Nationwide delivery across Ghana",
      `- Orders fulfilled within ${fulfillmentDays} days`,
      "",
      `Start Shopping: ${shopUrl}`,
      "",
      "Browse by category:",
      `Hair Care: ${normalizedSiteUrl}/hair-care`,
      `Men: ${normalizedSiteUrl}/men`,
      `Women: ${normalizedSiteUrl}/women`,
      `Bags: ${normalizedSiteUrl}/bags`,
      `Shoes: ${normalizedSiteUrl}/shoes`,
      "",
      "Thank you for joining us.",
      "- The Luxuriant Team",
      "",
      `Instagram: ${instagramUrl}`,
      `TikTok: ${tiktokUrl}`,
      `Facebook: ${facebookUrl}`,
      `Unsubscribe: ${unsubscribeUrl}`,
      `You're receiving this because you created an account at ${normalizedSiteUrl}`,
    ].join("\n");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [customerEmail],
        subject: `Welcome to Luxuriant, ${firstName}.`,
        html: emailHtml,
        text: emailText,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
        },
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error("Failed to send welcome email", resendError);
      return jsonResponse(500, { success: false, message: "Failed to send welcome email" });
    }

    return jsonResponse(200, { success: true, message: "Welcome email sent" });
  } catch (error) {
    console.error("Unexpected error in send_welcome_email", error);
    return jsonResponse(500, { success: false, message: "Unexpected error while sending welcome email" });
  }
});
