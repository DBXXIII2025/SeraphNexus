function normalizeAbsoluteUrl(value: string, envName: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    throw new Error(`${envName} must be a valid absolute URL`);
  }
}

export function getConfiguredAppUrl() {
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;

  if (explicitUrl) {
    return normalizeAbsoluteUrl(
      explicitUrl,
      process.env.NEXT_PUBLIC_APP_URL ? "NEXT_PUBLIC_APP_URL" : "NEXT_PUBLIC_BASE_URL"
    );
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionUrl) {
    return normalizeAbsoluteUrl(
      `https://${vercelProductionUrl}`,
      "VERCEL_PROJECT_PRODUCTION_URL"
    );
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return normalizeAbsoluteUrl(`https://${vercelUrl}`, "VERCEL_URL");
  }

  return null;
}

export function getAppUrl(req?: Request) {
  const configuredUrl = getConfiguredAppUrl();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (req) {
    return new URL(req.url).origin;
  }

  throw new Error(
    "Missing app URL. Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL, or provide a request context."
  );
}

