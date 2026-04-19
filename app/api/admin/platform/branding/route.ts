import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import {
  buildPlatformLogoStoragePath,
  isAllowedPlatformLogoType,
  MAX_PLATFORM_LOGO_BYTES,
  PLATFORM_BRAND_ASSETS_BUCKET,
} from "@/lib/platformBranding";
import { createAdminClient, createClient } from "@/lib/supabase/server";

function wantsJson(req: Request) {
  return (
    req.headers.get("accept")?.includes("application/json") ||
    req.headers.get("x-requested-with") === "platform-branding-client"
  );
}

function respondWith(
  req: Request,
  key: "success" | "error",
  value: string,
  body: Record<string, unknown> = {},
  status = key === "success" ? 200 : 400
) {
  if (wantsJson(req)) {
    return NextResponse.json(
      {
        ok: key === "success",
        code: value,
        ...body,
      },
      { status }
    );
  }

  return NextResponse.redirect(
    new URL(`/admin/platform?${key}=${encodeURIComponent(value)}`, req.url)
  );
}

function isMissingBrandingColumnError(error: { code?: string | null; message?: string | null } | null) {
  const message = error?.message || "";
  return error?.code === "42703" || message.includes("logo_url") || message.includes("logo_storage_path");
}

export async function POST(req: Request) {
  try {
    console.info("[platform-branding] upload request received");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await getIsPlatformAdminForUserId(user.id))) {
      return respondWith(req, "error", "forbidden", {}, 403);
    }

    const formData = await req.formData();
    const action = String(formData.get("_action") || "upload");
    const supabaseAdmin = createAdminClient();
    const now = new Date().toISOString();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("platform_settings")
      .select("id, logo_storage_path")
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[platform-branding] settings lookup failed", existingError);
      return respondWith(req, "error", "platform-branding-settings-unavailable");
    }

    if (action === "clear") {
      if (!existing?.id) {
        return respondWith(req, "error", "platform-branding-settings-unavailable");
      }

      const { error: updateError } = await supabaseAdmin
        .from("platform_settings")
        .update({
          logo_url: null,
          logo_storage_path: null,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (updateError) {
        if (isMissingBrandingColumnError(updateError)) {
          return respondWith(req, "error", "platform-branding-migration-required");
        }
        console.error("[platform-branding] clear failed", updateError);
        return respondWith(req, "error", "platform-branding-save-failed");
      }

      console.info("[platform-branding] platform_settings update result", {
        action: "clear",
        settingsId: existing.id,
        logoUrl: null,
      });

      if (existing.logo_storage_path) {
        await supabaseAdmin.storage
          .from(PLATFORM_BRAND_ASSETS_BUCKET)
          .remove([existing.logo_storage_path]);
      }

      revalidatePath("/");
      revalidatePath("/explore");
      revalidatePath("/admin/platform");
      console.info("[platform-branding] final logo_url returned", null);
      return respondWith(req, "success", "platform-logo-cleared", {
        logoUrl: null,
        logoStoragePath: null,
        updatedAt: now,
      });
    }

    const file = formData.get("logo");
    if (!(file instanceof File)) {
      return respondWith(req, "error", "platform-logo-required");
    }

    if (!isAllowedPlatformLogoType(file.type)) {
      return respondWith(req, "error", "platform-logo-type-invalid");
    }

    if (file.size > MAX_PLATFORM_LOGO_BYTES) {
      return respondWith(req, "error", "platform-logo-too-large");
    }

    const storagePath = buildPlatformLogoStoragePath({
      fileName: file.name,
      contentType: file.type,
    });
    const uploadBuffer = Buffer.from(await file.arrayBuffer());
    let { error: uploadError } = await supabaseAdmin.storage
      .from(PLATFORM_BRAND_ASSETS_BUCKET)
      .upload(storagePath, uploadBuffer, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError?.message?.toLowerCase().includes("bucket")) {
      await supabaseAdmin.storage.createBucket(PLATFORM_BRAND_ASSETS_BUCKET, {
        public: true,
      });
      const retry = await supabaseAdmin.storage
        .from(PLATFORM_BRAND_ASSETS_BUCKET)
        .upload(storagePath, uploadBuffer, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        });
      uploadError = retry.error;
    }

    console.info("[platform-branding] storage upload result", {
      storagePath,
      ok: !uploadError,
      error: uploadError?.message || null,
    });

    if (uploadError) {
      console.error("[platform-branding] upload failed", uploadError);
      return respondWith(req, "error", "platform-logo-upload-failed");
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(PLATFORM_BRAND_ASSETS_BUCKET)
      .getPublicUrl(storagePath);

    let mutationError = null;
    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("platform_settings")
        .update({
          logo_url: publicUrlData.publicUrl,
          logo_storage_path: storagePath,
          updated_at: now,
        })
        .eq("id", existing.id);
      mutationError = error;
    } else {
      const { error } = await supabaseAdmin.from("platform_settings").insert({
        site_name: "Seraph Nexus",
        platform_name: "Seraph Nexus",
        logo_url: publicUrlData.publicUrl,
        logo_storage_path: storagePath,
        created_at: now,
        updated_at: now,
      });
      mutationError = error;
    }

    if (mutationError) {
      await supabaseAdmin.storage.from(PLATFORM_BRAND_ASSETS_BUCKET).remove([storagePath]);
      if (isMissingBrandingColumnError(mutationError)) {
        return respondWith(req, "error", "platform-branding-migration-required");
      }
      console.error("[platform-branding] settings update failed", mutationError);
      return respondWith(req, "error", "platform-branding-save-failed");
    }

    console.info("[platform-branding] platform_settings update result", {
      settingsId: existing?.id || "created",
      storagePath,
      logoUrl: publicUrlData.publicUrl,
    });

    if (existing?.logo_storage_path) {
      await supabaseAdmin.storage
        .from(PLATFORM_BRAND_ASSETS_BUCKET)
        .remove([existing.logo_storage_path]);
    }

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/pricing");
    revalidatePath("/admin/platform");
    console.info("[platform-branding] final logo_url returned", publicUrlData.publicUrl);
    return respondWith(req, "success", "platform-logo-updated", {
      logoUrl: publicUrlData.publicUrl,
      logoStoragePath: storagePath,
      updatedAt: now,
    });
  } catch (error) {
    console.error("[platform-branding] failed", error);
    return respondWith(req, "error", "platform-logo-update-failed", {}, 500);
  }
}
