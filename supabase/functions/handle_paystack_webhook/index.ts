import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readString = (value: unknown): string =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const readNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const joinErrorText = (value: unknown): string => {
  const candidate = asRecord(value);
  if (!candidate) {
    return "";
  }

  return [
    readString(candidate.code),
    readString(candidate.message),
    readString(candidate.details),
    readString(candidate.hint),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

const appendNote = (existing: unknown, note: string): string => {
  const existingText = readString(existing).trim();
  return existingText ? `${existingText}\n${note}` : note;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const signature = request.headers.get("x-paystack-signature");
    const body = await request.text();

    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!secretKey || !supabaseUrl || !serviceRoleKey) {
      return new Response("Missing environment configuration", { status: 500 });
    }

    if (!signature) {
      return new Response("Unauthorized", { status: 401 });
    }

    const hash = createHmac("sha512", secretKey).update(body).digest("hex");
    if (hash !== signature) {
      return new Response("Unauthorized", { status: 401 });
    }

    const parsedEvent = JSON.parse(body) as unknown;
    const event = asRecord(parsedEvent);
    if (!event) {
      return jsonResponse(400, { error: "Invalid webhook payload" });
    }

    const eventType = readString(event.event);
    const data = asRecord(event.data);
    if (!eventType || !data) {
      return jsonResponse(400, { error: "Invalid webhook event payload" });
    }

    const reference = readString(data.reference);
    if (!reference) {
      return jsonResponse(200, { ok: true });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (eventType === "charge.success") {
      const rawAmount = readNumber(data.amount);
      const amountPaid = rawAmount === null ? null : rawAmount / 100;

      let shouldSendEmails = false;

      const { data: confirmData, error: confirmError } = await adminClient.rpc("confirm_paid_order_and_commit_stock", {
        p_order_number: reference,
        p_payment_reference: reference,
        p_amount_paid: amountPaid,
        p_changed_by: "paystack_webhook",
      });

      if (!confirmError) {
        const confirmPayload = asRecord(confirmData);
        const wasConfirmed = confirmPayload?.ok === true;
        const wasAlreadyPaid = confirmPayload?.already_paid === true;

        if (!wasConfirmed) {
          return jsonResponse(200, {
            ok: true,
            skipped: true,
            reason: readString(confirmPayload?.reason),
          });
        }

        if (wasAlreadyPaid) {
          return jsonResponse(200, { ok: true, skipped: true, already_paid: true });
        }

        shouldSendEmails = true;
      } else {
        const fallbackText = joinErrorText(confirmError);
        const fallbackAllowed =
          fallbackText.includes("confirm_paid_order_and_commit_stock") ||
          fallbackText.includes("could not find the function") ||
          fallbackText.includes("schema cache") ||
          fallbackText.includes("forbidden");

        if (!fallbackAllowed) {
          throw confirmError;
        }

        const { data: order, error: orderError } = await adminClient
          .from("orders")
          .select("id, order_number, total, status, payment_status, notes")
          .eq("order_number", reference)
          .maybeSingle();

        if (orderError) {
          throw orderError;
        }

        if (!order?.id || amountPaid === null) {
          return jsonResponse(200, { ok: true, skipped: true });
        }

        if (order.payment_status === "paid") {
          return jsonResponse(200, { ok: true, skipped: true, already_paid: true });
        }

        if (Math.abs(Number(order.total ?? 0) - amountPaid) > 1) {
          const mismatchNote = `Amount mismatch: expected ${order.total}, received ${amountPaid}`;

          const { error: reviewUpdateError } = await adminClient
            .from("orders")
            .update({
              payment_status: "review",
              notes: appendNote(order.notes, mismatchNote),
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);

          if (reviewUpdateError) {
            throw reviewUpdateError;
          }

          return jsonResponse(200, { ok: true, skipped: true, reason: "amount_mismatch" });
        }

        const paidAt = new Date().toISOString();
        const { error: fallbackConfirmError } = await adminClient
          .from("orders")
          .update({
            status: "confirmed",
            payment_status: "paid",
            paystack_reference: reference,
            payment_reference: reference,
            paid_at: paidAt,
            updated_at: paidAt,
          })
          .eq("id", order.id);

        if (fallbackConfirmError) {
          throw fallbackConfirmError;
        }

        if (order.status !== "confirmed") {
          const { error: historyError } = await adminClient.from("order_status_history").insert({
            order_id: order.id,
            previous_status: order.status,
            new_status: "confirmed",
            changed_by: "paystack_webhook",
            note: "Payment confirmed via Paystack",
            notified_customer: false,
          });

          if (historyError) {
            throw historyError;
          }
        }

        shouldSendEmails = true;
      }

      if (shouldSendEmails) {
        await Promise.allSettled([
          adminClient.functions.invoke("send_order_confirmation_email", {
            body: { order_number: reference },
          }),
          adminClient.functions.invoke("send_new_order_admin_notification", {
            body: { order_number: reference },
          }),
        ]);
      }
    }

    if (eventType === "charge.failed") {
      const { error: failedError } = await adminClient
        .from("orders")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("order_number", reference)
        .neq("payment_status", "paid");

      if (failedError) {
        throw failedError;
      }
    }

    return jsonResponse(200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
});
