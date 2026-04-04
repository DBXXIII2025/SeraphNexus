import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  const formData = await req.formData();

  const name = formData.get("name");
  const price = formData.get("price");
  const duration = formData.get("duration");
  const business_id = formData.get("business_id");

  const { error } = await supabase.from("services").insert({
    name,
    price: Number(price),
    duration: duration ? Number(duration) : 30,
    business_id,
  });

  if (error) {
    console.error("CREATE SERVICE ERROR:", error);
  }

  return NextResponse.redirect(new URL("/admin/services", req.url));
}
