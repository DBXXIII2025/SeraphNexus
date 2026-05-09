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

function isLocalOrigin(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

function normalizeNextPath(nextPath: string) {
  return nextPath.startsWith("/") ? nextPath : "/admin";
}

export function getConfiguredAppUrl() {
  const explicitUrl = getExplicitConfiguredAppUrl();
  if (explicitUrl) {
    return explicitUrl;
  }

  if (isStripeLiveMode()) {
    return null;
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

export function getBrowserAppUrl() {
  const configuredUrl = getExplicitConfiguredAppUrl();

  if (typeof window !== "undefined") {
    const browserOrigin = window.location.origin;

    if (isLocalOrigin(browserOrigin)) {
      return browserOrigin;
    }

    return configuredUrl || browserOrigin;
  }

  return configuredUrl;
}

export function getPasswordResetRedirectUrl(nextPath = "/reset-password") {
  const safeNext = normalizeNextPath(nextPath);

  if (typeof window !== "undefined") {
    const browserOrigin = window.location.origin;

    if (isLocalOrigin(browserOrigin)) {
      return `${browserOrigin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
    }
  }

  return `https://seraphnexus.com/auth/callback?next=${encodeURIComponent(safeNext)}`;
}

export function getStripeConnectAppUrl(req?: Request) {
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
