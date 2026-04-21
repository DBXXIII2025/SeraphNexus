import { NextResponse } from "next/server";
import { sendPlatformBroadcastNotification } from "@/lib/notifications";
import { getPlatformAdminSession } from "@/lib/platformAdmin";

export async function POST(req: Request) {
  const { user, isPlatformAdmin } = await getPlatformAdminSession();

  if (!user || !isPlatformAdmin) {
    return NextResponse.redirect(new URL("/admin/platform?error=forbidden", req.url));
  }

  const formData = await req.formData();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const href = String(formData.get("href") || "").trim();

  if (!title) {
    return NextResponse.redirect(new URL("/admin/platform?error=broadcast-title-required", req.url));
  }

  if (!body) {
    return NextResponse.redirect(new URL("/admin/platform?error=broadcast-body-required", req.url));
  }

  try {
    const result = await sendPlatformBroadcastNotification({
      senderUserId: user.id,
      title,
      body,
      href: href || "/admin",
    });

    if (result.schemaMissing) {
      return NextResponse.redirect(new URL("/admin/platform?error=broadcast-schema-missing", req.url));
    }

    if (result.duplicate) {
      return NextResponse.redirect(new URL("/admin/platform?error=broadcast-duplicate", req.url));
    }

    return NextResponse.redirect(new URL("/admin/platform?success=broadcast-sent", req.url));
  } catch (error) {
    console.error("[platform/notifications] broadcast failed", {
      senderUserId: user.id,
      title,
      href: href || "/admin",
      message: error instanceof Error ? error.message : "Unknown broadcast failure",
    });
    return NextResponse.redirect(new URL("/admin/platform?error=broadcast-send-failed", req.url));
  }
}
