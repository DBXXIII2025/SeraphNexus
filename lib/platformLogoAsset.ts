export type PlatformLogoAssetStatus = {
  checked: boolean;
  reachable: boolean;
  statusCode: number | null;
  contentType: string | null;
  reason: string;
};

export async function inspectPlatformLogoAsset(
  logoUrl: string | null | undefined
): Promise<PlatformLogoAssetStatus> {
  const normalizedUrl = String(logoUrl || "").trim();
  if (!normalizedUrl) {
    return {
      checked: false,
      reachable: false,
      statusCode: null,
      contentType: null,
      reason: "missing-logo-url",
    };
  }

  try {
    const headResponse = await fetch(normalizedUrl, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const contentType = headResponse.headers.get("content-type");
    const reachable = headResponse.ok && Boolean(contentType?.startsWith("image/"));

    return {
      checked: true,
      reachable,
      statusCode: headResponse.status,
      contentType,
      reason: reachable ? "head-image-ok" : "head-non-image-or-error",
    };
  } catch (headError) {
    try {
      const getResponse = await fetch(normalizedUrl, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const contentType = getResponse.headers.get("content-type");
      const reachable = getResponse.ok && Boolean(contentType?.startsWith("image/"));
      return {
        checked: true,
        reachable,
        statusCode: getResponse.status,
        contentType,
        reason: reachable ? "get-image-ok" : "get-non-image-or-error",
      };
    } catch (getError) {
      console.error("[platform-branding] asset inspection failed", {
        logoUrl: normalizedUrl,
        headError: headError instanceof Error ? headError.message : String(headError),
        getError: getError instanceof Error ? getError.message : String(getError),
      });
      return {
        checked: true,
        reachable: false,
        statusCode: null,
        contentType: null,
        reason: "network-error",
      };
    }
  }
}
