function normalizeAbsoluteUrl(value: string, envName: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    throw new Error(`${envName} must be a valid absolute URL`);
  }
}

function getExplicitConfiguredAppUrl() {
  const explicitUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;

  if (!explicitUrl) {
    return null;
  }

  return normalizeAbsoluteUrl(
    explicitUrl,
    process.env.NEXT_PUBLIC_APP_URL ? "NEXT_PUBLIC_APP_URL" : "NEXT_PUBLIC_BASE_URL"
  );
}

export function getConfiguredAppUrl() {
  const explicitUrl = getExplicitConfiguredAppUrl();
  if (explicitUrl) {
    return explicitUrl;
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

export function isStripeLiveMode() {
  return (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");
}

export function getStripeConnectAppUrl(req?: Request) {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (isStripeLiveMode() && vercelProductionUrl) {
    return normalizeAbsoluteUrl(
      `https://${vercelProductionUrl}`,
      "VERCEL_PROJECT_PRODUCTION_URL"
    );
  }

  const configuredUrl = getExplicitConfiguredAppUrl() || getConfiguredAppUrl();

  if (isStripeLiveMode()) {
    if (!configuredUrl) {
      throw new Error(
        "Stripe live mode requires NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL to be set to the canonical HTTPS site URL."
      );
    }

    const parsedConfiguredUrl = new URL(configuredUrl);
    if (parsedConfiguredUrl.protocol !== "https:") {
      throw new Error(
        "Stripe live mode requires NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_URL to use HTTPS."
      );
    }

    return configuredUrl;
  }

  return getAppUrl(req);
}
