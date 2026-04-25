import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getIsPlatformAdminForUserId } from "@/lib/platformAdmin";
import {
  buildPlatformLogoStoragePath,
  isAllowedPlatformLogoType,
  MAX_PLATFORM_LOGO_BYTES,
  PLATFORM_BRAND_ASSETS_BUCKET,
} from "@/lib/platformBranding";
import { bootstrapPlatformSettings } from "@/lib/platformSettings";
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
  return message.includes("logo_url");
}

type PersistedBrandingRow = {
  id: string;
  platform_name: string | null;
  logo_url: string | null;
  updated_at: string | null;
};

async function ensurePlatformBrandingBucket(supabaseAdmin: ReturnType<typeof createAdminClient>) {
  console.info("[platform-branding] expected bucket name", PLATFORM_BRAND_ASSETS_BUCKET);

  const buckets = await supabaseAdmin.storage.listBuckets();
  const existingBucket = buckets.data?.find((bucket) => bucket.id === PLATFORM_BRAND_ASSETS_BUCKET);

  console.info("[platform-branding] storage readiness check result", {
    expectedBucket: PLATFORM_BRAND_ASSETS_BUCKET,
    found: Boolean(existingBucket),
    error: buckets.error?.message || null,
  });

  if (buckets.error) {
    return { ok: false, error: buckets.error.message };
  }

  if (existingBucket) {
    return { ok: true, error: null };
  }

  const created = await supabaseAdmin.storage.createBucket(PLATFORM_BRAND_ASSETS_BUCKET, {
    public: true,
  });

  console.info("[platform-branding] storage bucket create result", {
    expectedBucket: PLATFORM_BRAND_ASSETS_BUCKET,
    ok: !created.error,
    error: created.error?.message || null,
  });

  return { ok: !created.error, error: created.error?.message || null };
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

    const settingsState = await bootstrapPlatformSettings();
    const existing = settingsState.settings;

    console.info("[platform-branding] platform_settings query result", {
      settingsId: existing.id || null,
      platformName: existing.platform_name,
      logoUrl: existing.logo_url,
      fallbackBranding: !existing.platform_name || !existing.logo_url,
      hasLogoColumn: settingsState.hasLogoColumn,
      bootstrapCreated: settingsState.bootstrapCreated,
      errorMessage:
        settingsState.error instanceof Error
          ? settingsState.error.message
          : String((settingsState.error as { message?: string } | null)?.message || ""),
    });

    if (settingsState.error) {
      console.error("[platform-branding] settings lookup failed", settingsState.error);
      return respondWith(req, "error", "platform-branding-settings-unavailable");
    }

    const settingsReady = Boolean(existing.id && existing.platform_name);
    console.info("[platform-branding] readiness decision", {
      ready: settingsReady,
      reason: settingsReady
        ? "platform_settings row and platform_name are present; null logo_url is allowed"
        : "platform_settings row or platform_name is missing",
      settingsId: existing.id || null,
      platformName: existing.platform_name || null,
      logoUrl: existing.logo_url,
    });

    if (!settingsReady) {
      return respondWith(req, "error", "platform-branding-settings-unavailable");
    }

    const bucketReady = await ensurePlatformBrandingBucket(supabaseAdmin);
    if (!bucketReady.ok) {
      console.error("[platform-branding] storage bucket not ready", {
        expectedBucket: PLATFORM_BRAND_ASSETS_BUCKET,
        error: bucketReady.error,
      });
      return respondWith(req, "error", "platform-branding-storage-unavailable");
    }

    if (action === "clear") {
      if (!existing?.id) {
        return respondWith(req, "error", "platform-branding-settings-unavailable");
      }

      const { error: updateError } = await supabaseAdmin
        .from("platform_settings")
        .update({
          logo_url: null,
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

      const { data: clearedRow, error: clearedReadError } = await supabaseAdmin
        .from("platform_settings")
        .select("id, platform_name, logo_url, updated_at")
        .eq("id", existing.id)
        .maybeSingle<PersistedBrandingRow>();

      console.info("[platform-branding] final persisted logo_url after clear", {
        settingsId: clearedRow?.id || existing.id,
        platformName: clearedRow?.platform_name || existing.platform_name,
        logoUrl: clearedRow?.logo_url ?? null,
        error: clearedReadError?.message || null,
      });

      revalidatePath("/");
      revalidatePath("/explore");
      revalidatePath("/admin/platform");
      console.info("[platform-branding] final logo_url returned", null);
      console.info("[platform-branding] final branding payload", {
        platformName: existing.platform_name,
        logoUrl: null,
      });
      return respondWith(req, "success", "platform-logo-cleared", {
        logoUrl: null,
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
    console.info("[platform-branding] upload target path", {
      bucket: PLATFORM_BRAND_ASSETS_BUCKET,
      storagePath,
    });
    const uploadBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PLATFORM_BRAND_ASSETS_BUCKET)
      .upload(storagePath, uploadBuffer, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

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

    const savePayload = {
      logo_url: publicUrlData.publicUrl,
      updated_at: now,
    };
    console.info("[platform-branding] save payload being sent", {
      settingsId: existing?.id || null,
      logoUrl: savePayload.logo_url,
      storagePath,
    });

    let mutationError = null;
    let persistedBranding: PersistedBrandingRow | null = null;
    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("platform_settings")
        .update(savePayload)
        .eq("id", existing.id)
        .select("id, platform_name, logo_url, updated_at")
        .maybeSingle<PersistedBrandingRow>();
      persistedBranding = data || null;
      mutationError = error;
    } else {
      const { data, error } = await supabaseAdmin.from("platform_settings").insert({
        platform_name: "Seraph Nexus",
        logo_url: publicUrlData.publicUrl,
        created_at: now,
        updated_at: now,
      })
        .select("id, platform_name, logo_url, updated_at")
        .maybeSingle<PersistedBrandingRow>();
      persistedBranding = data || null;
      mutationError = error;
    }

    if (mutationError || !persistedBranding?.logo_url) {
      await supabaseAdmin.storage.from(PLATFORM_BRAND_ASSETS_BUCKET).remove([storagePath]);
      if (isMissingBrandingColumnError(mutationError)) {
        return respondWith(req, "error", "platform-branding-migration-required");
      }
      console.error("[platform-branding] settings update failed", {
        mutationError,
        persistedLogoUrl: persistedBranding?.logo_url || null,
      });
      return respondWith(req, "error", "platform-branding-save-failed");
    }

    console.info("[platform-branding] platform_settings update result", {
      settingsId: persistedBranding.id,
      storagePath,
      logoUrl: persistedBranding.logo_url,
      platformName: persistedBranding.platform_name,
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/pricing");
    revalidatePath("/admin/platform");
    console.info("[platform-branding] final persisted logo_url after save", {
      settingsId: persistedBranding.id,
      logoUrl: persistedBranding.logo_url,
      updatedAt: persistedBranding.updated_at,
    });
    console.info("[platform-branding] final logo_url returned", persistedBranding.logo_url);
    console.info("[platform-branding] final branding payload", {
      platformName: persistedBranding.platform_name || "Seraph Nexus",
      logoUrl: persistedBranding.logo_url,
    });
    return respondWith(req, "success", "platform-logo-updated", {
      logoUrl: persistedBranding.logo_url,
      updatedAt: persistedBranding.updated_at || now,
    });
  } catch (error) {
    console.error("[platform-branding] failed", error);
    return respondWith(req, "error", "platform-logo-update-failed", {}, 500);
  }
}
