import { NextResponse } from "next/server";
import {
  buildSortableGalleryImageId,
  buildBusinessPageImagePath,
  BUSINESS_PAGE_IMAGES_BUCKET,
  extractBusinessAssetStoragePath,
  isAllowedBusinessPageImageType,
  MAX_BUSINESS_PAGE_IMAGE_BYTES,
  type BusinessPageImage,
} from "@/lib/businessPageCustomization";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { createAdminClient, createClient } from "@/lib/supabase/server";

async function getOwnedBusiness(userId: string) {
  const activeBusiness = await getActiveBusiness();
  if (!activeBusiness || activeBusiness.owner_id !== userId) {
    return null;
  }
  return { id: activeBusiness.id, owner_id: activeBusiness.owner_id };
}

function isMissingGalleryTableError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("business_page_images")
  );
}

function isMissingGalleryMetadataError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42703" ||
    message.includes("storage_path") ||
    message.includes("alt_text") ||
    message.includes("sort_order") ||
    message.includes("created_at")
  );
}

function normalizeImageRow(row: Record<string, unknown>, index = 0): BusinessPageImage {
  return {
    id: String(row.id || ""),
    image_url: String(row.image_url || ""),
    storage_path:
      typeof row.storage_path === "string" && row.storage_path.trim()
        ? row.storage_path.trim()
        : extractBusinessAssetStoragePath(String(row.image_url || "")),
    alt_text:
      typeof row.alt_text === "string" && row.alt_text.trim()
        ? row.alt_text.trim()
        : null,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : index + 1,
  };
}

async function loadGalleryImages(supabaseAdmin: ReturnType<typeof createAdminClient>, businessId: string) {
  let { data, error } = await supabaseAdmin
    .from("business_page_images")
    .select("id, image_url, storage_path, alt_text, sort_order")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error && isMissingGalleryMetadataError(error)) {
    const fallback = await supabaseAdmin
      .from("business_page_images")
      .select("id, image_url")
      .eq("business_id", businessId)
      .order("id", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as Array<Record<string, unknown>>)
    .filter((row) => row.image_url)
    .map((row, index) => normalizeImageRow(row, index));
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

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

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
        id: buildSortableGalleryImageId(nextSortOrder),
        business_id: ownedBusiness.id,
        image_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        alt_text: String(formData.get("altText") || "").trim() || null,
        sort_order: nextSortOrder,
      })
      .select("id, image_url, storage_path, alt_text, sort_order")
      .single();

    if (insertError) {
      if (isMissingGalleryMetadataError(insertError)) {
        const fallbackId = buildSortableGalleryImageId(nextSortOrder);
        const { data: fallbackImage, error: fallbackError } = await supabaseAdmin
          .from("business_page_images")
          .insert({
            id: fallbackId,
            business_id: ownedBusiness.id,
            image_url: publicUrlData.publicUrl,
          })
          .select("id, image_url")
          .single();

        if (fallbackError) {
          await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
          throw new Error(fallbackError.message);
        }

        return NextResponse.json({
          image: normalizeImageRow(fallbackImage as Record<string, unknown>, nextSortOrder - 1),
          images: await loadGalleryImages(supabaseAdmin, ownedBusiness.id),
          storageMode: "business_page_images",
        });
      }

      await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
      throw new Error(insertError.message);
    }

    return NextResponse.json({
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
    const orderedIds = Array.isArray(body?.orderedIds)
      ? body.orderedIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];

    if (orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds are required." }, { status: 400 });
    }

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const supabaseAdmin = createAdminClient();

    const updates = await Promise.all(
      orderedIds.map((id, index) =>
        supabaseAdmin
          .from("business_page_images")
          .update({ sort_order: index + 1 })
          .eq("id", id)
          .eq("business_id", ownedBusiness.id)
      )
    );

    if (updates.some((result) => isMissingGalleryMetadataError(result.error))) {
      const idUpdates = await Promise.all(
        orderedIds.map((id, index) =>
          supabaseAdmin
            .from("business_page_images")
            .update({ id: buildSortableGalleryImageId(index + 1) })
            .eq("id", id)
            .eq("business_id", ownedBusiness.id)
        )
      );

      const failed = idUpdates.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
    } else {
      const failed = updates.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
    }

    return NextResponse.json({
      success: true,
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
    const imageId = String(body?.imageId || "").trim();
    if (!imageId) {
      return NextResponse.json({ error: "imageId is required." }, { status: 400 });
    }

    const ownedBusiness = await getOwnedBusiness(user.id);
    if (!ownedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const supabaseAdmin = createAdminClient();
    let { data: image, error: lookupError } = await supabaseAdmin
      .from("business_page_images")
      .select("id, storage_path")
      .eq("id", imageId)
      .eq("business_id", ownedBusiness.id)
      .maybeSingle();

    if (lookupError && isMissingGalleryMetadataError(lookupError)) {
      const fallback = await supabaseAdmin
        .from("business_page_images")
        .select("id, image_url")
        .eq("id", imageId)
        .eq("business_id", ownedBusiness.id)
        .maybeSingle();
      image = fallback.data;
      lookupError = fallback.error;
    }

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

    const storagePath =
      "storage_path" in image
        ? String(image.storage_path || "")
        : extractBusinessAssetStoragePath(String((image as { image_url?: string | null }).image_url || ""));

    if (storagePath) {
      await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
    }

    return NextResponse.json({
      success: true,
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
