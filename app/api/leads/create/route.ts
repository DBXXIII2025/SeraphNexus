import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { matchLeadToBusiness } from "@/lib/aiMatch";
import { scoreLead } from "@/lib/leadScoring";
import { sendBookingEmail } from "@/lib/notify";

const supabase = createAdminClient();

export async function POST(req: Request) {
  const isDev = process.env.NODE_ENV !== "production";

  try {
    const formData = await req.formData();

    const business_id = String(formData.get("business_id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const service_requested = String(
      formData.get("service_requested") || ""
    ).trim();

    if (!business_id || !name) {
      if (isDev) {
        console.log("[leads/create] failed validation:", {
          business_id,
          hasName: Boolean(name),
        });
      }

      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, email, name")
      .eq("id", business_id)
      .maybeSingle();

    if (!business) {
      if (isDev) {
        console.log("[leads/create] business not found:", business_id);
      }

      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const { data: servicesData } = await supabase
      .from("services")
      .select("name")
      .eq("business_id", business_id);

    const services = (servicesData || [])
      .map((service: any) => service.name)
      .filter(Boolean);

    const isMatch = matchLeadToBusiness({
      message: service_requested,
      services,
    });

    if (!isMatch && service_requested) {
      if (isDev) {
        console.log("[leads/create] lead rejected as not relevant:", {
          business_id,
          service_requested,
        });
      }

      return NextResponse.json({
        ok: false,
        message: "Not relevant to this business",
      });
    }

    const { score, temperature } = scoreLead({
      message: service_requested,
      phone,
      email,
    });

    const { error } = await supabase.from("leads").insert({
      business_id,
      name,
      phone,
      email,
      service_requested,
      score,
      temperature,
    });

    if (error) {
      if (isDev) {
        console.log("[leads/create] insert failed:", error.message);
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (temperature === "hot" && business.email) {
      await sendBookingEmail({
        to: business.email,
        subject: "HOT LEAD",
        message: `${name} is ready: ${service_requested}`,
      });
    } else if (temperature === "hot" && isDev) {
      console.log("[leads/create] hot lead saved without notification email:", {
        business_id,
      });
    }

    if (isDev) {
      console.log("[leads/create] lead saved:", {
        business_id,
        temperature,
        score,
      });
    }

    return NextResponse.redirect(new URL("/admin/leads", req.url));
  } catch (err) {
    console.error("LEAD ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
