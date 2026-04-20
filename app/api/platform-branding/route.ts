import { NextResponse } from "next/server";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { getPlatformSettings } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    const payload = {
      siteName: resolvePlatformName(settings),
      logoUrl: resolvePlatformLogoUrl(settings),
    };

    console.info("[platform-branding] public branding payload read", {
      platformName: settings.platform_name,
      rawLogoUrl: settings.logo_url,
      resolvedLogoUrl: payload.logoUrl,
      renderDecision: payload.logoUrl ? "logo" : "fallback",
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[platform-branding] public branding read failed", error);
    return NextResponse.json(
      {
        siteName: "Seraph Nexus",
        logoUrl: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
