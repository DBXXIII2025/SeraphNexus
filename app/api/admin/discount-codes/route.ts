import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import {
  normalizeDiscountCode,
  validateDiscountCodePayload,
} from "@/lib/discountCodes";
import { createAdminClient, createClient } from "@/lib/supabase/server";

function getRequestedBusinessId(input: Request | URLSearchParams, body?: Record<string, unknown>) {
  if (input instanceof URLSearchParams) {
    const fromQuery = input.get("businessId");
    return fromQuery?.trim() || undefined;
  }

  const fromBody = body?.businessId ?? body?.business_id;
  return String(fromBody || "").trim() || undefined;
}

function canManageDiscountCodes(input: {
  ownerId?: string | null;
  userId?: string | null;
  accessRole?: string | null;
}) {
  if (!input.userId) {
    return false;
  }

  if (input.ownerId && input.ownerId === input.userId) {
    return true;
  }

  return input.accessRole === "admin" || input.accessRole === "manager";
}

export async function GET(req: Request) {
  const supabase = createAdminClient();
  const business = await getActiveBusiness(
    getRequestedBusinessId(new URL(req.url).searchParams)
  );

  if (!business) {
    return NextResponse.json({ error: "No active business." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load promo codes." },
      { status: 500 }
    );
  }

  return NextResponse.json({ codes: data || [] });
}

export async function POST(req: Request) {
  const authClient = await createClient();
  const supabase = createAdminClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const business = await getActiveBusiness(getRequestedBusinessId(req, body));

  if (!business) {
    return NextResponse.json({ error: "No active business." }, { status: 400 });
  }

  if (
    !canManageDiscountCodes({
      ownerId: business.owner_id,
      userId: user?.id || null,
      accessRole: business.access_role,
    })
  ) {
    return NextResponse.json(
      { error: "You do not have permission to manage promo codes for this business." },
      { status: 403 }
    );
  }

  const parsed = validateDiscountCodePayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = {
    business_id: business.id,
    ...parsed.value,
  };

  const { data, error } = await supabase
    .from("discount_codes")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    const normalized = String(error.message || "").toLowerCase();
    const status = normalized.includes("duplicate") || normalized.includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "This promo code already exists for the active business."
            : error.message || "Failed to create promo code.",
      },
      { status }
    );
  }

  return NextResponse.json({ code: data });
}

export async function PATCH(req: Request) {
  const authClient = await createClient();
  const supabase = createAdminClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const business = await getActiveBusiness(getRequestedBusinessId(req, body));

  if (!business) {
    return NextResponse.json({ error: "No active business." }, { status: 400 });
  }

  if (
    !canManageDiscountCodes({
      ownerId: business.owner_id,
      userId: user?.id || null,
      accessRole: business.access_role,
    })
  ) {
    return NextResponse.json(
      { error: "You do not have permission to manage promo codes for this business." },
      { status: 403 }
    );
  }

  const codeId = String(body.id || "").trim();
  if (!codeId) {
    return NextResponse.json({ error: "Promo code id is required." }, { status: 400 });
  }

  const parsed = validateDiscountCodePayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("discount_codes")
    .update(parsed.value)
    .eq("id", codeId)
    .eq("business_id", business.id)
    .select("*")
    .maybeSingle();

  if (error) {
    const normalized = String(error.message || "").toLowerCase();
    const status = normalized.includes("duplicate") || normalized.includes("unique") ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409
            ? "This promo code already exists for the active business."
            : error.message || "Failed to update promo code.",
      },
      { status }
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
  }

  return NextResponse.json({ code: data });
}

export async function DELETE(req: Request) {
  const authClient = await createClient();
  const supabase = createAdminClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const business = await getActiveBusiness(getRequestedBusinessId(req, body));

  if (!business) {
    return NextResponse.json({ error: "No active business." }, { status: 400 });
  }

  if (
    !canManageDiscountCodes({
      ownerId: business.owner_id,
      userId: user?.id || null,
      accessRole: business.access_role,
    })
  ) {
    return NextResponse.json(
      { error: "You do not have permission to manage promo codes for this business." },
      { status: 403 }
    );
  }

  const codeId = String(body.id || "").trim();
  const code = normalizeDiscountCode(body.code);

  if (!codeId && !code) {
    return NextResponse.json(
      { error: "Promo code id or code is required." },
      { status: 400 }
    );
  }

  let query = supabase.from("discount_codes").delete().eq("business_id", business.id);
  query = codeId ? query.eq("id", codeId) : query.eq("code", code);
  const { error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to delete promo code." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
