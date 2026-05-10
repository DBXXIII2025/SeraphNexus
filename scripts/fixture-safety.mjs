import fs from "fs";
import path from "path";

export const FIXTURE_PREFIXES = ["verify-", "test-", "smoke-"];
export const FIXTURE_ENABLE_ENV = "SERAPH_ALLOW_FIXTURE_BUSINESSES";
export const REMOTE_FIXTURE_PROJECT_ALLOW_ENV = "SERAPH_ALLOW_REMOTE_FIXTURE_PROJECT";
export const PROTECTED_BUSINESS_SLUGS = new Set(["ac-life", "treasure-island-condo"]);
export const PROTECTED_BUSINESS_NAMES = new Set(["ac-life", "treasure island condo"]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

export function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const splitIndex = line.indexOf("=");
    if (splitIndex <= 0) {
      continue;
    }

    const key = line.slice(0, splitIndex).trim();
    const value = line.slice(splitIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function hasFixturePrefix(value) {
  const normalized = normalizeLower(value);
  return FIXTURE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isProtectedBusinessRecord(record) {
  const slug = normalizeLower(record?.slug);
  const name = normalizeLower(record?.name);
  return PROTECTED_BUSINESS_SLUGS.has(slug) || PROTECTED_BUSINESS_NAMES.has(name);
}

function parseUrlDetails(rawUrl, label) {
  let parsedUrl;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error(`${label} must be a valid absolute URL.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const projectRef = hostname.split(".")[0] || null;
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0";

  return {
    hostname,
    isLocalHost,
    projectRef,
    url: rawUrl,
  };
}

export function getSupabaseProjectDetails() {
  return parseUrlDetails(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), "NEXT_PUBLIC_SUPABASE_URL");
}

export function getBaseUrlDetails(baseUrl) {
  return parseUrlDetails(baseUrl, "Fixture base URL");
}

function assertTestStripeConfig() {
  const secretKey = normalizeString(process.env.STRIPE_SECRET_KEY);
  const publishableKey = normalizeString(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const webhookSecret = normalizeString(process.env.STRIPE_WEBHOOK_SECRET);

  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "Fixture seeding requires STRIPE_SECRET_KEY to be a Stripe test key (sk_test_*)."
    );
  }

  if (!publishableKey.startsWith("pk_test_")) {
    throw new Error(
      "Fixture seeding requires NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to be a Stripe test key (pk_test_*)."
    );
  }

  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error(
      "Fixture seeding requires STRIPE_WEBHOOK_SECRET to be a test webhook secret (whsec_*)."
    );
  }
}

function assertFixtureProjectAccess(commandName) {
  const supabaseProject = getSupabaseProjectDetails();
  const allowedProjectRef = normalizeString(
    process.env[REMOTE_FIXTURE_PROJECT_ALLOW_ENV]
  );

  if (!supabaseProject.isLocalHost) {
    if (!allowedProjectRef) {
      throw new Error(
        `${commandName} refused to run against remote/shared Supabase project ${supabaseProject.projectRef}. ` +
          `Set ${FIXTURE_ENABLE_ENV}=1 and ${REMOTE_FIXTURE_PROJECT_ALLOW_ENV}=${supabaseProject.projectRef} only for an intentionally allowlisted dev project.`
      );
    }

    if (allowedProjectRef !== supabaseProject.projectRef) {
      throw new Error(
        `${commandName} refused to run because ${REMOTE_FIXTURE_PROJECT_ALLOW_ENV}=${allowedProjectRef} does not exactly match the current Supabase project ref ${supabaseProject.projectRef}.`
      );
    }
  }

  return supabaseProject;
}

function logFixtureModeBanner(args) {
  console.warn("🚨 FIXTURE SEEDING ENABLED");
  console.warn(`Project: ${args.projectRef || "local"}`);
  console.warn(`Environment: ${process.env.NODE_ENV || "development"}`);
}

export function assertFixtureEnvironment(args = {}) {
  const {
    commandName = "fixture command",
    requireVerifyFlag = true,
    requireLocalBaseUrl = true,
    requireStripeKeys = true,
    baseUrl = null,
    logBanner = true,
  } = args;

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${commandName} is blocked when NODE_ENV=production.`);
  }

  if (process.env[FIXTURE_ENABLE_ENV] !== "1") {
    throw new Error(
      `${commandName} requires ${FIXTURE_ENABLE_ENV}=1 before any fixture/test/smoke business inserts are allowed.`
    );
  }

  if (requireVerifyFlag && process.env.SERAPH_NON_LIVE_VERIFY !== "1") {
    throw new Error(`${commandName} requires SERAPH_NON_LIVE_VERIFY=1.`);
  }

  if (requireStripeKeys) {
    assertTestStripeConfig();
  }

  const supabaseProject = assertFixtureProjectAccess(commandName);

  if (requireLocalBaseUrl) {
    const baseUrlDetails = getBaseUrlDetails(baseUrl);
    if (!baseUrlDetails.isLocalHost) {
      throw new Error(
        `${commandName} refused to run because the app URL is not localhost: ${baseUrlDetails.url}`
      );
    }
  }

  if (logBanner) {
    logFixtureModeBanner({
      projectRef: supabaseProject.projectRef,
    });
  }

  return supabaseProject;
}

export function assertFixtureBusinessAllowed(record, commandName = "fixture command") {
  const slug = normalizeString(record?.slug);
  const name = normalizeString(record?.name);
  const fixtureLike = hasFixturePrefix(slug) || hasFixturePrefix(name);

  if (!fixtureLike) {
    return;
  }

  if (process.env[FIXTURE_ENABLE_ENV] !== "1") {
    throw new Error(
      `${commandName} refused to insert fixture-like business ${slug || name || "<unknown>"} because ${FIXTURE_ENABLE_ENV}=1 is not set.`
    );
  }

  const supabaseProject = getSupabaseProjectDetails();
  if (!supabaseProject.isLocalHost) {
    const allowedProjectRef = normalizeString(
      process.env[REMOTE_FIXTURE_PROJECT_ALLOW_ENV]
    );

    if (!allowedProjectRef || allowedProjectRef !== supabaseProject.projectRef) {
      throw new Error(
        `${commandName} refused to insert fixture-like business ${slug || name || "<unknown>"} into remote/shared project ${supabaseProject.projectRef}.`
      );
    }
  }
}

export function filterFixtureBusinesses(records, options = {}) {
  const { includeProtected = false } = options;

  return (records || []).filter((record) => {
    const matchesFixture =
      hasFixturePrefix(record?.slug) || hasFixturePrefix(record?.name);

    if (!matchesFixture) {
      return false;
    }

    if (!includeProtected && isProtectedBusinessRecord(record)) {
      return false;
    }

    return true;
  });
}
