import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const VERIFY_PREFIX = "verify-";
const DEFAULT_PORT = Number(process.env.SERAPH_VERIFY_PORT || "4123");
const BASE_URL = process.env.SERAPH_VERIFY_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`;
const DEFAULT_PASSWORD = process.env.SERAPH_VERIFY_PASSWORD || "VerifyPass123!";
const REQUEST_EMAIL = "smoke.customer@seraph.test";
const REQUEST_PHONE = "555-0100";
const REQUEST_NAME = "Smoke Customer";
const TIME_ZONE = "America/Chicago";
const REQUIRED_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

const FIXTURES = [
  {
    key: "service",
    businessType: "service",
    slug: "verify-service",
    name: "Verify Service Studio",
    publicPath: "/book/verify-service",
    adminPaths: ["/admin/services", "/admin/bookings", "/admin/settings"],
    ownerEmail: "verify-service-owner@seraph.test",
  },
  {
    key: "rental",
    businessType: "rental",
    slug: "verify-rental",
    name: "Verify Rental Supply",
    publicPath: "/rent/verify-rental",
    adminPaths: ["/admin/rentals", "/admin/bookings", "/admin/settings"],
    ownerEmail: "verify-rental-owner@seraph.test",
  },
  {
    key: "property",
    businessType: "property",
    slug: "verify-property",
    name: "Verify Property Stay",
    publicPath: "/rent/verify-property",
    adminPaths: ["/admin/rentals", "/admin/bookings", "/admin/settings"],
    ownerEmail: "verify-property-owner@seraph.test",
  },
  {
    key: "restaurant",
    businessType: "restaurant",
    slug: "verify-restaurant",
    name: "Verify Restaurant",
    publicPath: "/order/verify-restaurant",
    adminPaths: ["/admin/products", "/admin/orders", "/admin/settings"],
    ownerEmail: "verify-restaurant-owner@seraph.test",
  },
  {
    key: "food",
    businessType: "food",
    slug: "verify-food",
    name: "Verify Food Vendor",
    publicPath: "/order/verify-food",
    adminPaths: ["/admin/products", "/admin/orders", "/admin/settings"],
    ownerEmail: "verify-food-owner@seraph.test",
  },
  {
    key: "store",
    businessType: "store",
    slug: "verify-store",
    name: "Verify Store",
    publicPath: "/shop/verify-store",
    adminPaths: ["/admin/products", "/admin/orders", "/admin/settings"],
    ownerEmail: "verify-store-owner@seraph.test",
  },
  {
    key: "creator",
    businessType: "creator",
    slug: "verify-creator",
    name: "Verify Creator Shop",
    publicPath: "/shop/verify-creator",
    adminPaths: ["/admin/products", "/admin/orders", "/admin/settings"],
    ownerEmail: "verify-creator-owner@seraph.test",
  },
  {
    key: "product",
    businessType: "product",
    slug: "verify-product",
    name: "Verify Product Lab",
    publicPath: "/shop/verify-product",
    adminPaths: ["/admin/products", "/admin/orders", "/admin/settings"],
    ownerEmail: "verify-product-owner@seraph.test",
  },
];

function loadEnvLocal() {
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

function assertNonLiveMode() {
  if (process.env.SERAPH_NON_LIVE_VERIFY !== "1") {
    throw new Error("SERAPH_NON_LIVE_VERIFY=1 is required for the verification harness.");
  }

  const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || "");
  if (stripeSecretKey.startsWith("sk_live_")) {
    throw new Error("Refusing to run against a live Stripe secret key.");
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function createSupabaseAdmin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function assertBusinessModeSchemaReady(supabase) {
  const { error } = await supabase
    .from("businesses")
    .select("id,language,pickup_enabled,delivery_enabled,onsite_enabled,remote_enabled")
    .limit(1);

  if (error) {
    throw new Error(
      `Verification database is missing business mode columns. Apply sql/migrations/20260413_business_language_and_modes.sql to the non-live database before running toggle verification. Supabase error: ${error.message}`
    );
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(input, days) {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
}

function dateRange(startOffset, endOffset) {
  const start = addDays(new Date(), startOffset);
  const end = addDays(new Date(), endOffset);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractMissingColumn(error) {
  const message = String(error?.message || "");
  const match = message.match(/Could not find the '([^']+)' column of '([^']+)'/);
  if (match) {
    return {
      column: match[1],
      table: match[2],
    };
  }

  const generatedMatch = message.match(/cannot insert a non-DEFAULT value into column "([^"]+)"/);
  if (!generatedMatch) {
    return null;
  }

  return {
    column: generatedMatch[1],
    table: null,
  };
}

function stripColumn(payload, column) {
  if (Array.isArray(payload)) {
    return payload.map((entry) => stripColumn(entry, column));
  }

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const next = { ...payload };
  delete next[column];
  return next;
}

async function runSchemaTolerantMutation(table, payload, runMutation) {
  let nextPayload = payload;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await runMutation(nextPayload);
    if (!error) {
      return { data, payload: nextPayload };
    }

    const missing = extractMissingColumn(error);
    if (!missing || (missing.table && missing.table !== table)) {
      return { data, error, payload: nextPayload };
    }

    nextPayload = stripColumn(nextPayload, missing.column);
    console.warn(`[verify] ${table} mutation stripped missing column: ${missing.column}`);
  }

  throw new Error(`[verify] exceeded schema-tolerant retries for ${table}`);
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readLegalDocumentVersions() {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/legalDocuments.ts"), "utf8");
  const entries = {};
  const matches = source.matchAll(
    /([a-z_]+):\s*\{\s*[\s\S]*?documentVersion:\s*"([^"]+)"/g
  );

  for (const match of matches) {
    entries[match[1]] = match[2];
  }

  return entries;
}

function getRequiredDocumentKeys(businessType) {
  const all = [
    "terms_of_service",
    "privacy_policy",
    "business_owner_platform_agreement",
    "advertising_listing_responsibility_agreement",
    "refund_chargeback_responsibility_agreement",
    "payment_processing_fee_disclosure_agreement",
    "messaging_communication_disclaimer",
  ];

  if (businessType === "rental" || businessType === "property") {
    all.push("rental_property_late_fee_disclosure_agreement");
  }

  return all;
}

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    users.push(...(data.users || []));
    if (!data.users || data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
}

async function findUserByEmail(supabase, email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const users = await listAllUsers(supabase);
  return (
    users.find((user) => String(user.email || "").trim().toLowerCase() === normalized) || null
  );
}

async function ensureOwnerUser(supabase, fixture) {
  const existing = await findUserByEmail(supabase, fixture.ownerEmail);
  const password = DEFAULT_PASSWORD;

  if (existing?.id) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password,
      user_metadata: {
        verification_fixture: true,
        verification_key: fixture.key,
      },
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: fixture.ownerEmail,
    password,
    email_confirm: true,
    user_metadata: {
      verification_fixture: true,
      verification_key: fixture.key,
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function maybeUpsertProfile(supabase, user, fixture) {
  const profilePayload = {
    id: user.id,
    email: fixture.ownerEmail,
    full_name: fixture.name,
    is_platform_admin: false,
  };

  const { error } = await runSchemaTolerantMutation(
    "profiles",
    profilePayload,
    (nextPayload) =>
      supabase.from("profiles").upsert(nextPayload, {
        onConflict: "id",
      })
  );

  if (error) {
    console.warn("[verify] profile upsert skipped:", error.message);
  }
}

async function deleteSeedUsers(supabase) {
  const users = await listAllUsers(supabase);
  const matching = users.filter((user) =>
    FIXTURES.some((fixture) => fixture.ownerEmail === user.email)
  );

  for (const user of matching) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      throw error;
    }
  }
}

async function maybeSingle(query) {
  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }
  return data || null;
}

async function seedBusinessBase(supabase, fixture, ownerUser) {
  const existing = await maybeSingle(
    supabase.from("businesses").select("id").eq("slug", fixture.slug)
  );

  const payload = {
    owner_id: ownerUser.id,
    name: fixture.name,
    description: `${fixture.name} verification fixture`,
    slug: fixture.slug,
    business_type: fixture.businessType,
    is_published: true,
    email: fixture.ownerEmail,
    stripe_account_id: `acct_verify_${fixture.key}`,
    stripe_onboarding_complete: true,
    stripe_charges_enabled: true,
    stripe_payouts_enabled: true,
    plan: "pro",
    language: "en",
    pickup_enabled: true,
    delivery_enabled: true,
    onsite_enabled: true,
    remote_enabled: true,
    refund_policy: "Verification refund policy",
    late_fee_disclosure:
      fixture.businessType === "rental" || fixture.businessType === "property"
        ? "Late fees apply after the grace period."
        : null,
  };

  if (existing?.id) {
    const { data, error } = await runSchemaTolerantMutation(
      "businesses",
      payload,
      (nextPayload) =>
        supabase
          .from("businesses")
          .update(nextPayload)
          .eq("id", existing.id)
          .select("*")
          .maybeSingle()
    );

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await runSchemaTolerantMutation(
    "businesses",
    payload,
    (nextPayload) =>
      supabase
        .from("businesses")
        .insert(nextPayload)
        .select("*")
        .maybeSingle()
  );

  if (error) {
    throw error;
  }

  return data;
}

async function seedLegalAcceptances(supabase, userId, business) {
  const versions = readLegalDocumentVersions();
  const rows = getRequiredDocumentKeys(business.business_type).map((documentKey) => ({
    user_id: userId,
    business_id: business.id,
    document_key: documentKey,
    document_version: versions[documentKey],
    accepted_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("legal_acceptances").upsert(rows, {
    onConflict: "user_id,business_id,document_key",
  });

  if (error?.code === "42P10") {
    const { error: deleteError } = await supabase
      .from("legal_acceptances")
      .delete()
      .eq("user_id", userId)
      .eq("business_id", business.id);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await supabase.from("legal_acceptances").insert(rows);
    if (insertError) {
      throw insertError;
    }
    return;
  }

  if (error) {
    throw error;
  }
}

async function seedServiceFixture(supabase, business) {
  const { data: insertedServices, error: servicesError } = await runSchemaTolerantMutation(
    "services",
    [
      {
        business_id: business.id,
        name: "Consultation",
        description: "Verification consultation",
        category: "Consulting",
        price: 120,
        duration: 60,
        is_active: true,
        archived_at: null,
        updated_at: new Date().toISOString(),
      },
      {
        business_id: business.id,
        name: "Follow-up Session",
        description: "Verification follow-up",
        category: "Consulting",
        price: 80,
        duration: 30,
        is_active: true,
        archived_at: null,
        updated_at: new Date().toISOString(),
      },
    ],
    (nextPayload) =>
      supabase
        .from("services")
        .insert(nextPayload)
        .select("id,name,price,duration")
  );

  if (servicesError) {
    throw servicesError;
  }

  const availabilityRows = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    business_id: business.id,
    day_of_week: dayOfWeek,
    start_time: "09:00",
    end_time: "17:00",
  }));

  const { error: availabilityError } = await supabase.from("availability").insert(availabilityRows);
  if (availabilityError) {
    throw availabilityError;
  }

  const bookingDates = {
    pending: formatDate(addDays(new Date(), 3)),
    confirmed: formatDate(addDays(new Date(), 4)),
    completed: formatDate(addDays(new Date(), 2)),
  };

  const serviceId = insertedServices?.[0]?.id;
  const commonMetadata = serviceId ? { service_id: serviceId } : {};

  const { error: bookingsError } = await runSchemaTolerantMutation(
    "bookings",
    [
      {
        business_id: business.id,
        guest_name: "Pending Guest",
        guest_email: "pending.service@seraph.test",
        customer_name: "Pending Guest",
        customer_email: "pending.service@seraph.test",
        phone: "555-0201",
        reminder_sent: false,
        date: bookingDates.pending,
        start_time: "09:00",
        end_time: "09:30",
        booking_time: `${bookingDates.pending}T09:00:00`,
        duration_minutes: 30,
        status: "pending",
        payment_status: "unpaid",
        amount_total: 80,
        total_amount: 80,
        hidden_from_ui: false,
        metadata: commonMetadata,
      },
      {
        business_id: business.id,
        guest_name: "Confirmed Guest",
        guest_email: "confirmed.service@seraph.test",
        customer_name: "Confirmed Guest",
        customer_email: "confirmed.service@seraph.test",
        phone: "555-0202",
        reminder_sent: false,
        date: bookingDates.confirmed,
        start_time: "10:00",
        end_time: "10:30",
        booking_time: `${bookingDates.confirmed}T10:00:00`,
        duration_minutes: 30,
        status: "confirmed",
        payment_status: "paid",
        amount_total: 120,
        total_amount: 120,
        platform_fee: 2,
        hidden_from_ui: false,
        metadata: commonMetadata,
      },
      {
        business_id: business.id,
        guest_name: "Completed Guest",
        guest_email: "completed.service@seraph.test",
        customer_name: "Completed Guest",
        customer_email: "completed.service@seraph.test",
        phone: "555-0203",
        reminder_sent: true,
        date: bookingDates.completed,
        start_time: "11:00",
        end_time: "12:00",
        booking_time: `${bookingDates.completed}T11:00:00`,
        duration_minutes: 60,
        status: "confirmed",
        payment_status: "paid",
        amount_total: 120,
        total_amount: 120,
        platform_fee: 2,
        hidden_from_ui: false,
        completed_at: new Date().toISOString(),
        metadata: commonMetadata,
      },
    ],
    (nextPayload) => supabase.from("bookings").insert(nextPayload)
  );

  if (bookingsError) {
    throw bookingsError;
  }

  return {
    services: insertedServices || [],
    targetDate: bookingDates.confirmed,
  };
}

async function seedRentalFixture(supabase, business, labelPrefix) {
  const { data: property, error: propertyError } = await runSchemaTolerantMutation(
    "property",
    {
      business_id: business.id,
      name: `${labelPrefix} Listing`,
      description: `${labelPrefix} verification listing`,
      price: 220,
    },
    (nextPayload) =>
      supabase
        .from("property")
        .insert(nextPayload)
        .select("*")
        .maybeSingle()
  );

  if (propertyError) {
    throw propertyError;
  }

  const { error: contentError } = await runSchemaTolerantMutation(
    "property_content",
    {
      property_id: property.id,
      business_id: business.id,
      title: `${labelPrefix} Listing`,
      description: `${labelPrefix} verification content`,
    },
    (nextPayload) => supabase.from("property_content").insert(nextPayload)
  );

  if (contentError) {
    throw contentError;
  }

  const blockedRange = dateRange(8, 10);
  const paidRange = dateRange(11, 13);
  const completedRange = dateRange(-5, -3);

  const { error: blockError } = await runSchemaTolerantMutation(
    "rental_availability_blocks",
    {
      business_id: business.id,
      property_id: property.id,
      start_date: blockedRange.start,
      end_date: blockedRange.end,
      reason: "maintenance",
    },
    (nextPayload) => supabase.from("rental_availability_blocks").insert(nextPayload)
  );

  if (blockError) {
    throw blockError;
  }

  const { error: reservationError } = await runSchemaTolerantMutation(
    "rental_reservations",
    [
      {
        business_id: business.id,
        property_id: property.id,
        status: "pending",
        payment_status: "unpaid",
        guest_name: "Pending Guest",
        guest_email: `${business.business_type}.pending@seraph.test`,
        guest_phone: "555-0301",
        check_in_date: dateRange(14, 15).start,
        check_out_date: dateRange(14, 15).end,
        nights: 1,
        amount_total: 220,
        hidden_from_ui: false,
        metadata: { source: "verification_seed" },
      },
      {
        business_id: business.id,
        property_id: property.id,
        status: "confirmed",
        payment_status: "paid",
        guest_name: "Paid Guest",
        guest_email: `${business.business_type}.paid@seraph.test`,
        guest_phone: "555-0302",
        check_in_date: paidRange.start,
        check_out_date: paidRange.end,
        nights: 2,
        amount_total: 440,
        platform_fee: 9,
        hidden_from_ui: false,
        metadata: { source: "verification_seed" },
      },
      {
        business_id: business.id,
        property_id: property.id,
        status: "completed",
        payment_status: "paid",
        guest_name: "Completed Guest",
        guest_email: `${business.business_type}.completed@seraph.test`,
        guest_phone: "555-0303",
        check_in_date: completedRange.start,
        check_out_date: completedRange.end,
        nights: 2,
        amount_total: 440,
        platform_fee: 9,
        hidden_from_ui: false,
        completed_at: new Date().toISOString(),
        metadata: { source: "verification_seed" },
      },
    ],
    (nextPayload) => supabase.from("rental_reservations").insert(nextPayload)
  );

  if (reservationError) {
    throw reservationError;
  }

  return {
    property,
    blockedRange,
    paidRange,
  };
}

async function seedCatalogFixture(supabase, business) {
  const { data: products, error: productsError } = await runSchemaTolerantMutation(
    "products",
    [
      {
        business_id: business.id,
        name: `${business.name} Signature Item`,
        description: "Primary verification catalog item",
        price: 24,
        is_active: true,
        archived_at: null,
        updated_at: new Date().toISOString(),
      },
      {
        business_id: business.id,
        name: `${business.name} Add-on`,
        description: "Secondary verification catalog item",
        price: 8,
        is_active: true,
        archived_at: null,
        updated_at: new Date().toISOString(),
      },
    ],
    (nextPayload) =>
      supabase
        .from("products")
        .insert(nextPayload)
        .select("id,name,price")
  );

  if (productsError) {
    throw productsError;
  }

  const paidOrder = {
    business_id: business.id,
    status: "received",
    payment_status: "paid",
    customer_name: "Paid Buyer",
    customer_email: `${business.business_type}.paid@seraph.test`,
    customer_phone: "555-0401",
    fulfillment_type:
      business.business_type === "restaurant" || business.business_type === "food"
        ? "pickup"
        : "delivery",
    total_amount: 24,
    platform_fee: 1,
    metadata: { source: "verification_seed" },
  };
  const draftOrder = {
    business_id: business.id,
    status: "received",
    payment_status: "unpaid",
    customer_name: "Draft Buyer",
    customer_email: `${business.business_type}.draft@seraph.test`,
    customer_phone: "555-0402",
    fulfillment_type:
      business.business_type === "restaurant" || business.business_type === "food"
        ? "pickup"
        : "delivery",
    total_amount: 8,
    metadata: { source: "verification_seed" },
  };

  const { data: orders, error: ordersError } = await runSchemaTolerantMutation(
    "orders",
    [paidOrder, draftOrder],
    (nextPayload) =>
      supabase
        .from("orders")
        .insert(nextPayload)
        .select("id")
  );

  if (ordersError) {
    throw ordersError;
  }

  const orderItems = [];
  if (orders?.[0]?.id && products?.[0]) {
    orderItems.push({
      order_id: orders[0].id,
      name: products[0].name,
      price: products[0].price,
      quantity: 1,
    });
  }
  if (orders?.[1]?.id && products?.[1]) {
    orderItems.push({
      order_id: orders[1].id,
      name: products[1].name,
      price: products[1].price,
      quantity: 1,
    });
  }

  if (orderItems.length > 0) {
    const { error: orderItemsError } = await runSchemaTolerantMutation(
      "order_items",
      orderItems,
      (nextPayload) => supabase.from("order_items").insert(nextPayload)
    );
    if (orderItemsError) {
      throw orderItemsError;
    }
  }

  return {
    products: products || [],
  };
}

async function safeDelete(queryFactory, label) {
  const { error } = await queryFactory();
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

async function resetData(supabase) {
  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("id")
    .ilike("slug", `${VERIFY_PREFIX}%`);

  if (businessesError) {
    throw businessesError;
  }

  const businessIds = (businesses || []).map((business) => business.id);
  if (businessIds.length === 0) {
    await deleteSeedUsers(supabase);
    return { deletedBusinessCount: 0 };
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .in("business_id", businessIds);

  if (ordersError) {
    throw ordersError;
  }

  const orderIds = (orders || []).map((order) => order.id);

  const deletions = [
    () => supabase.from("lead_events").delete().in("business_id", businessIds),
    () => supabase.from("legal_acceptances").delete().in("business_id", businessIds),
    () => supabase.from("service_images").delete().in("business_id", businessIds),
    () => supabase.from("pricing_rules").delete().in("business_id", businessIds),
    () => supabase.from("slot_pricing").delete().in("business_id", businessIds),
    () => supabase.from("bookings").delete().in("business_id", businessIds),
    () => supabase.from("checkout_intents").delete().in("business_id", businessIds),
    () => supabase.from("rental_availability_blocks").delete().in("business_id", businessIds),
    () => supabase.from("rental_reservations").delete().in("business_id", businessIds),
    () => supabase.from("property_content").delete().in("business_id", businessIds),
    () => supabase.from("property_images").delete().in("business_id", businessIds),
    () => supabase.from("property").delete().in("business_id", businessIds),
    () => supabase.from("menu_item_option_groups").delete().in("business_id", businessIds),
    () => supabase.from("menu_options").delete().in("business_id", businessIds),
    () => supabase.from("menu_option_groups").delete().in("business_id", businessIds),
    () => supabase.from("menu_items").delete().in("business_id", businessIds),
    () => supabase.from("menu_categories").delete().in("business_id", businessIds),
    () => supabase.from("products").delete().in("business_id", businessIds),
    () => supabase.from("services").delete().in("business_id", businessIds),
    () => supabase.from("availability").delete().in("business_id", businessIds),
  ];

  for (const [index, deletion] of deletions.entries()) {
    await safeDelete(deletion, `reset-step-${index}`);
  }

  if (orderIds.length > 0) {
    await safeDelete(
      () => supabase.from("order_items").delete().in("order_id", orderIds),
      "reset-order-items"
    );
  }

  await safeDelete(() => supabase.from("orders").delete().in("business_id", businessIds), "reset-orders");
  await safeDelete(() => supabase.from("businesses").delete().in("id", businessIds), "reset-businesses");
  await deleteSeedUsers(supabase);

  return { deletedBusinessCount: businessIds.length };
}

async function seedAll(supabase) {
  await assertBusinessModeSchemaReady(supabase);
  await resetData(supabase);
  const seeded = {};

  for (const fixture of FIXTURES) {
    const owner = await ensureOwnerUser(supabase, fixture);
    await maybeUpsertProfile(supabase, owner, fixture);
    const business = await seedBusinessBase(supabase, fixture, owner);
    await seedLegalAcceptances(supabase, owner.id, business);

    let details = {};
    if (fixture.businessType === "service") {
      details = await seedServiceFixture(supabase, business);
    } else if (fixture.businessType === "rental" || fixture.businessType === "property") {
      details = await seedRentalFixture(supabase, business, fixture.name);
    } else {
      details = await seedCatalogFixture(supabase, business);
    }

    seeded[fixture.key] = {
      fixture,
      ownerEmail: fixture.ownerEmail,
      ownerPassword: DEFAULT_PASSWORD,
      business,
      ...details,
    };
  }

  return seeded;
}

class CookieSession {
  constructor() {
    this.cookies = new Map();
  }

  apply(response) {
    const setCookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

    for (const header of setCookies) {
      const [pair] = String(header || "").split(";");
      const index = pair.indexOf("=");
      if (index <= 0) {
        continue;
      }

      const key = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      this.cookies.set(key, value);
    }
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}

async function fetchWithSession(url, options = {}, session = null) {
  const headers = new Headers(options.headers || {});
  if (session?.header()) {
    headers.set("cookie", session.header());
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: "manual",
  });

  if (session) {
    session.apply(response);
  }

  return response;
}

async function expectOk(url, session, label) {
  const response = await fetchWithSession(`${BASE_URL}${url}`, {}, session);
  const body = await response.text();
  if (response.status >= 400) {
    throw new Error(`${label} failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return body;
}

async function postJson(url, body, session) {
  const response = await fetchWithSession(
    `${BASE_URL}${url}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    session
  );

  const text = await response.text();
  const data = parseJsonSafe(text);
  if (response.status >= 400) {
    throw new Error(`${url} failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return data;
}

async function expectPostJsonRejected(url, body, expectedCode, label, session = null) {
  const response = await fetchWithSession(
    `${BASE_URL}${url}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    session
  );
  const text = await response.text();
  const data = parseJsonSafe(text);

  assert(
    response.status >= 400,
    `${label} unexpectedly succeeded with status ${response.status}.`
  );
  assert(
    data?.code === expectedCode,
    `${label} returned ${data?.code || "no code"} instead of ${expectedCode}: ${text.slice(0, 200)}`
  );
  return data;
}

async function waitForServer(serverProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Local server exited early with code ${serverProcess.exitCode}.`);
    }

    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Timed out waiting for the local verification server.");
}

function startServer() {
  const env = {
    ...process.env,
    PORT: String(DEFAULT_PORT),
    SERAPH_NON_LIVE_VERIFY: "1",
    SERAPH_VERIFICATION_MODE: "1",
  };

  const child = spawn(
    "cmd",
    ["/c", "npm", "run", "start", "--", "--hostname", "127.0.0.1", "--port", String(DEFAULT_PORT)],
    {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdout.on("data", (chunk) => process.stdout.write(`[verify:start] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[verify:start] ${chunk}`));
  return child;
}

function stopServer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }

  child.kill("SIGTERM");
}

async function countRows(supabase, table, filters) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return Number(count || 0);
}

function extractTimes(source) {
  const match = source.match(/function formatCustomerTime[\s\S]*?hour:\s*"numeric"[\s\S]*?minute:\s*"2-digit"/);
  return Boolean(match);
}

function hasThirtyMinuteIntervals(source) {
  return (
    source.includes("intervalMinutes = 30") &&
    source.includes("? intervalMinutes") &&
    source.includes(": 30")
  );
}

function auditBookingClientSource() {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app/book/[slug]/BookingClient.tsx"),
    "utf8"
  );
  const orderSource = fs.readFileSync(
    path.join(process.cwd(), "app/order/[slug]/OrderClient.tsx"),
    "utf8"
  );
  const shopSource = fs.readFileSync(
    path.join(process.cwd(), "app/shop/[slug]/ShopClient.tsx"),
    "utf8"
  );
  const checkoutSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/checkout/create/route.ts"),
    "utf8"
  );

  assert(source.includes("<select"), "BookingClient no longer renders a time dropdown.");
  assert(source.includes('setSelectedSlotKey(event.target.value)'), "Time dropdown handler changed unexpectedly.");
  assert(source.includes("Starting secure checkout..."), "Pay button loading state is missing.");
  assert(source.includes('window.location.href = data.url;'), "Checkout redirect path is missing.");
  assert(source.includes("onClick={() => void handleBooking()}"), "Pay button no longer owns checkout.");
  assert(extractTimes(source), "12-hour booking time formatter is missing.");
  assert(source.includes("serviceModes.remote ?"), "BookingClient no longer gates remote mode rendering.");
  assert(source.includes("serviceModes.onsite ?"), "BookingClient no longer gates onsite mode rendering.");
  assert(orderSource.includes("pickupEnabled ?"), "OrderClient no longer gates pickup rendering.");
  assert(orderSource.includes("deliveryEnabled ?"), "OrderClient no longer gates delivery rendering.");
  assert(shopSource.includes("pickupEnabled ?"), "ShopClient no longer gates pickup rendering.");
  assert(shopSource.includes("deliveryEnabled ?"), "ShopClient no longer gates delivery rendering.");
  assert(
    checkoutSource.includes("CHECKOUT_PICKUP_DISABLED") &&
      checkoutSource.includes("CHECKOUT_DELIVERY_DISABLED") &&
      checkoutSource.includes("CHECKOUT_ONSITE_DISABLED") &&
      checkoutSource.includes("CHECKOUT_REMOTE_DISABLED"),
    "Shared checkout route no longer rejects disabled public modes."
  );

  const slotSource = fs.readFileSync(
    path.join(process.cwd(), "lib/availability/getSlots.ts"),
    "utf8"
  );
  assert(hasThirtyMinuteIntervals(slotSource), "30-minute interval generation is missing.");

  return {
    dropdownSourceAudit: true,
    payButtonSourceAudit: true,
    timeFormatSourceAudit: true,
    intervalSourceAudit: true,
    modeRenderSourceAudit: true,
    modeBackendSourceAudit: true,
  };
}

function getServicePayload(seed, slot) {
  return {
    intentType: "booking",
    businessId: seed.business.id,
    businessType: seed.business.business_type,
    serviceId: seed.services[0].id,
    customer: {
      name: REQUEST_NAME,
      email: REQUEST_EMAIL,
      phone: REQUEST_PHONE,
    },
    serviceMode: "remote",
    slot: {
      date: slot.date,
      startTime: slot.start,
      endTime: slot.end,
    },
  };
}

function getRentalPayload(seed, stay) {
  return {
    intentType: "booking",
    businessId: seed.business.id,
    businessType: seed.business.business_type,
    propertyId: seed.property.id,
    customer: {
      name: REQUEST_NAME,
      email: REQUEST_EMAIL,
      phone: REQUEST_PHONE,
    },
    slot: {
      date: stay.startDate,
      endDate: stay.endDate,
    },
  };
}

function getOrderPayload(seed) {
  return {
    intentType: "order",
    businessId: seed.business.id,
    businessType: seed.business.business_type,
    fulfillmentType:
      seed.business.business_type === "restaurant" || seed.business.business_type === "food"
        ? "pickup"
        : "delivery",
    customer: {
      name: REQUEST_NAME,
      email: REQUEST_EMAIL,
      phone: REQUEST_PHONE,
    },
    address: {
      line1: "123 Verify St",
      city: "Dallas",
      state: "TX",
      postalCode: "75001",
    },
    orderItems: [
      {
        id: seed.products[0].id,
        name: seed.products[0].name,
        price: seed.products[0].price,
        quantity: 1,
      },
    ],
  };
}

async function setBusinessModePreferences(supabase, businessId, preferences) {
  const { error, payload } = await runSchemaTolerantMutation(
    "businesses",
    preferences,
    (nextPayload) =>
      supabase
        .from("businesses")
        .update(nextPayload)
        .eq("id", businessId)
        .select("id,pickup_enabled,delivery_enabled,onsite_enabled,remote_enabled")
        .maybeSingle()
  );

  if (error) {
    throw error;
  }

  const strippedKeys = Object.keys(preferences).filter((key) => !(key in payload));
  assert(
    strippedKeys.length === 0,
    `Mode preference columns missing from verification schema: ${strippedKeys.join(", ")}`
  );
}

function assertModeLabelVisible(html, label, message) {
  assert(html.includes(label), message);
}

function assertModeLabelHidden(html, label, message) {
  assert(!html.includes(label), message);
}

async function verifyServiceModeToggles(supabase, seed, results) {
  await setBusinessModePreferences(supabase, seed.business.id, {
    onsite_enabled: true,
    remote_enabled: false,
  });
  let publicHtml = await expectOk(seed.fixture.publicPath, null, "service-public-remote-disabled");
  assertModeLabelVisible(publicHtml, "On-site", "On-site mode was hidden when enabled.");
  assertModeLabelHidden(publicHtml, "Remote", "Remote mode rendered while disabled.");
  await expectPostJsonRejected(
    "/api/checkout/create",
    {
      ...getServicePayload(seed, {
        date: formatDate(addDays(new Date(), 7)),
        start: "09:00",
        end: "09:30",
      }),
      serviceMode: "remote",
      verificationMode: "draft",
    },
    "CHECKOUT_REMOTE_DISABLED",
    "disabled remote checkout"
  );

  await setBusinessModePreferences(supabase, seed.business.id, {
    onsite_enabled: false,
    remote_enabled: true,
  });
  publicHtml = await expectOk(seed.fixture.publicPath, null, "service-public-onsite-disabled");
  assertModeLabelVisible(publicHtml, "Remote", "Remote mode was hidden when enabled.");
  assertModeLabelHidden(publicHtml, "On-site", "On-site mode rendered while disabled.");
  await expectPostJsonRejected(
    "/api/checkout/create",
    {
      ...getServicePayload(seed, {
        date: formatDate(addDays(new Date(), 8)),
        start: "09:00",
        end: "09:30",
      }),
      serviceMode: "onsite",
      verificationMode: "draft",
    },
    "CHECKOUT_ONSITE_DISABLED",
    "disabled onsite checkout"
  );

  await setBusinessModePreferences(supabase, seed.business.id, {
    onsite_enabled: true,
    remote_enabled: true,
  });
  results.exercised.push("service public mode toggle rendering");
  results.exercised.push("service disabled mode backend rejection");
}

async function verifyOrderModeToggles(supabase, seed, results) {
  await setBusinessModePreferences(supabase, seed.business.id, {
    pickup_enabled: true,
    delivery_enabled: false,
  });
  let publicHtml = await expectOk(seed.fixture.publicPath, null, `${seed.fixture.key}-public-delivery-disabled`);
  assertModeLabelVisible(publicHtml, "Pickup", `${seed.fixture.key} pickup mode was hidden when enabled.`);
  assertModeLabelHidden(publicHtml, "Delivery", `${seed.fixture.key} delivery mode rendered while disabled.`);
  await expectPostJsonRejected(
    "/api/checkout/create",
    {
      ...getOrderPayload(seed),
      fulfillmentType: "delivery",
      verificationMode: "draft",
    },
    "CHECKOUT_DELIVERY_DISABLED",
    `${seed.fixture.key} disabled delivery checkout`
  );

  await setBusinessModePreferences(supabase, seed.business.id, {
    pickup_enabled: false,
    delivery_enabled: true,
  });
  publicHtml = await expectOk(seed.fixture.publicPath, null, `${seed.fixture.key}-public-pickup-disabled`);
  assertModeLabelVisible(publicHtml, "Delivery", `${seed.fixture.key} delivery mode was hidden when enabled.`);
  assertModeLabelHidden(publicHtml, "Pickup", `${seed.fixture.key} pickup mode rendered while disabled.`);
  await expectPostJsonRejected(
    "/api/checkout/create",
    {
      ...getOrderPayload(seed),
      fulfillmentType: "pickup",
      verificationMode: "draft",
    },
    "CHECKOUT_PICKUP_DISABLED",
    `${seed.fixture.key} disabled pickup checkout`
  );

  await setBusinessModePreferences(supabase, seed.business.id, {
    pickup_enabled: true,
    delivery_enabled: true,
  });
  results.exercised.push(`${seed.fixture.key} public mode toggle rendering`);
  results.exercised.push(`${seed.fixture.key} disabled mode backend rejection`);
}

async function verifyRentalModeRendering(seed, results) {
  const publicHtml = await expectOk(seed.fixture.publicPath, null, `${seed.fixture.key}-public-mode-rendering`);
  assertModeLabelHidden(publicHtml, "Remote", `${seed.fixture.key} rendered irrelevant remote mode.`);
  assertModeLabelHidden(publicHtml, "Pickup", `${seed.fixture.key} rendered irrelevant pickup mode.`);
  assertModeLabelHidden(publicHtml, "Delivery", `${seed.fixture.key} rendered irrelevant delivery mode.`);
  results.exercised.push(`${seed.fixture.key} onsite-only public mode rendering`);
}

async function loginAndActivate(seed) {
  const session = new CookieSession();
  await postJson(
    "/api/admin/login",
    { email: seed.ownerEmail, password: seed.ownerPassword },
    session
  );
  await postJson("/api/set-active-business", { businessId: seed.business.id }, session);
  return session;
}

async function exerciseServiceFlow(supabase, seed, session, results) {
  await verifyServiceModeToggles(supabase, seed, results);

  const publicHtml = await expectOk(seed.fixture.publicPath, null, "service-public-page");
  assert(publicHtml.includes(seed.business.name), "Service public page did not render business name.");

  for (const adminPath of seed.fixture.adminPaths) {
    await expectOk(adminPath, session, `service-admin:${adminPath}`);
  }

  const targetDate = formatDate(addDays(new Date(), 5));
  const availabilityResponse = await fetch(
    `${BASE_URL}/api/availability?businessId=${encodeURIComponent(seed.business.id)}&serviceId=${encodeURIComponent(seed.services[0].id)}&date=${targetDate}&tz=${encodeURIComponent(TIME_ZONE)}`
  );
  const availability = await availabilityResponse.json();
  assert(availabilityResponse.ok, "Service availability route failed.");
  assert(Array.isArray(availability.slots) && availability.slots.length > 0, "Service availability returned no slots.");

  const [firstSlot, secondSlot, thirdSlot] = availability.slots;
  assert(firstSlot.start === "09:00", "Service slots did not start at the expected opening time.");
  assert(secondSlot.start === "09:30", "Service slots are not using 30-minute intervals.");

  const serviceDraftPayload = getServicePayload(seed, {
    date: targetDate,
    start: thirdSlot.start,
    end: thirdSlot.end,
  });
  const beforePending = await countRows(supabase, "bookings", {
    business_id: seed.business.id,
    guest_email: REQUEST_EMAIL,
  });
  const draftOne = await postJson("/api/checkout/create", { ...serviceDraftPayload, verificationMode: "draft" });
  const draftTwo = await postJson("/api/checkout/create", { ...serviceDraftPayload, verificationMode: "draft" });
  const afterPending = await countRows(supabase, "bookings", {
    business_id: seed.business.id,
    guest_email: REQUEST_EMAIL,
  });

  assert(draftOne.sessionId === draftTwo.sessionId, "Service draft checkout did not reuse the canonical session.");
  assert(afterPending === beforePending + 1, "Service draft checkout created duplicate local bookings.");

  const paidPayload = getServicePayload(seed, {
    date: targetDate,
    start: firstSlot.start,
    end: firstSlot.end,
  });
  await postJson("/api/checkout/create", { ...paidPayload, verificationMode: "paid" });
  const blockedCheckResponse = await fetch(
    `${BASE_URL}/api/availability?businessId=${encodeURIComponent(seed.business.id)}&serviceId=${encodeURIComponent(seed.services[0].id)}&date=${targetDate}&tz=${encodeURIComponent(TIME_ZONE)}`
  );
  const blockedCheck = await blockedCheckResponse.json();
  assert(
    !(blockedCheck.slots || []).some((slot) => slot.start === firstSlot.start),
    "Paid service booking did not block the selected time slot."
  );

  results.exercised.push("service public page");
  results.exercised.push("service admin pages");
  results.exercised.push("service availability API");
  results.exercised.push("service draft checkout dedupe");
  results.exercised.push("service paid verification checkout");
}

async function exerciseRentalFlow(supabase, seed, session, results) {
  await verifyRentalModeRendering(seed, results);

  await expectOk(seed.fixture.publicPath, null, `${seed.fixture.key}-public-page`);
  for (const adminPath of seed.fixture.adminPaths) {
    await expectOk(adminPath, session, `${seed.fixture.key}-admin:${adminPath}`);
  }

  const availabilityUrl = `${BASE_URL}/api/rent/availability?businessId=${encodeURIComponent(seed.business.id)}&propertyId=${encodeURIComponent(seed.property.id)}`;
  const availabilityResponse = await fetch(availabilityUrl);
  const availability = await availabilityResponse.json();
  assert(availabilityResponse.ok, `${seed.fixture.key} availability route failed.`);
  assert(Array.isArray(availability.unavailableDates), `${seed.fixture.key} unavailable dates missing.`);

  const stay = {
    startDate: formatDate(addDays(new Date(), 16)),
    endDate: formatDate(addDays(new Date(), 18)),
  };

  const rentalDraftPayload = getRentalPayload(seed, stay);
  const beforeDraftIntents = await countRows(supabase, "checkout_intents", {
    business_id: seed.business.id,
    customer_email: REQUEST_EMAIL,
  });
  const rentalDraftOne = await postJson("/api/checkout/create", { ...rentalDraftPayload, verificationMode: "draft" });
  const rentalDraftTwo = await postJson("/api/checkout/create", { ...rentalDraftPayload, verificationMode: "draft" });
  const afterDraftIntents = await countRows(supabase, "checkout_intents", {
    business_id: seed.business.id,
    customer_email: REQUEST_EMAIL,
  });
  assert(rentalDraftOne.sessionId === rentalDraftTwo.sessionId, `${seed.fixture.key} draft checkout was not idempotent.`);
  assert(afterDraftIntents === beforeDraftIntents + 1, `${seed.fixture.key} draft checkout created duplicate intents.`);

  const paidStay = {
    startDate: formatDate(addDays(new Date(), 19)),
    endDate: formatDate(addDays(new Date(), 21)),
  };
  await postJson("/api/checkout/create", {
    ...getRentalPayload(seed, paidStay),
    verificationMode: "paid",
  });
  const postPaidResponse = await fetch(
    `${BASE_URL}/api/rent/availability?businessId=${encodeURIComponent(seed.business.id)}&propertyId=${encodeURIComponent(seed.property.id)}`
  );
  const postPaidAvailability = await postPaidResponse.json();
  assert(
    (postPaidAvailability.unavailableDates || []).includes(paidStay.startDate),
    `${seed.fixture.key} paid stay did not block availability.`
  );

  results.exercised.push(`${seed.fixture.key} public page`);
  results.exercised.push(`${seed.fixture.key} admin pages`);
  results.exercised.push(`${seed.fixture.key} availability API`);
  results.exercised.push(`${seed.fixture.key} draft checkout dedupe`);
  results.exercised.push(`${seed.fixture.key} paid verification checkout`);
}

async function exerciseOrderFlow(supabase, seed, session, results) {
  await verifyOrderModeToggles(supabase, seed, results);

  await expectOk(seed.fixture.publicPath, null, `${seed.fixture.key}-public-page`);
  for (const adminPath of seed.fixture.adminPaths) {
    await expectOk(adminPath, session, `${seed.fixture.key}-admin:${adminPath}`);
  }

  if (seed.fixture.businessType === "restaurant" || seed.fixture.businessType === "food") {
    const menuResponse = await fetch(
      `${BASE_URL}/api/menu?businessId=${encodeURIComponent(seed.business.id)}`
    );
    const menu = await menuResponse.json();
    assert(menuResponse.ok, `${seed.fixture.key} menu route failed.`);
    assert(Array.isArray(menu.items) && menu.items.length > 0, `${seed.fixture.key} menu had no normalized items.`);
    results.exercised.push(`${seed.fixture.key} menu API`);
  }

  const payload = getOrderPayload(seed);
  const beforeIntentCount = await countRows(supabase, "checkout_intents", {
    business_id: seed.business.id,
    customer_email: REQUEST_EMAIL,
  });
  const draftOne = await postJson("/api/checkout/create", { ...payload, verificationMode: "draft" });
  const draftTwo = await postJson("/api/checkout/create", { ...payload, verificationMode: "draft" });
  const afterIntentCount = await countRows(supabase, "checkout_intents", {
    business_id: seed.business.id,
    customer_email: REQUEST_EMAIL,
  });
  assert(draftOne.sessionId === draftTwo.sessionId, `${seed.fixture.key} draft order checkout was not idempotent.`);
  assert(afterIntentCount === beforeIntentCount + 1, `${seed.fixture.key} draft order checkout created duplicate intents.`);

  const beforePaidOrders = await countRows(supabase, "orders", {
    business_id: seed.business.id,
    customer_email: REQUEST_EMAIL,
  });
  await postJson("/api/checkout/create", { ...payload, verificationMode: "paid" });
  const afterPaidOrders = await countRows(supabase, "orders", {
    business_id: seed.business.id,
    customer_email: REQUEST_EMAIL,
  });
  assert(afterPaidOrders === beforePaidOrders + 1, `${seed.fixture.key} paid verification checkout failed to persist exactly one order.`);

  results.exercised.push(`${seed.fixture.key} public page`);
  results.exercised.push(`${seed.fixture.key} admin pages`);
  results.exercised.push(`${seed.fixture.key} draft checkout dedupe`);
  results.exercised.push(`${seed.fixture.key} paid verification checkout`);
}

async function runSmoke(supabase) {
  const seeded = await seedAll(supabase);
  const sourceAudit = auditBookingClientSource();
  const server = startServer();
  const results = {
    seededBusinessTypes: FIXTURES.map((fixture) => fixture.businessType),
    exercised: [],
    staticAudits: Object.keys(sourceAudit),
  };

  try {
    await waitForServer(server);
    const serviceSession = await loginAndActivate(seeded.service);
    const rentalSession = await loginAndActivate(seeded.rental);
    const propertySession = await loginAndActivate(seeded.property);
    const restaurantSession = await loginAndActivate(seeded.restaurant);
    const foodSession = await loginAndActivate(seeded.food);
    const storeSession = await loginAndActivate(seeded.store);
    const creatorSession = await loginAndActivate(seeded.creator);
    const productSession = await loginAndActivate(seeded.product);

    await exerciseServiceFlow(supabase, seeded.service, serviceSession, results);
    await exerciseRentalFlow(supabase, seeded.rental, rentalSession, results);
    await exerciseRentalFlow(supabase, seeded.property, propertySession, results);
    await exerciseOrderFlow(supabase, seeded.restaurant, restaurantSession, results);
    await exerciseOrderFlow(supabase, seeded.food, foodSession, results);
    await exerciseOrderFlow(supabase, seeded.store, storeSession, results);

    await verifyOrderModeToggles(supabase, seeded.creator, results);
    await expectOk(seeded.creator.fixture.publicPath, null, "creator-public-page");
    for (const adminPath of seeded.creator.fixture.adminPaths) {
      await expectOk(adminPath, creatorSession, `creator-admin:${adminPath}`);
    }
    await verifyOrderModeToggles(supabase, seeded.product, results);
    await expectOk(seeded.product.fixture.publicPath, null, "product-public-page");
    for (const adminPath of seeded.product.fixture.adminPaths) {
      await expectOk(adminPath, productSession, `product-admin:${adminPath}`);
    }
    results.exercised.push("creator public/admin route loads");
    results.exercised.push("product public/admin route loads");

    console.log(JSON.stringify(results, null, 2));
    return results;
  } finally {
    stopServer(server);
  }
}

async function main() {
  loadEnvLocal();
  assertNonLiveMode();
  REQUIRED_ENV_KEYS.forEach(requireEnv);

  const command = process.argv[2] || "smoke";
  const supabase = createSupabaseAdmin();

  if (command === "reset") {
    const summary = await resetData(supabase);
    console.log(JSON.stringify({ command, ...summary }, null, 2));
    return;
  }

  if (command === "seed") {
    const seeded = await seedAll(supabase);
    console.log(
      JSON.stringify(
        {
          command,
          seededBusinessTypes: Object.values(seeded).map((entry) => entry.business.business_type),
          businessSlugs: Object.values(seeded).map((entry) => entry.business.slug),
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "smoke") {
    await runSmoke(supabase);
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

main().catch((error) => {
  console.error("[verify] failed:", error);
  process.exit(1);
});
