import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { normalizeBusinessSlug } from "@/lib/businessProfileCompletion";
import { createClient } from "@/lib/supabase/server";

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
}) {
  const candidate = Object.fromEntries(
    Object.entries(args.payload).filter(([, value]) => value !== undefined)
  );

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

    delete candidate[missingColumn];
  }

  return new Error("Failed to update business after schema fallback retries");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return NextResponse.json({ error: "No active business." }, { status: 400 });
  }

  const body = await req.json();
  const bodyRecord = (body || {}) as Record<string, unknown>;
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
  const isServiceBusiness = business.business_type === "service";

  if (!VALID_LANGUAGES.has(language)) {
    return NextResponse.json(
      { error: "Select a supported language." },
      { status: 400 }
    );
  }

  const pickupEnabled = optionalBoolean(
    bodyRecord,
    "pickup_enabled",
    business.pickup_enabled !== false
  );
  const deliveryEnabled = optionalBoolean(
    bodyRecord,
    "delivery_enabled",
    business.delivery_enabled !== false
  );
  const onsiteEnabled = optionalBoolean(
    bodyRecord,
    "onsite_enabled",
    business.onsite_enabled !== false
  );
  const remoteEnabled = optionalBoolean(
    bodyRecord,
    "remote_enabled",
    business.remote_enabled !== false
  );

  if (isFoodBusiness && !pickupEnabled && !deliveryEnabled) {
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

  const error = await updateBusinessSafely({
    businessesTable,
    businessId: business.id,
    payload: {
      name,
      slug: nextSlug,
      description: description || null,
      email: email || null,
      refund_policy: refundPolicy || null,
      late_fee_disclosure: isRentalBusiness ? lateFeeDisclosure || null : null,
      language: hasLanguageUpdate ? language : undefined,
      pickup_enabled:
        isFoodBusiness && hasOwn(bodyRecord, "pickup_enabled") ? pickupEnabled : undefined,
      delivery_enabled:
        isFoodBusiness && hasOwn(bodyRecord, "delivery_enabled") ? deliveryEnabled : undefined,
      onsite_enabled:
        isServiceBusiness && hasOwn(bodyRecord, "onsite_enabled") ? onsiteEnabled : undefined,
      remote_enabled:
        isServiceBusiness && hasOwn(bodyRecord, "remote_enabled") ? remoteEnabled : undefined,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
