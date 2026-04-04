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

  const rawValue = asRecord(data)?.value;
  if (typeof rawValue === "string" && rawValue.trim()) {
    return rawValue.trim();
  }

  if (typeof rawValue === "number" || typeof rawValue === "boolean") {
    return String(rawValue);
  }

  const nestedRecord = asRecord(rawValue);
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
    const fulfillmentDays = await resolveFulfillmentDays(adminClient);
    const snapshot = await loadEmailBranding(adminClient, { fallbackSiteUrl: SITE_URL });
    const normalizedSiteUrl = normalizeSiteUrl(snapshot.identity.siteUrl);
    const shopUrl = `${normalizedSiteUrl}/shop`;

    const contentHtml = `
      <p style="margin:0 0 14px 0;font-family:${snapshot.typography.body};font-size:18px;line-height:1.6;color:${snapshot.colors.textPrimary};">
        Hi ${escapeHtml(firstName)},
      </p>
      <h1 style="margin:0 0 16px 0;font-family:${snapshot.typography.heading};font-size:36px;line-height:1.1;color:${snapshot.colors.textPrimary};">
        Welcome to ${escapeHtml(snapshot.identity.storeName)}.
      </h1>
      <p style="margin:0 0 14px 0;font-family:${snapshot.typography.body};font-size:15px;line-height:1.75;color:${snapshot.colors.textPrimary};">
        Your account is ready. You can now browse the full collection, check out faster, and track orders from one place.
      </p>

      <div style="margin:18px 0 22px 0;padding:18px;border:1px solid ${snapshot.colors.border};background:${snapshot.colors.canvas};">
        <p style="margin:0 0 10px 0;font-family:${snapshot.typography.body};font-size:13px;line-height:1.7;color:${snapshot.colors.textPrimary};">
          Premium products curated with care
        </p>
        <p style="margin:0 0 10px 0;font-family:${snapshot.typography.body};font-size:13px;line-height:1.7;color:${snapshot.colors.textPrimary};">
          Nationwide delivery across Ghana
        </p>
        <p style="margin:0;font-family:${snapshot.typography.body};font-size:13px;line-height:1.7;color:${snapshot.colors.textPrimary};">
          Orders fulfilled within ${fulfillmentDays} day${fulfillmentDays === 1 ? "" : "s"}
        </p>
      </div>

      <div style="margin-top:24px;">
        <a href="${escapeHtml(shopUrl)}" style="display:inline-block;background:${snapshot.colors.primary};color:${snapshot.colors.primaryForeground};padding:14px 28px;text-decoration:none;font-family:${snapshot.typography.body};font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">
          Start Shopping
        </a>
      </div>

      <div style="margin-top:24px;">
        <p style="margin:0 0 8px 0;font-family:${snapshot.typography.body};font-size:15px;line-height:1.7;color:${snapshot.colors.textPrimary};">
          We’re glad you’re here.
        </p>
        <p style="margin:0;font-family:${snapshot.typography.body};font-size:15px;line-height:1.7;color:${snapshot.colors.textPrimary};">
          The ${escapeHtml(snapshot.identity.storeName)} Team
        </p>
      </div>
    `;

    const emailHtml = renderEmailShell({
      snapshot,
      contentHtml,
      footerNote: `You're receiving this because you created an account at ${normalizedSiteUrl}`,
    });

    const emailText = [
      `Hi ${firstName},`,
      "",
      `Welcome to ${snapshot.identity.storeName}.`,
      "Your account is ready. You can now browse the full collection, check out faster, and track orders from one place.",
      "",
      "- Premium products curated with care",
      "- Nationwide delivery across Ghana",
      `- Orders fulfilled within ${fulfillmentDays} day${fulfillmentDays === 1 ? "" : "s"}`,
      "",
      `Start Shopping: ${shopUrl}`,
      "",
      `The ${snapshot.identity.storeName} Team`,
      "",
      `Instagram: ${snapshot.identity.instagramUrl || "-"}`,
      `TikTok: ${snapshot.identity.tiktokUrl || "-"}`,
      `Facebook: ${snapshot.identity.facebookUrl || "-"}`,
      `Unsubscribe: ${snapshot.identity.unsubscribeUrl}`,
      `You're receiving this because you created an account at ${normalizedSiteUrl}`,
    ].join("\n");
    const senderEmailAddress = safeString(Deno.env.get("WELCOME_FROM_EMAIL_ADDRESS")) || snapshot.identity.supportEmail;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formatFromEmail(
          snapshot.identity.storeName,
          senderEmailAddress,
        ),
        to: [customerEmail],
        reply_to: snapshot.identity.supportEmail,
        subject: `Welcome to ${snapshot.identity.storeName}, ${firstName}.`,
        html: emailHtml,
        text: emailText,
        headers: {
          "List-Unsubscribe": `<${snapshot.identity.unsubscribeUrl}>`,
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
