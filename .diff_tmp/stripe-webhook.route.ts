import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

const supabaseAdmin = createAdminClient();

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return new Response("Stripe is not configured", { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return new Response("Missing webhook secret", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return new Response("Webhook Error", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.kind === "slot_booking") {
        const metadata = session.metadata || {};

        const business_id = metadata.business_id;
        const date = metadata.date;
        const start_time = metadata.start_time;
        const end_time = metadata.end_time;
        const customer_email = metadata.customer_email;

        if (!business_id || !date || !start_time || !end_time || !customer_email) {
          console.error("Missing metadata in Stripe session");
          return new Response("OK", { status: 200 });
        }

        const { data: existing } = await supabaseAdmin
          .from("bookings")
          .select("id")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        if (!existing) {
          const amount = session.amount_total
            ? session.amount_total / 100
            : null;

          const { error } = await supabaseAdmin
            .from("bookings")
            .insert({
              business_id,
              date,
              start_time,
              end_time,
              customer_email,
              status: "confirmed",
              payment_status: session.payment_status || "paid",
              stripe_session_id: session.id,
              payment_intent_id: session.payment_intent as string,
              amount,
              demand_score: Number(metadata.demand_score || 0),
              price_adjustment: Number(metadata.price_adjustment || 0),
            });

          if (error) {
            console.error("Booking insert error:", error.message);
          }
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("Webhook handler error:", err.message);
    return new Response("Webhook error", { status: 500 });
  }
}
