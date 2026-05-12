import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolveAccessPlanForBusiness } from "@/lib/accessGrants";
import { getUsageLimitResult } from "@/lib/planEnforcement";
import { loadBusinessUsageSnapshot } from "@/lib/planUsageServer";

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
]);

function sanitizeExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.trim().toLowerCase() || "";
  return extension.replace(/[^a-z0-9]/g, "");
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const businessId = String(formData.get("businessId") || "").trim();

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds upload limit" }, { status: 400 });
  }

  if (businessId) {
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_id, plan")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (businessError || !business?.id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
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
    const usage = await loadBusinessUsageSnapshot(business.id);
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
  }

  const fileExt = sanitizeExtension(file.name) || "bin";
  const fileName = `${user.id}-${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("business-assets")
    .upload(fileName, file);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage
    .from("business-assets")
    .getPublicUrl(fileName);

  return NextResponse.json({
    url: data.publicUrl,
  });
}
