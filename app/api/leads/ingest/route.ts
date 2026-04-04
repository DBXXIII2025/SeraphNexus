import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { matchLeadToBusiness } from "@/lib/aiMatch";
import { sendBookingEmail } from "@/lib/notify";

const supabase = createAdminClient();

export async function POST(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    const body = await req.json();
    const message = String(body?.message || "").trim();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = String(body?.email || "").trim();

    if (!message || !name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [{ data: businesses }, { data: services }] = await Promise.all([
      supabase.from("businesses").select("id, name, email"),
      supabase.from("services").select("business_id, name"),
    ]);

    const servicesByBusinessId = new Map<string, string[]>();
    for (const service of services || []) {
      const businessId = String((service as any).business_id || "");
      const list = servicesByBusinessId.get(businessId) || [];
      if ((service as any).name) {
        list.push(String((service as any).name));
      }
      servicesByBusinessId.set(businessId, list);
    }

    let matchedCount = 0;

    for (const business of businesses || []) {
      const businessId = String((business as any).id || "");
      const businessServices = servicesByBusinessId.get(businessId) || [];

      const isMatch = matchLeadToBusiness({
        message,
        services: businessServices,
      });

      if (!isMatch) {
        continue;
      }

      matchedCount += 1;

      await supabase.from("leads").insert({
        business_id: businessId,
        name,
        phone,
        email,
        service_requested: message,
      });

      if ((business as any).email) {
        await sendBookingEmail({
          to: String((business as any).email),
          subject: "New AI Matched Lead",
          message: `${name} is looking for: ${message}`,
        });
      }
    }

    if (isDev) {
      console.log("[leads/ingest] matched businesses:", matchedCount);
    }

    return NextResponse.json({ ok: true, matched: matchedCount });
  } catch (err) {
    console.error("AI LEAD ERROR:", err);

    return NextResponse.json(
      { error: "Lead ingestion failed" },
      { status: 500 }
    );
  }
}
