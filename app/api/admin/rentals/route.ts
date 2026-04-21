import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { isRentalBusinessType } from "@/lib/businessModules";
import {
  PROPERTY_AMENITY_BOOLEAN_KEYS,
  normalizePropertyAmenityData,
  toPropertyAmenityJson,
} from "@/lib/propertyAmenities";
import { normalizeDate } from "@/lib/rentalAvailability";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

function redirectToRentals(
  req: Request,
  params?: Record<string, string | null | undefined>
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (value) {
      search.set(key, value);
    }
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return NextResponse.redirect(new URL(`/admin/rentals${suffix}`, req.url));
}

function formatSupabaseError(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
} | null | undefined) {
  if (!error) {
    return null;
  }

  return {
    message: error.message || null,
    details: error.details || null,
    hint: error.hint || null,
    code: error.code || null,
  };
}

function toUiErrorMessage(input: string | null | undefined) {
  const normalized = String(input || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 180);
}

async function savePropertyContent({
  supabase,
  businessId,
  propertyId,
  title,
  description,
}: {
  supabase: AdminClient;
  businessId: string;
  propertyId: string;
  title: string;
  description: string;
}) {
  const { data: existingContent, error: existingContentError } =
    await supabase
      .from("property_content")
      .select("id")
      .eq("property_id", propertyId)
      .eq("business_id", businessId)
      .maybeSingle();

  if (existingContentError) {
    throw new Error(existingContentError.message);
  }

  if (existingContent?.id) {
    const { error: updateError } = await supabase
      .from("property_content")
      .update({
        title,
        description,
      })
      .eq("id", existingContent.id)
      .eq("business_id", businessId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return;
  }

  const { error: insertError } = await supabase.from("property_content").insert({
    property_id: propertyId,
    business_id: businessId,
    title,
    description,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function syncPropertyDescriptionColumn({
  supabase,
  propertyId,
  businessId,
  description,
}: {
  supabase: AdminClient;
  propertyId: string;
  businessId: string;
  description: string;
}) {
  const { error } = await supabase
    .from("property")
    .update({ description })
    .eq("id", propertyId)
    .eq("business_id", businessId);

  if (error) {
    console.warn("[admin/rentals] property description column sync skipped", {
      businessId,
      propertyId,
      message: error.message,
    });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const formData = await req.formData();
    const action = String(formData.get("action") || "").trim();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/login?next=%2Fadmin%2Frentals", req.url));
    }

    const business = await getActiveBusiness();

    if (!business?.id) {
      console.warn("[admin/rentals] no active business for user", { userId: user.id });
      return redirectToRentals(req, { error: "no-active-business" });
    }

    if (!isRentalBusinessType(business.business_type)) {
      console.warn("[admin/rentals] invalid business type", {
        userId: user.id,
        businessId: business.id,
        businessType: business.business_type || null,
      });
      return redirectToRentals(req, { error: "invalid-business-type" });
    }

    if (action === "create_property") {
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const priceRaw = String(formData.get("price") || "").trim();
      const price = Number(priceRaw);

      console.log("[admin/rentals] create_property payload", {
        table: "property",
        operation: "insert",
        businessId: business.id,
        businessType: business.business_type || null,
        name,
        hasDescription: description.length > 0,
        sanitizedPayload: {
          business_id: business.id,
          name,
          price,
        },
      });

      if (!name || !Number.isFinite(price) || price <= 0) {
        return redirectToRentals(req, {
          error: "invalid-listing",
          message: "Enter a listing name and a valid positive price.",
        });
      }

      const { data: property, error: propertyError } = await supabaseAdmin
        .from("property")
        .insert({
          business_id: business.id,
          name,
          price,
        })
        .select("id, business_id, name, price")
        .maybeSingle();

      if (propertyError || !property?.id) {
        const formattedError = formatSupabaseError(propertyError);
        console.error("[admin/rentals] create_property failed", {
          table: "property",
          operation: "insert",
          businessId: business.id,
          sanitizedPayload: {
            business_id: business.id,
            name,
            price,
          },
          error: formattedError,
          missingRow: !property?.id,
        });
        return redirectToRentals(req, {
          error: "listing-save-failed",
          message:
            toUiErrorMessage(formattedError?.message) ||
            "The property record could not be created.",
        });
      }

      let warning: string | null = null;

      if (description) {
        try {
          await savePropertyContent({
            supabase,
            businessId: business.id,
            propertyId: property.id,
            title: name,
            description,
          });

          await syncPropertyDescriptionColumn({
            supabase,
            propertyId: property.id,
            businessId: business.id,
            description,
          });
        } catch (contentError) {
          console.error("[admin/rentals] property content save failed", {
            table: "property_content",
            operation: "insert_or_update",
            businessId: business.id,
            propertyId: property.id,
            sanitizedPayload: {
              property_id: property.id,
              business_id: business.id,
              title: name,
              description,
            },
            message:
              contentError instanceof Error
                ? contentError.message
                : "Unknown content save error",
          });
          warning = "listing-description-save-failed";
        }
      }

      console.log("[admin/rentals] listing saved", {
        table: "property",
        operation: "insert",
        businessId: business.id,
        propertyId: property.id,
        warning,
      });
      return redirectToRentals(req, {
        success: "listing-saved",
        warning,
        property: String(property.id),
      });
    }

    if (action === "update_property") {
      const propertyId = String(formData.get("property_id") || "").trim();
      const name = String(formData.get("name") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const price = Number(String(formData.get("price") || "").trim());
      const amenityInput: Record<string, unknown> = {
        bedrooms: formData.get("bedrooms"),
        bathrooms: formData.get("bathrooms"),
      };

      for (const key of PROPERTY_AMENITY_BOOLEAN_KEYS) {
        amenityInput[key] = formData.get(key) === "on";
      }

      const amenityData = normalizePropertyAmenityData(amenityInput);

      console.log("[admin/rentals] update_property payload", {
        table: "property",
        operation: "update",
        businessId: business.id,
        propertyId,
        name,
        price,
        hasDescription: description.length > 0,
        amenityData,
      });

      if (!propertyId || !name || !Number.isFinite(price) || price <= 0) {
        return redirectToRentals(req, {
          error: "invalid-listing",
          message: "Choose a valid listing, name, and positive price.",
        });
      }

      const { data: property, error: propertyLookupError } = await supabaseAdmin
        .from("property")
        .select("id")
        .eq("id", propertyId)
        .eq("business_id", business.id)
        .maybeSingle();

      if (propertyLookupError || !property?.id) {
        return redirectToRentals(req, {
          error: "listing-not-found",
          message: "The selected listing could not be found for the active business.",
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("property")
        .update({
          name,
          price,
          description,
          amenity_data: toPropertyAmenityJson(amenityData),
        })
        .eq("id", propertyId)
        .eq("business_id", business.id);

      if (updateError) {
        console.error("[admin/rentals] update_property failed", {
          businessId: business.id,
          propertyId,
          error: formatSupabaseError(updateError),
        });
        return redirectToRentals(req, {
          error: "listing-save-failed",
          message: toUiErrorMessage(updateError.message) || "The listing could not be updated.",
        });
      }

      let warning: string | null = null;

      try {
        await savePropertyContent({
          supabase,
          businessId: business.id,
          propertyId,
          title: name,
          description,
        });

        await syncPropertyDescriptionColumn({
          supabase,
          propertyId,
          businessId: business.id,
          description,
        });
      } catch (contentError) {
        console.error("[admin/rentals] update_property content sync failed", {
          businessId: business.id,
          propertyId,
          message:
            contentError instanceof Error
              ? contentError.message
              : "Unknown content sync error",
        });
        warning = "listing-description-save-failed";
      }

      return redirectToRentals(req, {
        success: "listing-saved",
        warning,
        property: propertyId,
      });
    }

    if (action === "block_dates") {
      const propertyId = String(formData.get("property_id") || "").trim();
      const startDate = normalizeDate(String(formData.get("start_date") || ""));
      const endDate = normalizeDate(String(formData.get("end_date") || ""));
      const reason = String(formData.get("reason") || "").trim();

      console.log("[admin/rentals] block_dates payload", {
        table: "rental_availability_blocks",
        operation: "insert",
        businessId: business.id,
        propertyId,
        startDate,
        endDate,
        hasReason: reason.length > 0,
      });

      if (!propertyId || !startDate || !endDate || endDate <= startDate) {
        return redirectToRentals(req, {
          error: "invalid-block",
          message: "Choose a saved listing and a valid end date after the start date.",
        });
      }

      const { data: property, error: propertyError } = await supabaseAdmin
        .from("property")
        .select("id")
        .eq("id", propertyId)
        .eq("business_id", business.id)
        .maybeSingle();

      if (propertyError || !property?.id) {
        console.error("[admin/rentals] block_dates property lookup failed", {
          table: "property",
          operation: "select",
          businessId: business.id,
          propertyId,
          error: formatSupabaseError(propertyError),
          missingRow: !property?.id,
        });
        return redirectToRentals(req, {
          error: "listing-not-found",
          message: "The selected listing was not found for the active business.",
        });
      }

      const { data: block, error: blockError } = await supabaseAdmin
        .from("rental_availability_blocks")
        .insert({
          business_id: business.id,
          property_id: propertyId,
          start_date: startDate,
          end_date: endDate,
          reason: reason || null,
        })
        .select("id, property_id")
        .maybeSingle();

      if (blockError || !block?.id) {
        const formattedError = formatSupabaseError(blockError);
        console.error("[admin/rentals] block_dates insert failed", {
          table: "rental_availability_blocks",
          operation: "insert",
          businessId: business.id,
          propertyId,
          sanitizedPayload: {
            business_id: business.id,
            property_id: propertyId,
            start_date: startDate,
            end_date: endDate,
            reason: reason || null,
          },
          error: formattedError,
          missingRow: !block?.id,
        });
        return redirectToRentals(req, {
          error: "block-save-failed",
          message:
            toUiErrorMessage(formattedError?.message) ||
            "The blocked dates could not be created.",
        });
      }

      console.log("[admin/rentals] dates blocked", {
        businessId: business.id,
        propertyId: block.property_id,
        blockId: block.id,
      });
      return redirectToRentals(req, {
        success: "dates-blocked",
        property: String(block.property_id),
      });
    }

    if (action === "unblock_dates") {
      const blockId = String(formData.get("block_id") || "").trim();

      console.log("[admin/rentals] unblock_dates payload", {
        businessId: business.id,
        blockId,
      });

      if (!blockId) {
        return redirectToRentals(req, { error: "invalid-unblock" });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("rental_availability_blocks")
        .delete()
        .eq("id", blockId)
        .eq("business_id", business.id);

      if (deleteError) {
        console.error("[admin/rentals] unblock_dates failed", {
          table: "rental_availability_blocks",
          operation: "delete",
          businessId: business.id,
          blockId,
          error: formatSupabaseError(deleteError),
        });
        return redirectToRentals(req, {
          error: "unblock-failed",
          message:
            toUiErrorMessage(deleteError.message) ||
            "The blocked dates could not be removed.",
        });
      }

      console.log("[admin/rentals] dates unblocked", {
        businessId: business.id,
        blockId,
      });
      return redirectToRentals(req, { success: "dates-unblocked" });
    }

    console.warn("[admin/rentals] unknown action", {
      businessId: business.id,
      action,
    });
    return redirectToRentals(req, { error: "unknown-action" });
  } catch (err) {
    console.error("[admin/rentals] action failed:", err);
    return redirectToRentals(req, { error: "unexpected" });
  }
}
