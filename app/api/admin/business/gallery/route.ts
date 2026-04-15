import { NextResponse } from "next/server";
import {
  buildBusinessPageImagePath,
  BUSINESS_PAGE_IMAGES_BUCKET,
  isAllowedBusinessPageImageType,
  MAX_BUSINESS_PAGE_IMAGE_BYTES,
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

function coverImageResponse(url: string) {
  return {
    id: "business-cover-image",
    image_url: url,
    storage_path: null,
    alt_text: "Business cover photo",
    sort_order: 1,
  };
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
    const [{ count, error: countError }, { data: existingImages, error: existingImagesError }] = await Promise.all([
      supabaseAdmin
        .from("business_page_images")
        .select("id", { count: "exact", head: true })
        .eq("business_id", ownedBusiness.id),
      supabaseAdmin
        .from("business_page_images")
        .select("sort_order")
        .eq("business_id", ownedBusiness.id)
        .order("sort_order", { ascending: false })
        .limit(1),
    ]);

    const galleryTableMissing =
      isMissingGalleryTableError(countError) || isMissingGalleryTableError(existingImagesError);

    if (!galleryTableMissing && (count || 0) >= 20) {
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

    if (galleryTableMissing) {
      const { error: coverError } = await supabaseAdmin
        .from("businesses")
        .update({ cover_image_url: publicUrlData.publicUrl })
        .eq("id", ownedBusiness.id)
        .eq("owner_id", user.id);

      if (coverError) {
        await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
        throw new Error(coverError.message);
      }

      return NextResponse.json({
        image: coverImageResponse(publicUrlData.publicUrl),
        storageMode: "cover_image_url",
      });
    }

    const nextSortOrder = Number(existingImages?.[0]?.sort_order || 0) + 1;
    const { data: image, error: insertError } = await supabaseAdmin
      .from("business_page_images")
      .insert({
        business_id: ownedBusiness.id,
        image_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        alt_text: String(formData.get("altText") || "").trim() || null,
        sort_order: nextSortOrder,
      })
      .select("id, image_url, storage_path, alt_text, sort_order")
      .single();

    if (insertError) {
      if (isMissingGalleryTableError(insertError)) {
        const { error: coverError } = await supabaseAdmin
          .from("businesses")
          .update({ cover_image_url: publicUrlData.publicUrl })
          .eq("id", ownedBusiness.id)
          .eq("owner_id", user.id);

        if (coverError) {
          await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
          throw new Error(coverError.message);
        }

        return NextResponse.json({
          image: coverImageResponse(publicUrlData.publicUrl),
          storageMode: "cover_image_url",
        });
      }

      await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([storagePath]);
      throw new Error(insertError.message);
    }

    return NextResponse.json({ image, storageMode: "business_page_images" });
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
    const { error: probeError } = await supabaseAdmin
      .from("business_page_images")
      .select("id", { head: true })
      .eq("business_id", ownedBusiness.id)
      .limit(1);

    if (isMissingGalleryTableError(probeError)) {
      return NextResponse.json({ success: true, storageMode: "cover_image_url" });
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        supabaseAdmin
          .from("business_page_images")
          .update({ sort_order: index + 1 })
          .eq("id", id)
          .eq("business_id", ownedBusiness.id)
      )
    );

    return NextResponse.json({ success: true, storageMode: "business_page_images" });
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
    if (imageId === "business-cover-image") {
      const { error: coverError } = await supabaseAdmin
        .from("businesses")
        .update({ cover_image_url: null })
        .eq("id", ownedBusiness.id)
        .eq("owner_id", user.id);

      if (coverError) {
        throw new Error(coverError.message);
      }

      return NextResponse.json({ success: true, storageMode: "cover_image_url" });
    }

    const { data: image, error: lookupError } = await supabaseAdmin
      .from("business_page_images")
      .select("id, storage_path")
      .eq("id", imageId)
      .eq("business_id", ownedBusiness.id)
      .maybeSingle();

    if (isMissingGalleryTableError(lookupError)) {
      return NextResponse.json({ success: true, storageMode: "cover_image_url" });
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

    if (image.storage_path) {
      await supabaseAdmin.storage.from(BUSINESS_PAGE_IMAGES_BUCKET).remove([image.storage_path]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove photo." },
      { status: 500 }
    );
  }
}
