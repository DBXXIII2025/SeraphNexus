import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { finalizeCheckoutSession } from "@/lib/checkoutFinalization";
import { isStoredBusinessPlan, normalizeBusinessPlan } from "@/lib/planConfig";

export const runtime = "nodejs";

const supabaseAdmin = createAdminClient();

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function logWebhook(stage: string, extra?: Record<string, unknown>) {
  console.log("[stripe/webhook]", {
    stage,
    ...(extra || {}),
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return new Response("Missing webhook secret", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: unknown) {
    console.error("[stripe/webhook]", {
      stage: "signature_failed",
      message: err instanceof Error ? err.message : "Unknown webhook signature error",
      finalSuccess: false,
    });
    return new Response("Webhook Error", { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      logWebhook("checkout_session_received", {
        eventType: event.type,
        sessionId: session.id,
        mode: session.mode,
        paymentStatus: session.payment_status || null,
        status: session.status || null,
      });

      if (session.mode === "subscription") {
        const businessId = asString(session.metadata?.business_id);
        const plan = asString(session.metadata?.plan);

        if (businessId && plan && isStoredBusinessPlan(plan)) {
          const normalizedPlan = normalizeBusinessPlan(plan);
          const updatePayload: Record<string, unknown> = {
            plan: normalizedPlan,
          };

          if (typeof session.customer === "string") {
            updatePayload.stripe_customer_id = session.customer;
          }

          const { error } = await supabaseAdmin
            .from("businesses")
            .update(updatePayload)
            .eq("id", businessId);

          if (error) {
            throw new Error(error.message);
          }

          logWebhook("subscription_business_updated", {
            sessionId: session.id,
            businessId,
            plan: normalizedPlan,
            finalSuccess: true,
          });
        }

        return new Response("OK", { status: 200 });
      }

      const result = await finalizeCheckoutSession({
        sessionId: session.id,
        source: "stripe/webhook",
        providedSession: session,
        orderRef:
          asString(session.metadata?.order_ref) ||
          asString(session.metadata?.checkout_intent_id),
      });

      logWebhook("finalization_complete", {
        eventType: event.type,
        sessionId: session.id,
        flowType: result.flowType,
        businessType: result.businessType,
        sourceTableWritten: result.sourceTable,
        recordId: result.recordId,
        recordAction: result.recordAction,
        duplicateRetryHandled: result.duplicateRetryHandled,
        finalSuccess: true,
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err: unknown) {
    console.error("[stripe/webhook]", {
      stage: "handler_failed",
      finalSuccess: false,
      message: err instanceof Error ? err.message : "Unknown webhook error",
      stack: err instanceof Error ? err.stack || null : null,
      eventType: event.type,
    });
    return new Response("Webhook error", { status: 500 });
  }
}
