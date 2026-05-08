import { NextResponse } from "next/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getBusinessReadinessState } from "@/lib/businessReadiness";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { normalizeBusinessSlug } from "@/lib/businessProfileCompletion";
import { getFeatureGate } from "@/lib/planEnforcement";
import { createClient } from "@/lib/supabase/server";
import { loadBusinessPreferences } from "@/lib/businessPreferences";
import { resolveServiceCategoryForBusiness } from "@/lib/serviceCategories";

const VALID_LANGUAGES = new Set(["en", "es"]);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasOwn(input: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function optionalBoolean(input: Record<string, unknown>, key: string, fallback: boolean) {
  return hasOwn(input, key) ? input[key] === true : fallback;
}

function extractMissingColumnName(message: string) {
  const patterns = [
    /column ["']([^"']+)["']/i,
    /Could not find the ['"]([^'"]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function updateBusinessSafely(args: {
  businessesTable: any;
  payload: Record<string, unknown>;
  businessId: string;
  requiredColumns?: string[];
}) {
  const candidate = Object.fromEntries(
    Object.entries(args.payload).filter(([, value]) => value !== undefined)
  );
  const requiredColumns = new Set(args.requiredColumns || []);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await args.businessesTable
      .update(candidate)
      .eq("id", args.businessId);

    if (!error) {
      return null;
    }

    const missingColumn = extractMissingColumnName(error.message || "");
    if (!missingColumn || !(missingColumn in candidate)) {
      return error;
    }
    if (requiredColumns.has(missingColumn)) {
      return new Error(`Required business setting column is missing: ${missingColumn}`);
    }

    delete candidate[missingColumn];
  }

  return new Error("Failed to update business after schema fallback retries");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json();
  const bodyRecord = (body || {}) as Record<string, unknown>;
  const requestedBusinessId = hasOwn(bodyRecord, "businessId")
    ? String(bodyRecord.businessId || "").trim()
    : null;
  const business = await getActiveBusiness(requestedBusinessId);

  if (!business) {
    return NextResponse.json({ error: "No active business." }, { status: 400 });
  }

  const name = hasOwn(bodyRecord, "name")
    ? String(bodyRecord.name || "").trim()
    : String(business.name || "").trim();
  const description = hasOwn(bodyRecord, "description")
    ? String(bodyRecord.description || "").trim()
    : String(business.description || "").trim();
  const email = hasOwn(bodyRecord, "email")
    ? String(bodyRecord.email || "").trim()
    : "";
  const refundPolicy = hasOwn(bodyRecord, "refund_policy")
    ? String(bodyRecord.refund_policy || "").trim()
    : "";
  const lateFeeDisclosure = hasOwn(bodyRecord, "late_fee_disclosure")
    ? String(bodyRecord.late_fee_disclosure || "").trim()
    : "";
  const requestedSlug = hasOwn(bodyRecord, "slug")
    ? String(bodyRecord.slug || "").trim()
    : String(business.slug || "").trim();
  const hasLanguageUpdate = hasOwn(bodyRecord, "language");
  const language = hasLanguageUpdate
    ? String(bodyRecord.language || "en").trim()
    : "en";

  if (email && !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid contact email address." },
      { status: 400 }
    );
  }

  const nextSlug = normalizeBusinessSlug(requestedSlug || name);
  if (!nextSlug) {
    return NextResponse.json(
      { error: "A valid business name or slug is required." },
      { status: 400 }
    );
  }

  const businessesTable = supabase.from("businesses");
  const { data: conflictingBusiness, error: conflictError } = await businessesTable
    .select("id")
    .eq("slug", nextSlug)
    .neq("id", business.id)
    .maybeSingle();

  if (conflictError) {
    return NextResponse.json(
      { error: "Could not validate business slug." },
      { status: 500 }
    );
  }

  if (conflictingBusiness) {
    return NextResponse.json(
      { error: "That public slug is already in use." },
      { status: 409 }
    );
  }

  const isRentalBusiness =
    business.business_type === "rental" || business.business_type === "property";
  const isFoodBusiness =
    business.business_type === "food" || business.business_type === "restaurant";
  const isOrderModeBusiness =
    isFoodBusiness ||
    business.business_type === "store" ||
    business.business_type === "product" ||
    business.business_type === "creator";
  const isServiceBusiness = business.business_type === "service";
  const serviceCategory = hasOwn(bodyRecord, "service_category")
    ? resolveServiceCategoryForBusiness({
        businessType: business.business_type || "",
        value: bodyRecord.service_category,
      })
    : undefined;

  if (!VALID_LANGUAGES.has(language)) {
    return NextResponse.json(
      { error: "Select a supported language." },
      { status: 400 }
    );
  }

  const currentPreferences = await loadBusinessPreferences(supabase, business.id);
  const pickupEnabled = optionalBoolean(
    bodyRecord,
    "pickup_enabled",
    currentPreferences.pickup_enabled
  );
  const deliveryEnabled = optionalBoolean(
    bodyRecord,
    "delivery_enabled",
    currentPreferences.delivery_enabled
  );
  const onsiteEnabled = optionalBoolean(
    bodyRecord,
    "onsite_enabled",
    currentPreferences.onsite_enabled
  );
  const remoteEnabled = optionalBoolean(
    bodyRecord,
    "remote_enabled",
    currentPreferences.remote_enabled
  );
  const requiredPreferenceColumns = [
    hasLanguageUpdate ? "language" : null,
    isOrderModeBusiness && hasOwn(bodyRecord, "pickup_enabled") ? "pickup_enabled" : null,
    isOrderModeBusiness && hasOwn(bodyRecord, "delivery_enabled") ? "delivery_enabled" : null,
    isServiceBusiness && hasOwn(bodyRecord, "onsite_enabled") ? "onsite_enabled" : null,
    isServiceBusiness && hasOwn(bodyRecord, "remote_enabled") ? "remote_enabled" : null,
  ].filter((column): column is string => Boolean(column));

  if (isOrderModeBusiness && !pickupEnabled && !deliveryEnabled) {
    return NextResponse.json(
      { error: "Pickup or delivery must remain enabled." },
      { status: 400 }
    );
  }

  if (isServiceBusiness && !onsiteEnabled && !remoteEnabled) {
    return NextResponse.json(
      { error: "On-site or remote service must remain enabled." },
      { status: 400 }
    );
  }

  let nextPublishedState: boolean | undefined;
  if (hasOwn(bodyRecord, "is_published")) {
    nextPublishedState = bodyRecord.is_published === true;

    if (nextPublishedState) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || business.owner_id !== user.id) {
        return NextResponse.json(
          { error: "Only the business owner can publish this business." },
          { status: 403 }
        );
      }

      const effectivePlan = await resolveAccessPlanForBusiness({
        business: {
          id: business.id,
          owner_id: business.owner_id,
          plan: business.plan,
        },
        userId: user.id,
        email: user.email || null,
      });
      const publishGate = getFeatureGate(
        effectivePlan,
        "publish_business",
        "Publishing is available on Pro and Elite."
      );

      if (!publishGate.allowed) {
        return NextResponse.json(
          { error: publishGate.message || "Publishing is available on Pro and Elite." },
          { status: 403 }
        );
      }

      const readiness = await getBusinessReadinessState({
        business,
        userId: user.id,
      });

      if (!readiness.canPublishLive) {
        const legalBlocker = readiness.blockers.find((blocker) => blocker.kind === "legal");
        return NextResponse.json(
          {
            error: legalBlocker
              ? "Required legal documents must be accepted before publishing."
              : readiness.summary,
          },
          { status: 400 }
        );
      }
    }
  }

  const error = await updateBusinessSafely({
    businessesTable,
    businessId: business.id,
    requiredColumns: requiredPreferenceColumns,
    payload: {
      name,
      slug: nextSlug,
      description: description || null,
      email: email || null,
      refund_policy: refundPolicy || null,
      late_fee_disclosure: isRentalBusiness ? lateFeeDisclosure || null : null,
      language: hasLanguageUpdate ? language : undefined,
      pickup_enabled:
        isOrderModeBusiness && hasOwn(bodyRecord, "pickup_enabled") ? pickupEnabled : undefined,
      delivery_enabled:
        isOrderModeBusiness && hasOwn(bodyRecord, "delivery_enabled") ? deliveryEnabled : undefined,
      onsite_enabled:
        isServiceBusiness && hasOwn(bodyRecord, "onsite_enabled") ? onsiteEnabled : undefined,
      remote_enabled:
        isServiceBusiness && hasOwn(bodyRecord, "remote_enabled") ? remoteEnabled : undefined,
      service_category:
        isServiceBusiness && hasOwn(bodyRecord, "service_category")
          ? serviceCategory
          : undefined,
      logo_url: hasOwn(bodyRecord, "logo_url") ? String(bodyRecord.logo_url || "").trim() || null : undefined,
      cover_image_url:
        hasOwn(bodyRecord, "cover_image_url")
          ? String(bodyRecord.cover_image_url || "").trim() || null
          : undefined,
      font_family:
        hasOwn(bodyRecord, "font_family")
          ? String(bodyRecord.font_family || "").trim() || null
          : undefined,
      font_color:
        hasOwn(bodyRecord, "font_color")
          ? String(bodyRecord.font_color || "").trim() || null
          : undefined,
      is_published: nextPublishedState,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
