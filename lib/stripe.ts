import Stripe from "stripe";
import { getAppUrl as resolveAppUrl } from "@/lib/appUrl";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

if (
  !stripeSecretKey.trim() ||
  stripeSecretKey.includes("...") ||
  (!stripeSecretKey.startsWith("sk_test_") &&
    !stripeSecretKey.startsWith("sk_live_"))
) {
  throw new Error(
    "Invalid STRIPE_SECRET_KEY in environment. Use your full real Stripe secret key from Stripe Dashboard."
  );
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2026-01-28.clover",
});

export function getAppUrl(req?: Request) {
  return resolveAppUrl(req);
}
