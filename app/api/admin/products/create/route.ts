import { NextResponse } from "next/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getPlanLimit } from "@/lib/planConfig";
import { createClient } from "@/lib/supabase/server";

function parsePrice(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }
  return price;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { id, businessId, name, description, price, image_url } = body || {};

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const parsedPrice = parsePrice(price);
    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    if (parsedPrice === null) {
      return NextResponse.json(
        { error: "Product price must be greater than 0" },
        { status: 400 }
      );
    }

    const businessesTable = supabase.from("businesses") as any;
    const productsTable = supabase.from("products") as any;

    const businessQuery = businessesTable
      .select("id, owner_id, business_type, plan")
      .eq("owner_id", user.id);

    if (businessId && String(businessId).trim()) {
      businessQuery.eq("id", businessId);
    }

    const { data: businessData, error: businessError } = await businessQuery.single();

    const business = businessData as
      | {
          id: string;
          owner_id?: string | null;
          business_type?: string | null;
          plan?: string | null;
        }
      | null;

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const effectivePlan = await resolveAccessPlanForBusiness({
      business: {
        id: business.id,
        owner_id: business.owner_id || null,
        plan: business.plan || null,
      },
      userId: user.id,
      email: user.email || null,
    });

    const payload = {
      business_id: business.id,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      price: parsedPrice,
      image_url: image_url ? String(image_url).trim() : null,
    };

    let result;
    if (id && String(id).trim()) {
      result = await productsTable
        .update(payload)
        .eq("id", String(id).trim())
        .eq("business_id", business.id)
        .select()
        .single();
    } else {
      const maxProducts = getPlanLimit(effectivePlan, "max_products");
      if (maxProducts !== null) {
        const { count, error: countError } = await productsTable
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id);

        if (countError) {
          return NextResponse.json(
            { error: "Could not validate product limits" },
            { status: 500 }
          );
        }

        if ((count || 0) >= maxProducts) {
          return NextResponse.json(
            {
              error: `Your current plan allows up to ${maxProducts} products. Upgrade to Pro or Elite for unlimited catalog items.`,
            },
            { status: 403 }
          );
        }
      }

      result = await productsTable
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Failed to save product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ product: result.data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
