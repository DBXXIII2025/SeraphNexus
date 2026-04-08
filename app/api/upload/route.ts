import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds upload limit" }, { status: 400 });
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
