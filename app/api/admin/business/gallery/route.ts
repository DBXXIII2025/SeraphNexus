import { NextResponse } from "next/server";
import {
  buildBusinessPageImagePath,
  BUSINESS_PAGE_IMAGES_BUCKET,
  isAllowedBusinessPageImageType,
  MAX_BUSINESS_PAGE_IMAGE_BYTES,
  type BusinessPageImage,
} from "@/lib/businessPageCustomization";
import { getBusinessStaffRole } from "@/lib/businessStaff";
import { createAdminClient, createClient } from "@/lib/supabase/server";

async function getOwnedBusiness(userId: string, requestedBusinessId: string | null) {
  if (!requestedBusinessId) {
    return null;
  }

  const supabaseAdmin = createAdminClient();
  const { data: ownedBusiness, error } = await supabaseAdmin
    .from("businesses")
    .select("id, owner_id")
    .eq("id", requestedBusinessId)
    .maybeSingle();

  if (error || !ownedBusiness?.id) {
    return null;
  }

  if (ownedBusiness.owner_id === userId) {
    return { id: ownedBusiness.id, owner_id: ownedBusiness.owner_id };
  }

  const staffRole = await getBusinessStaffRole({
    businessId: requestedBusinessId,
    userId,
  });

  if (!staffRole) {
    return null;
  }

  return { id: ownedBusiness.id, owner_id: ownedBusiness.owner_id };
}

function normalizeImageRow(row: Record<string, unknown>, index = 0): BusinessPageImage {
  return {
    id: String(row.id || ""),
    image_url: String(row.image_url || ""),
    storage_path:
      typeof row.storage_path === "string" && row.storage_path.trim()
        ? row.storage_path.trim()
        : null,
    alt_text:
      typeof row.alt_text === "string" && row.alt_text.trim()
        ? row.alt_text.trim()
        : null,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index + 1,
    is_primary: row.is_primary === true,
  };
}

async function loadGalleryImages(supabaseAdmin: ReturnType<typeof createAdminClient>, businessId: string) {
  console.log("[admin/business/gallery] reload query business_id", {
    businessId,
  });

  const { data, error } = await supabaseAdmin
    .from("business_page_images")
    .select("id, image_url, storage_path, alt_text, sort_order, is_primary, created_at")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as Array<Record<string, unknown>>)
    .filter((row) => row.image_url)
    .map((row, index) => normalizeImageRow(row, index));
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedBusinessId =
      new URL(req.url).searchParams.get("businessId")?.trim() || null;
    const ownedBusiness = await getOwnedBusiness(user.id, requestedBusinessId);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    console.log("[admin/business/gallery] fetch business_id", {
      requestedBusinessId,
      resolvedBusinessId: ownedBusiness.id,
      userId: user.id,
    });

    const supabaseAdmin = createAdminClient();
    const images = await loadGalleryImages(supabaseAdmin, ownedBusiness.id);

    return NextResponse.json({
      success: true,
      businessId: ownedBusiness.id,
      images,
      storageMode: "business_page_images",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load gallery." },
      { status: 500 }
    );
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
    const requestedBusinessId = String(formData.get("businessId") || "").trim();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Photo file is required." }, { status: 400 });
    }

    if (!isAllowedBusinessPageImageType(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, and WEBP photos are allowed." }, { status: 400 });
    }

    if (file.size > MAX_BUSINESS_PAGE_IMAGE_BYTES) {
      return NextResponse.json({ error: "Business photos must be 5 MB or smaller." }, { status: 400 });
    }

    const ownedBusiness = await getOwnedBusiness(user.id, requestedBusinessId);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    console.log("[admin/business/gallery] upload business_id", {
      requestedBusinessId,
      resolvedBusinessId: ownedBusiness.id,
      userId: user.id,
    });

    const supabaseAdmin = createAdminClient();
    const existingImages = await loadGalleryImages(supabaseAdmin, ownedBusiness.id);

    if (existingImages.length >= 20) {
      return NextResponse.json({ error: "A business gallery can include up to 20 photos." }, { status: 400 });
    }

    const storagePath = buildBusinessPageImagePath({
      businessId: ownedBusiness.id,
      fileName: file.name,
    });

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUSINESS_PAGE_IMAGES_BUCKET)
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUSINESS_PAGE_IMAGES_BUCKET)
      .getPublicUrl(storagePath);

    const nextSortOrder =
      existingImages.reduce((max, image) => Math.max(max, image.sort_order), 0) + 1;
    const { data: image, error: insertError } = await supabaseAdmin
      .from("business_page_images")
      .insert({
        business_id: ownedBusiness.id,
        image_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        alt_text: String(formData.get("altText") || "").trim() || null,
        sort_order: nextSortOrder,
        is_primary: existingImages.length === 0,
      })
      .select("id, image_url, storage_path, alt_text, sort_order, is_primary, created_at")
      .single();

    if (insertError) {
      await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
      throw new Error(insertError.message);
    }

    console.log("[admin/business/gallery] upload insert complete", {
      businessId: ownedBusiness.id,
      uploadedFileName: file.name,
      uploadSuccessCount: 1,
      insertedRowCount: image?.id ? 1 : 0,
    });

    return NextResponse.json({
      businessId: ownedBusiness.id,
      image: normalizeImageRow(image as Record<string, unknown>, nextSortOrder - 1),
      images: await loadGalleryImages(supabaseAdmin, ownedBusiness.id),
      storageMode: "business_page_images",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update gallery." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const requestedBusinessId = String(body?.businessId || "").trim();
    const primaryImageId = String(body?.primaryImageId || "").trim();
    const orderedIds: string[] = Array.isArray(body?.orderedIds)
      ? body.orderedIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)
      : [];

    if (orderedIds.length === 0 && !primaryImageId) {
      return NextResponse.json({ error: "orderedIds or primaryImageId is required." }, { status: 400 });
    }

    const ownedBusiness = await getOwnedBusiness(user.id, requestedBusinessId);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    console.log("[admin/business/gallery] patch business_id", {
      requestedBusinessId,
      resolvedBusinessId: ownedBusiness.id,
      userId: user.id,
    });

    const supabaseAdmin = createAdminClient();

    if (primaryImageId) {
      const currentImages = await loadGalleryImages(supabaseAdmin, ownedBusiness.id);
      const promoted = currentImages.find((image) => image.id === primaryImageId);
      if (!promoted) {
        return NextResponse.json({ error: "Photo not found." }, { status: 404 });
      }

      const nextOrder = [
        promoted.id,
        ...currentImages.filter((image) => image.id !== primaryImageId).map((image) => image.id),
      ];

      const primaryReset = await supabaseAdmin
        .from("business_page_images")
        .update({ is_primary: false })
        .eq("business_id", ownedBusiness.id);

      if (primaryReset.error) {
        throw new Error(primaryReset.error.message);
      }

      const updates = await Promise.all(
        nextOrder.map((id: string, index: number) =>
          supabaseAdmin
            .from("business_page_images")
            .update({ sort_order: index + 1, is_primary: id === primaryImageId })
            .eq("id", id)
            .eq("business_id", ownedBusiness.id)
        )
      );

      const failed = updates.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
    } else {
      const updates = await Promise.all(
        orderedIds.map((id: string, index: number) =>
          supabaseAdmin
            .from("business_page_images")
            .update({ sort_order: index + 1, is_primary: index === 0 })
            .eq("id", id)
            .eq("business_id", ownedBusiness.id)
        )
      );
      const failed = updates.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
    }

    return NextResponse.json({
      success: true,
      businessId: ownedBusiness.id,
      images: await loadGalleryImages(supabaseAdmin, ownedBusiness.id),
      storageMode: "business_page_images",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder gallery." },
      { status: 500 }
    );
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

    const body = await req.json();
    const requestedBusinessId = String(body?.businessId || "").trim();
    const imageId = String(body?.imageId || "").trim();
    if (!imageId) {
      return NextResponse.json({ error: "imageId is required." }, { status: 400 });
    }

    const ownedBusiness = await getOwnedBusiness(user.id, requestedBusinessId);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    console.log("[admin/business/gallery] delete business_id", {
      requestedBusinessId,
      resolvedBusinessId: ownedBusiness.id,
      userId: user.id,
    });

    const supabaseAdmin = createAdminClient();
    const { data: image, error: lookupError } = await supabaseAdmin
      .from("business_page_images")
      .select("id, storage_path")
      .eq("id", imageId)
      .eq("business_id", ownedBusiness.id)
      .maybeSingle();

    if (lookupError || !image) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("business_page_images")
      .delete()
      .eq("id", imageId)
      .eq("business_id", ownedBusiness.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const storagePath = String(image.storage_path || "");

    if (storagePath) {
      await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
    }

    const remainingImages = await loadGalleryImages(supabaseAdmin, ownedBusiness.id);
    if (remainingImages.length > 0 && !remainingImages.some((entry) => entry.is_primary)) {
      const { error: primaryError } = await supabaseAdmin
        .from("business_page_images")
        .update({ is_primary: true, sort_order: 1 })
        .eq("id", remainingImages[0].id)
        .eq("business_id", ownedBusiness.id);

      if (primaryError) {
        throw new Error(primaryError.message);
      }
    }

    return NextResponse.json({
      success: true,
      businessId: ownedBusiness.id,
      images: await loadGalleryImages(supabaseAdmin, ownedBusiness.id),
      storageMode: "business_page_images",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove photo." },
      { status: 500 }
    );
  }
}
