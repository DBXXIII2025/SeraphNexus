import { NextResponse } from "next/server";
import { resolvePlatformLogoUrl, resolvePlatformName } from "@/lib/platformBranding";
import { inspectPlatformLogoAsset } from "@/lib/platformLogoAsset";
import { getPlatformSettings } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    const resolvedLogoUrl = resolvePlatformLogoUrl(settings);
    const assetStatus = await inspectPlatformLogoAsset(resolvedLogoUrl);
    const payload = {
      siteName: resolvePlatformName(settings),
      logoUrl: assetStatus.reachable ? resolvedLogoUrl : null,
      logoReachable: assetStatus.reachable,
      storedLogoUrl: resolvedLogoUrl,
    };

    console.info("[platform-branding] public branding payload read", {
      platformName: settings.platform_name,
      rawLogoUrl: settings.logo_url,
      resolvedLogoUrl,
      returnedLogoUrl: payload.logoUrl,
      renderDecision: payload.logoUrl ? "logo" : "fallback",
      assetReachable: assetStatus.reachable,
      assetStatusCode: assetStatus.statusCode,
      assetContentType: assetStatus.contentType,
      assetReason: assetStatus.reason,
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
        logoReachable: false,
        storedLogoUrl: null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
