import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const OPEN_HOUR = 9;
const CLOSE_HOUR = 17;
const INTERVAL = 30;

function getZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUTC - date.getTime();
}

function makeZonedDate(dateStr, hour, minute, timeZone) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  );
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function formatInTimeZone(dateInput, timeZone, options = {}) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...options,
  }).format(new Date(dateInput));
}

function calcTotalDuration(serviceIds, services) {
  return serviceIds.reduce((total, id) => {
    const service = services.find((s) => s.id === id);
    return total + (service?.duration || 30);
  }, 0);
}

function generateSlots({
  dateStr,
  serviceIds,
  services,
  bookings,
  businessTimeZone,
}) {
  const totalDuration = calcTotalDuration(serviceIds, services) || 30;
  const slots = [];

  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour++) {
    for (let min = 0; min < 60; min += INTERVAL) {
      const slotStart = makeZonedDate(
        dateStr,
        hour,
        min,
        businessTimeZone
      );
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + totalDuration);

      const startParts = getZonedParts(slotStart, businessTimeZone);
      const endParts = getZonedParts(slotEnd, businessTimeZone);
      if (
        startParts.year !== endParts.year ||
        startParts.month !== endParts.month ||
        startParts.day !== endParts.day ||
        endParts.hour > CLOSE_HOUR ||
        (endParts.hour === CLOSE_HOUR && endParts.minute > 0)
      ) {
        continue;
      }

      const overlaps = bookings.some((b) => {
        if (!b.booking_time) return false;
        const existingStart = new Date(b.booking_time);
        const existingEnd = new Date(existingStart);
        existingEnd.setMinutes(
          existingEnd.getMinutes() + (b.duration_minutes || 30)
        );
        return slotStart < existingEnd && slotEnd > existingStart;
      });

      if (!overlaps) {
        slots.push(slotStart.toISOString());
      }
    }
  }

  return slots;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: node scripts/test-booking-slots.mjs <business-slug>");
    process.exit(1);
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (businessError || !business) {
    console.error("Business not found or error:", businessError);
    const { data: recent } = await supabase
      .from("businesses")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (recent && recent.length > 0) {
      console.error("Recent businesses:");
      for (const b of recent) {
        console.error("-", {
          id: b.id,
          name: b.name,
          slug: b.slug,
          created_at: b.created_at,
        });
      }
    }
    process.exit(1);
  }

  const businessTimeZone =
    business.timezone || business.time_zone || "UTC";

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, name, duration")
    .eq("business_id", business.id);

  if (servicesError) {
    console.error("Service fetch error:", servicesError);
    process.exit(1);
  }

  if (!services || services.length === 0) {
    console.error("No services found for business.");
    process.exit(1);
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("booking_time, duration_minutes, status")
    .eq("business_id", business.id)
    .neq("status", "cancelled");

  if (bookingsError) {
    console.error("Bookings fetch error:", bookingsError);
    process.exit(1);
  }

  const dateStr = toDateStr(addDays(new Date(), 1));
  const serviceIds = services.slice(0, 1).map((s) => s.id);

  const slots = generateSlots({
    dateStr,
    serviceIds,
    services,
    bookings: bookings || [],
    businessTimeZone,
  });

  console.log("Business:", business.name);
  console.log("Business timezone:", businessTimeZone);
  console.log("Date (business):", dateStr);
  console.log("Service IDs:", serviceIds.join(", "));
  console.log("Available slots:", slots.length);

  const sample = slots.slice(0, 5).map((iso) => ({
    utc: iso,
    business: formatInTimeZone(iso, businessTimeZone, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    local: formatInTimeZone(iso, Intl.DateTimeFormat().resolvedOptions().timeZone, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  }));

  for (const s of sample) {
    console.log("-", s);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
