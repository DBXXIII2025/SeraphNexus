import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getErrorMessage, logRouteError } from "@/lib/apiErrors";
import { buildCancelledStatusUpdate } from "@/lib/transactionVisibility";
import { updateCheckoutIntentSafely } from "@/lib/checkoutIntents";

const ALLOWED_STATUSES = new Set(["confirmed", "cancelled"]);

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function POST(req: Request) {
  let step = "request.validate";

  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const formData = await req.formData();

    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "");

    if (!id || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const bookingsTable = supabase.from("bookings") as any;
    const businessesTable = supabase.from("businesses") as any;

    const { data: booking } = await bookingsTable
      .select(
        "id, business_id, status, payment_status, stripe_session_id, payment_intent_id, metadata"
      )
      .eq("id", id)
      .maybeSingle();

    if (!booking?.business_id) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const { data: business } = await businessesTable
      .select("id")
      .eq("id", booking.business_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!business) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }

    const metadata = asRecord(booking.metadata);
    const checkoutIntentId = asString(metadata.checkout_intent_id);
    const paymentWasRefunded = booking.payment_status === "refunded";
    const paymentWasPaid = booking.payment_status === "paid";
    const nextPaymentStatus =
      paymentWasRefunded
        ? "refunded"
        : paymentWasPaid
          ? "paid"
          : booking.payment_status || "pending";

    console.log("[bookings/update-status]", {
      stage: "start",
      bookingId: id,
      businessId: business.id,
      previousStatus: booking.status || null,
      previousPaymentStatus: booking.payment_status || null,
      requestedStatus: status,
      checkoutIntentId,
      stripeSessionId: booking.stripe_session_id || null,
      paymentIntentId: booking.payment_intent_id || null,
    });

    let resolvedPaymentIntentId =
      asString(booking.payment_intent_id) || asString(metadata.payment_intent_id);
    let resolvedIntentStatus =
      status === "confirmed" && nextPaymentStatus === "paid" ? "paid" : status;
    let finalPaymentStatus = nextPaymentStatus;
    let refundAttempted = false;
    let refundSucceeded = false;
    let refundReason: string | null = null;

    if (status === "cancelled") {
      step = "refund.resolve";

      console.log("[bookings/update-status]", {
        stage: "cancel.lookup",
        bookingId: id,
        businessId: business.id,
        checkoutIntentId,
        paidBooking: paymentWasPaid,
        alreadyRefunded: paymentWasRefunded,
      });

      if (paymentWasRefunded) {
        finalPaymentStatus = "refunded";
        resolvedIntentStatus = "refunded";
        refundReason = "already_refunded";
      } else if (paymentWasPaid) {
        if (checkoutIntentId) {
          step = "checkout_intent.lookup";
          const { data: checkoutIntentRow } = await supabaseAdmin
            .from("checkout_intents")
            .select("id, status, stripe_payment_intent_id, stripe_checkout_session_id, metadata, meta_json")
            .eq("id", checkoutIntentId)
            .maybeSingle();

          const checkoutIntentMeta = asRecord(
            checkoutIntentRow?.metadata ?? checkoutIntentRow?.meta_json
          );
          resolvedPaymentIntentId =
            resolvedPaymentIntentId ||
            asString(checkoutIntentRow?.stripe_payment_intent_id) ||
            asString(checkoutIntentMeta.payment_intent_id);

          console.log("[bookings/update-status]", {
            stage: "refund.lookup.checkout_intent",
            bookingId: id,
            businessId: business.id,
            checkoutIntentId,
            checkoutIntentStatus: asString(checkoutIntentRow?.status),
            paymentIntentId: resolvedPaymentIntentId,
            stripeSessionId:
              asString(checkoutIntentRow?.stripe_checkout_session_id) || null,
          });
        }

        if (!resolvedPaymentIntentId && booking.stripe_session_id) {
          step = "stripe.session.lookup";

          const session = await stripe.checkout.sessions.retrieve(
            String(booking.stripe_session_id)
          );
          resolvedPaymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null;

          console.log("[bookings/update-status]", {
            stage: "refund.lookup.session",
            bookingId: id,
            businessId: business.id,
            stripeSessionId: booking.stripe_session_id,
            paymentIntentId: resolvedPaymentIntentId,
          });

          if (resolvedPaymentIntentId && resolvedPaymentIntentId !== booking.payment_intent_id) {
            await bookingsTable
              .update({ payment_intent_id: resolvedPaymentIntentId })
              .eq("id", id)
              .eq("business_id", business.id);
          }
        }

        if (resolvedPaymentIntentId) {
          step = "stripe.refund.lookup";
          refundAttempted = true;

          console.log("[bookings/update-status]", {
            stage: "refund.lookup.payment",
            bookingId: id,
            businessId: business.id,
            paymentIntentId: resolvedPaymentIntentId,
          });

          try {
            const existingRefunds = await stripe.refunds.list({
              payment_intent: resolvedPaymentIntentId,
              limit: 10,
            });
            const existingRefund = existingRefunds.data.find(
              (refund) => refund.status !== "failed" && refund.status !== "canceled"
            );

            if (existingRefund) {
              refundSucceeded = true;
              finalPaymentStatus = "refunded";
              resolvedIntentStatus = "refunded";
              refundReason = `existing_${existingRefund.status}`;

              console.log("[bookings/update-status]", {
                stage: "refund.existing",
                bookingId: id,
                businessId: business.id,
                paymentIntentId: resolvedPaymentIntentId,
                refundId: existingRefund.id,
                refundStatus: existingRefund.status,
              });
            } else {
              step = "stripe.refund.create";
              const refund = await stripe.refunds.create(
                {
                  payment_intent: resolvedPaymentIntentId,
                },
                {
                  idempotencyKey: `service-booking-cancel-${id}`,
                }
              );

              refundSucceeded =
                refund.status !== "failed" && refund.status !== "canceled";
              finalPaymentStatus = refundSucceeded ? "refunded" : nextPaymentStatus;
              resolvedIntentStatus = refundSucceeded ? "refunded" : "cancelled";
              refundReason = refund.status || "unknown";

              console.log("[bookings/update-status]", {
                stage: "refund.result",
                bookingId: id,
                businessId: business.id,
                paymentIntentId: resolvedPaymentIntentId,
                refundId: refund.id,
                refundStatus: refund.status,
                refundSucceeded,
              });
            }
          } catch (refundError) {
            finalPaymentStatus = nextPaymentStatus;
            resolvedIntentStatus = "cancelled";
            refundReason = getErrorMessage(refundError, "Refund lookup/create failed");

            logRouteError("bookings/update-status", {
              step,
              code: "BOOKING_CANCEL_REFUND_FAILED",
              message: refundReason,
              status: 500,
              error: refundError,
              extra: {
                bookingId: id,
                businessId: business.id,
                paymentIntentId: resolvedPaymentIntentId,
              },
            });
          }
        } else {
          resolvedIntentStatus = "cancelled";
          refundReason = "missing_payment_intent";

          console.log("[bookings/update-status]", {
            stage: "refund.skipped",
            bookingId: id,
            businessId: business.id,
            reason: refundReason,
            checkoutIntentId,
            stripeSessionId: booking.stripe_session_id || null,
          });
        }
      } else {
        resolvedIntentStatus = "cancelled";
        refundReason = "payment_not_paid";
      }
    }

    const payload =
      status === "cancelled"
        ? buildCancelledStatusUpdate("owner", "cancelled", {
            payment_status: finalPaymentStatus,
            ...(resolvedPaymentIntentId ? { payment_intent_id: resolvedPaymentIntentId } : {}),
          })
        : {
            status,
            payment_status: finalPaymentStatus,
          };

    step = "booking.update";
    const { error: bookingUpdateError } = await bookingsTable
      .update(payload)
      .eq("id", id)
      .eq("business_id", business.id);

    if (bookingUpdateError) {
      throw new Error(bookingUpdateError.message || "Failed to update booking");
    }

    console.log("[bookings/update-status]", {
      stage: "booking.update.result",
      bookingId: id,
      businessId: business.id,
      nextStatus: payload.status || status,
      nextPaymentStatus: payload.payment_status || null,
      refundAttempted,
      refundSucceeded,
      refundReason,
    });

    if (checkoutIntentId) {
      await updateCheckoutIntentSafely({
        supabaseAdmin,
        intentId: checkoutIntentId,
        payload: {
          status: resolvedIntentStatus,
          booking_id: id,
          stripe_checkout_session_id: booking.stripe_session_id || null,
          ...(resolvedPaymentIntentId
            ? { stripe_payment_intent_id: resolvedPaymentIntentId }
            : {}),
          metadata: {
            ...metadata,
            booking_id: id,
            cancellation_status: status === "cancelled" ? "cancelled" : undefined,
            refund_status:
              status === "cancelled" && finalPaymentStatus === "refunded"
                ? "refunded"
                : undefined,
          },
        },
        context: {
          source: "admin-bookings-update-status",
          bookingId: id,
          businessId: business.id,
          status,
        },
      });

      console.log("[bookings/update-status]", {
        stage: "checkout_intent.update.result",
        bookingId: id,
        businessId: business.id,
        checkoutIntentId,
        nextIntentStatus: resolvedIntentStatus,
        paymentIntentId: resolvedPaymentIntentId,
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath("/dashboard/bookings");

    return NextResponse.redirect(new URL("/admin/bookings", req.url));
  } catch (error: unknown) {
    logRouteError("bookings/update-status", {
      step,
      code: "BOOKING_STATUS_UPDATE_FAILED",
      message: getErrorMessage(error, "Booking status update failed"),
      status: 500,
      error,
      extra: {
        requestUrl: req.url,
      },
    });

    return NextResponse.redirect(new URL("/admin/bookings?error=status", req.url));
  }
}
