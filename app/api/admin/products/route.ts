import { NextResponse } from "next/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import { createClient } from "@/lib/supabase/server";

function normalizeText(value: unknown, maxLength = 5000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizePrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function nowIso() {
  return new Date().toISOString();
}

function extractMissingColumnName(message: string) {
  const patterns = [
    /column ["']([^"']+)["']/i,
    /column\s+([a-zA-Z0-9_.]+)\s+does not exist/i,
    /Could not find the ['"]([^'"]+)['"] column/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const rawColumn = match[1];
      return rawColumn.includes(".") ? rawColumn.split(".").pop() || rawColumn : rawColumn;
    }
  }

  return null;
}

async function runSchemaSafeMutation(args: {
  payload: Record<string, unknown>;
  requiredColumns?: string[];
  runMutation: (payload: Record<string, unknown>) => Promise<{ error: { message?: string } | null; data?: unknown }>;
}) {
  const candidate = Object.fromEntries(
    Object.entries(args.payload).filter(([, value]) => value !== undefined)
  );
  const requiredColumns = new Set(args.requiredColumns || []);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await args.runMutation(candidate);

    if (!result.error) {
      return result;
    }

    const missingColumn = extractMissingColumnName(result.error.message || "");
    if (!missingColumn || !(missingColumn in candidate)) {
      return result;
    }

    if (requiredColumns.has(missingColumn)) {
      return {
        data: null,
        error: new Error(`Required product column is missing: ${missingColumn}`),
      };
    }

    delete candidate[missingColumn];
  }

  return {
    data: null,
    error: new Error("Failed to save product after schema fallback retries"),
  };
}

async function selectCheckoutIntentRowsSafely(checkoutIntentsTable: any, businessId: string) {
  const columns = ["id", "order_items", "items_json", "metadata", "meta_json"];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await checkoutIntentsTable
      .select(columns.join(","))
      .eq("business_id", businessId)
      .eq("kind", "order");

    if (!error) {
      return { data: data || [], error: null };
    }

    const missingColumn = extractMissingColumnName(error.message || "");
    if (!missingColumn) {
      return { data: null, error };
    }

    const index = columns.indexOf(missingColumn);
    if (index === -1) {
      return { data: null, error };
    }

    columns.splice(index, 1);
  }

  return {
    data: null,
    error: new Error("Failed to load checkout intents after schema fallback retries"),
  };
}

function itemIdsFromIntent(intent: Record<string, unknown>) {
  const metadata =
    intent.metadata && typeof intent.metadata === "object" && !Array.isArray(intent.metadata)
      ? (intent.metadata as Record<string, unknown>)
      : intent.meta_json && typeof intent.meta_json === "object" && !Array.isArray(intent.meta_json)
        ? (intent.meta_json as Record<string, unknown>)
        : {};

  const rawItems = Array.isArray(intent.order_items)
    ? intent.order_items
    : Array.isArray(intent.items_json)
      ? intent.items_json
      : Array.isArray(metadata.order_items)
        ? metadata.order_items
        : [];

  return rawItems
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = String(
        record.id ?? record.item_id ?? record.product_id ?? record.menu_item_id ?? ""
      ).trim();

      return id || null;
    })
    .filter((value): value is string => Boolean(value));
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { action = "save", id, businessId, name, description, price, image_url, is_active } =
      body || {};

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const safeBusinessId = String(businessId || "").trim();
    if (!safeBusinessId) {
      return NextResponse.json({ error: "Business is required" }, { status: 400 });
    }

    const businessesTable = supabase.from("businesses") as any;
    const productsTable = supabase.from("products") as any;
    const checkoutIntentsTable = supabase.from("checkout_intents") as any;

    const { data: businessData, error: businessError } = await businessesTable
      .select("id, owner_id, business_type, plan")
      .eq("id", safeBusinessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    const business = businessData as
      | {
          id: string;
          owner_id?: string | null;
          business_type?: string | null;
          plan?: string | null;
        }
      | null;

    if (businessError || !business?.id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const productId = String(id || "").trim();
    const normalizedAction = String(action || "save").trim();

    if (normalizedAction === "save") {
      const parsedPrice = normalizePrice(price);
      const normalizedName = normalizeText(name, 200);

      if (!normalizedName) {
        return NextResponse.json({ error: "Product name is required" }, { status: 400 });
      }

      if (parsedPrice === null) {
        return NextResponse.json(
          { error: "Product price must be greater than 0" },
          { status: 400 }
        );
      }

      const payload = {
        business_id: business.id,
        name: normalizedName,
        description: normalizeText(description),
        price: parsedPrice,
        image_url: normalizeText(image_url, 2000),
        is_active: is_active === false ? false : true,
        archived_at: is_active === false ? nowIso() : null,
        updated_at: nowIso(),
      };

      let result;

      if (productId) {
        result = await runSchemaSafeMutation({
          payload,
          requiredColumns: ["business_id", "name", "price"],
          runMutation: (nextPayload) =>
            productsTable
              .update(nextPayload)
              .eq("id", productId)
              .eq("business_id", business.id)
              .select()
              .single(),
        });
      } else {
        const effectivePlan = await resolveAccessPlanForBusiness({
          business: {
            id: business.id,
            owner_id: business.owner_id || null,
            plan: business.plan || null,
          },
          userId: user.id,
          email: user.email || null,
        });

        const { count, error: countError } = await productsTable
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id);

        if (countError) {
          return NextResponse.json(
            { error: "Could not validate product limits" },
            { status: 500 }
          );
        }

        const productLimit = getUsageLimitResult({
          plan: effectivePlan,
          limitKey: "max_products",
          current: Number(count || 0),
        });

        if (!productLimit.allowed) {
          return NextResponse.json(
            { error: productLimit.message || "Your plan does not allow more products." },
            { status: 403 }
          );
        }

        result = await runSchemaSafeMutation({
          payload,
          requiredColumns: ["business_id", "name", "price"],
          runMutation: (nextPayload) => productsTable.insert(nextPayload).select().single(),
        });
      }

      if (result.error) {
        return NextResponse.json(
          { error: result.error.message || "Failed to save product" },
          { status: 500 }
        );
      }

      return NextResponse.json({ product: result.data });
    }

    if (!productId) {
      return NextResponse.json({ error: "Product id is required" }, { status: 400 });
    }

    const { data: product } = await productsTable
      .select("*")
      .eq("id", productId)
      .eq("business_id", business.id)
      .maybeSingle();

    if (!product?.id) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (normalizedAction === "archive" || normalizedAction === "restore") {
      const nextActive = normalizedAction === "restore";
      const result = await runSchemaSafeMutation({
        payload: {
          is_active: nextActive,
          archived_at: nextActive ? null : nowIso(),
          updated_at: nowIso(),
        },
        requiredColumns: ["is_active"],
        runMutation: (nextPayload) =>
          productsTable
            .update(nextPayload)
            .eq("id", productId)
            .eq("business_id", business.id)
            .select()
            .single(),
      });

      if (result.error) {
        return NextResponse.json(
          { error: result.error.message || "Failed to update product status" },
          { status: 500 }
        );
      }

      return NextResponse.json({ product: result.data });
    }

    if (normalizedAction === "delete") {
      const { data: intentRows, error: dependencyError } = await selectCheckoutIntentRowsSafely(
        checkoutIntentsTable,
        business.id
      );

      if (dependencyError) {
        return NextResponse.json(
          { error: dependencyError.message || "Failed to validate product dependencies" },
          { status: 500 }
        );
      }

      const hasDependencies = (intentRows || []).some((intent: Record<string, unknown>) =>
        itemIdsFromIntent(intent).includes(productId)
      );

      if (hasDependencies) {
        const result = await runSchemaSafeMutation({
          payload: {
            is_active: false,
            archived_at: nowIso(),
            updated_at: nowIso(),
          },
          requiredColumns: ["is_active"],
          runMutation: (nextPayload) =>
            productsTable
              .update(nextPayload)
              .eq("id", productId)
              .eq("business_id", business.id)
              .select()
              .single(),
        });

        if (result.error) {
          return NextResponse.json(
            { error: result.error.message || "Failed to archive product" },
            { status: 500 }
          );
        }

        return NextResponse.json({ product: result.data, archived: true });
      }

      const result = await productsTable
        .delete()
        .eq("id", productId)
        .eq("business_id", business.id);

      if (result.error) {
        return NextResponse.json(
          { error: result.error.message || "Failed to delete product" },
          { status: 500 }
        );
      }

      return NextResponse.json({ deleted: true, id: productId });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Request failed" }, { status: 500 });
  }
}
