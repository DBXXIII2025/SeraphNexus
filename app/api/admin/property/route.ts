import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { createClient } from "@/lib/supabase/server";

function normalizeName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();
  return name.length > 0 ? name.slice(0, 160) : null;
}

function normalizeDescription(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const description = value.trim();
  return description.length > 0 ? description.slice(0, 5000) : null;
}

function normalizePrice(value: unknown) {
  const price = typeof value === "number" ? value : Number(value);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = normalizeName(body?.name);
    const description = normalizeDescription(body?.description);
    const price = normalizePrice(body?.price);

    if (!name || price === null) {
      return NextResponse.json({ error: "Valid name and price are required" }, { status: 400 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: "Active business not found" }, { status: 404 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("property")
      .insert({
        name,
        description: description || null,
        price,
        business_id: business.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create property" }, { status: 500 });
    }

    return NextResponse.json({ property: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create property" },
      { status: 500 }
    );
  }
}
