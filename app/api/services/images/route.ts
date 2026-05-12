import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  buildServiceImageStoragePath,
  getPrimaryServiceImage,
  isAllowedServiceImageType,
  MAX_SERVICE_IMAGE_BYTES,
  SERVICE_IMAGES_BUCKET,
  sortServiceImages,
  type ServiceImageRecord,
} from "@/lib/serviceImages";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import { loadBusinessUsageSnapshot } from "@/lib/planUsageServer";

type ServiceRow = {
  id: string;
  business_id: string;
  name: string | null;
  owner_id?: string | null;
  plan?: string | null;
};

type ServiceImageRow = ServiceImageRecord;

type JsonBody = {
  action?: string;
  businessId?: string;
  serviceId?: string;
  imageId?: string;
  orderedImageIds?: string[];
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown service image error";
}

async function getOwnedService(args: { serviceId: string; userId: string }) {
  const supabaseAdmin = createAdminClient();
  const { data: service, error } = await supabaseAdmin
    .from("services")
    .select("id, business_id, name")
    .eq("id", args.serviceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!service?.id) {
    return null;
  }

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, owner_id, plan")
    .eq("id", service.business_id)
    .eq("owner_id", args.userId)
    .maybeSingle();

  if (businessError) {
    throw new Error(businessError.message);
  }

  if (!business?.id) {
    return null;
  }

  return {
    ...(service as ServiceRow),
    owner_id: business.owner_id || null,
    plan: business.plan || null,
  } satisfies ServiceRow;
}

async function loadServiceImages(serviceId: string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("service_images")
    .select("id, service_id, business_id, image_url, storage_path, alt_text, sort_order, is_primary, created_at")
    .eq("service_id", serviceId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return sortServiceImages((data || []) as ServiceImageRow[]);
}

async function persistPrimaryState(serviceId: string, imageId: string) {
  const supabaseAdmin = createAdminClient();

  const { error: resetError } = await supabaseAdmin
    .from("service_images")
    .update({ is_primary: false })
    .eq("service_id", serviceId);

  if (resetError) {
    throw new Error(resetError.message);
  }

  const { error: primaryError } = await supabaseAdmin
    .from("service_images")
    .update({ is_primary: true })
    .eq("service_id", serviceId)
    .eq("id", imageId);

  if (primaryError) {
    throw new Error(primaryError.message);
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
    const serviceId = String(formData.get("serviceId") || "").trim();
    const file = formData.get("file");

    if (!serviceId || !(file instanceof File)) {
      return NextResponse.json({ error: "Service and image file are required." }, { status: 400 });
    }

    const ownedService = await getOwnedService({ serviceId, userId: user.id });

    if (!ownedService) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isAllowedServiceImageType(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, and WEBP service images are allowed." }, { status: 400 });
    }

    if (file.size > MAX_SERVICE_IMAGE_BYTES) {
      return NextResponse.json({ error: "Service images must be 4 MB or smaller." }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const effectivePlan = await resolveAccessPlanForBusiness({
      business: {
        id: ownedService.business_id,
        owner_id: ownedService.owner_id || null,
        plan: ownedService.plan || null,
      },
      userId: user.id,
      email: user.email || null,
    });
    const usage = await loadBusinessUsageSnapshot(ownedService.business_id);
    const uploadLimit = getUsageLimitResult({
      plan: effectivePlan,
      limitKey: "max_uploads",
      current: Number(usage.max_uploads || 0),
      customMessage:
        "This workspace has reached its image upload limit. Upgrade to Pro or Elite for more media capacity.",
    });

    if (!uploadLimit.allowed) {
      return NextResponse.json(
        { error: uploadLimit.message || "Image upload limit reached." },
        { status: 403 }
      );
    }

    const existingImages = await loadServiceImages(serviceId);
    const storagePath = buildServiceImageStoragePath({
      businessId: ownedService.business_id,
      serviceId,
      fileName: file.name,
    });

    const uploadBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(SERVICE_IMAGES_BUCKET)
      .upload(storagePath, uploadBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(SERVICE_IMAGES_BUCKET)
      .getPublicUrl(storagePath);

    const nextSortOrder = existingImages.length;
    const isPrimary = existingImages.length === 0;

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("service_images")
      .insert({
        service_id: serviceId,
        business_id: ownedService.business_id,
        image_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        alt_text: ownedService.name || "Service image",
        sort_order: nextSortOrder,
        is_primary: isPrimary,
      })
      .select("id, service_id, business_id, image_url, storage_path, alt_text, sort_order, is_primary, created_at")
      .single();

    if (insertError) {
      await supabaseAdmin.storage.from(SERVICE_IMAGES_BUCKET).remove([storagePath]);
      throw new Error(insertError.message);
    }

    return NextResponse.json({ image: inserted as ServiceImageRow });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
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

    const body = (await req.json()) as JsonBody;
    const serviceId = String(body.serviceId || "").trim();
    const imageId = String(body.imageId || "").trim();
    const action = String(body.action || "").trim();

    if (!serviceId || !action) {
      return NextResponse.json({ error: "Missing service image action." }, { status: 400 });
    }

    const ownedService = await getOwnedService({ serviceId, userId: user.id });

    if (!ownedService) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    if (action === "set-primary") {
      if (!imageId) {
        return NextResponse.json({ error: "Missing imageId." }, { status: 400 });
      }

      const { data: image, error: imageError } = await supabaseAdmin
        .from("service_images")
        .select("id")
        .eq("id", imageId)
        .eq("service_id", serviceId)
        .eq("business_id", ownedService.business_id)
        .maybeSingle();

      if (imageError) {
        throw new Error(imageError.message);
      }

      if (!image?.id) {
        return NextResponse.json({ error: "Image not found." }, { status: 404 });
      }

      await persistPrimaryState(serviceId, imageId);
      return NextResponse.json({ images: await loadServiceImages(serviceId) });
    }

    if (action === "reorder") {
      const orderedImageIds = Array.isArray(body.orderedImageIds)
        ? body.orderedImageIds.map((id) => String(id))
        : [];

      if (orderedImageIds.length === 0) {
        return NextResponse.json({ error: "No image order provided." }, { status: 400 });
      }

      const images = await loadServiceImages(serviceId);
      const knownIds = new Set(images.map((image) => image.id));
      const isValidOrder =
        orderedImageIds.length === images.length &&
        orderedImageIds.every((id) => knownIds.has(id));

      if (!isValidOrder) {
        return NextResponse.json({ error: "Invalid image order." }, { status: 400 });
      }

      for (const [index, orderedImageId] of orderedImageIds.entries()) {
        const { error: updateError } = await supabaseAdmin
          .from("service_images")
          .update({ sort_order: index })
          .eq("id", orderedImageId)
          .eq("service_id", serviceId)
          .eq("business_id", ownedService.business_id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      return NextResponse.json({ images: await loadServiceImages(serviceId) });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
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

    const body = (await req.json()) as JsonBody;
    const serviceId = String(body.serviceId || "").trim();
    const imageId = String(body.imageId || "").trim();

    if (!serviceId || !imageId) {
      return NextResponse.json({ error: "Missing imageId or serviceId." }, { status: 400 });
    }

    const ownedService = await getOwnedService({ serviceId, userId: user.id });

    if (!ownedService) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: targetImage, error: targetError } = await supabaseAdmin
      .from("service_images")
      .select("id, service_id, business_id, image_url, storage_path, alt_text, sort_order, is_primary, created_at")
      .eq("id", imageId)
      .eq("service_id", serviceId)
      .eq("business_id", ownedService.business_id)
      .maybeSingle();

    if (targetError) {
      throw new Error(targetError.message);
    }

    if (!targetImage?.id) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("service_images")
      .delete()
      .eq("id", imageId)
      .eq("service_id", serviceId)
      .eq("business_id", ownedService.business_id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (targetImage.storage_path) {
      await supabaseAdmin.storage.from(SERVICE_IMAGES_BUCKET).remove([targetImage.storage_path]);
    }

    const remainingImages = await loadServiceImages(serviceId);

    for (const [index, image] of remainingImages.entries()) {
      const { error: reorderError } = await supabaseAdmin
        .from("service_images")
        .update({ sort_order: index })
        .eq("id", image.id)
        .eq("service_id", serviceId)
        .eq("business_id", ownedService.business_id);

      if (reorderError) {
        throw new Error(reorderError.message);
      }
    }

    if (targetImage.is_primary === true && remainingImages.length > 0) {
      const nextPrimary = getPrimaryServiceImage(remainingImages);
      if (nextPrimary?.id) {
        await persistPrimaryState(serviceId, nextPrimary.id);
      }
    }

    return NextResponse.json({ images: await loadServiceImages(serviceId) });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
