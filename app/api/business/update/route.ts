import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { normalizeBusinessSlug } from "@/lib/businessProfileCompletion";
import { createClient } from "@/lib/supabase/server";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const business = await getActiveBusiness();

  if (!business) {
    return NextResponse.json({ error: "No active business." }, { status: 400 });
  }

  const body = await req.json();
  const name = String(body?.name || "").trim();
  const description = String(body?.description || "").trim();
  const email = String(body?.email || "").trim();
  const refundPolicy = String(body?.refund_policy || "").trim();
  const lateFeeDisclosure = String(body?.late_fee_disclosure || "").trim();
  const requestedSlug = String(body?.slug || "").trim();

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

  const { error } = await businessesTable
    .update({
      name,
      slug: nextSlug,
      description: description || null,
      email: email || null,
      refund_policy: refundPolicy || null,
      late_fee_disclosure: isRentalBusiness ? lateFeeDisclosure || null : null,
    })
    .eq("id", business.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
