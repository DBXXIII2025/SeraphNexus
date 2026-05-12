import { NextResponse } from "next/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import {
  buildBusinessLogoStoragePath,
  BUSINESS_LOGOS_BUCKET,
  isAllowedBusinessLogoType,
  MAX_BUSINESS_LOGO_BYTES,
} from "@/lib/businessLogos";
import { canAccessPlanFeature } from "@/lib/planConfig";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type OwnedBusinessRow = {
  id: string;
  name: string | null;
  logo_storage_path: string | null;
  owner_id: string | null;
  plan: string | null;
};

type DeleteBody = {
  businessId?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown business logo error";
}

function isMissingLogoColumnError(message: string, code?: string | null) {
  return (
    code === "42703" ||
    message.includes("logo_url") ||
    message.includes("logo_storage_path")
  );
}

async function getOwnedBusiness(args: { businessId: string; userId: string }) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name, logo_storage_path, owner_id, plan")
    .eq("id", args.businessId)
    .eq("owner_id", args.userId)
    .maybeSingle();

  if (error) {
    if (isMissingLogoColumnError(error.message, error.code)) {
      throw new Error(
        "Business logo storage is not configured yet. Apply sql/migrations/20260401_business_logos.sql first."
      );
    }

    throw new Error(error.message);
  }

  return (data || null) as OwnedBusinessRow | null;
}

async function assertStandardCustomizationAccess(args: {
  business: OwnedBusinessRow;
  userId: string;
  userEmail: string | null;
}) {
  const effectivePlan = await resolveAccessPlanForBusiness({
    business: {
      id: args.business.id,
      owner_id: args.business.owner_id,
      plan: args.business.plan,
    },
    userId: args.userId,
    email: args.userEmail,
  });

  if (!canAccessPlanFeature(effectivePlan, "standard_customization")) {
    throw new Error("Business logo customization requires Starter Access or higher.");
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const businessId = String(formData.get("businessId") || "").trim();
    const file = formData.get("file");

    if (!businessId || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Business and logo file are required." },
        { status: 400 }
      );
    }

    if (!isAllowedBusinessLogoType(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, and WEBP logos are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BUSINESS_LOGO_BYTES) {
      return NextResponse.json(
        { error: "Business logos must be 2 MB or smaller." },
        { status: 400 }
      );
    }

    const ownedBusiness = await getOwnedBusiness({ businessId, userId: user.id });

    if (!ownedBusiness) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await assertStandardCustomizationAccess({
      business: ownedBusiness,
      userId: user.id,
      userEmail: user.email || null,
    });

    const supabaseAdmin = createAdminClient();
    const storagePath = buildBusinessLogoStoragePath({
      businessId,
      fileName: file.name,
    });

    const uploadBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUSINESS_LOGOS_BUCKET)
      .upload(storagePath, uploadBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUSINESS_LOGOS_BUCKET)
      .getPublicUrl(storagePath);

    const { error: updateError } = await supabaseAdmin
      .from("businesses")
      .update({
        logo_url: publicUrlData.publicUrl,
        logo_storage_path: storagePath,
      })
      .eq("id", businessId)
      .eq("owner_id", user.id);

    if (updateError) {
      await supabaseAdmin.storage.from(BUSINESS_LOGOS_BUCKET).remove([storagePath]);
      throw new Error(updateError.message);
    }

    if (ownedBusiness.logo_storage_path) {
      await supabaseAdmin.storage
        .from(BUSINESS_LOGOS_BUCKET)
        .remove([ownedBusiness.logo_storage_path]);
    }

    return NextResponse.json({
      logoUrl: publicUrlData.publicUrl,
      logoStoragePath: storagePath,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status =
      message === "Business logo customization requires Starter Access or higher."
        ? 403
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as DeleteBody;
    const businessId = String(body.businessId || "").trim();

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
    }

    const ownedBusiness = await getOwnedBusiness({ businessId, userId: user.id });

    if (!ownedBusiness) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await assertStandardCustomizationAccess({
      business: ownedBusiness,
      userId: user.id,
      userEmail: user.email || null,
    });

    const supabaseAdmin = createAdminClient();
    const { error: updateError } = await supabaseAdmin
      .from("businesses")
      .update({
        logo_url: null,
        logo_storage_path: null,
      })
      .eq("id", businessId)
      .eq("owner_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (ownedBusiness.logo_storage_path) {
      await supabaseAdmin.storage
        .from(BUSINESS_LOGOS_BUCKET)
        .remove([ownedBusiness.logo_storage_path]);
    }

    return NextResponse.json({
      success: true,
      logoUrl: null,
      logoStoragePath: null,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status =
      message === "Business logo customization requires Starter Access or higher."
        ? 403
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
