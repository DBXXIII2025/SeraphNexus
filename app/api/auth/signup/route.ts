import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { stripe } from "@/lib/stripe";
import { ensureUniqueSlug, slugify } from "@/lib/slug";

const supabase = createAdminClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, business_name } = body || {};

    if (!email || !password || !business_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: userRes, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError || !userRes?.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create user" },
        { status: 400 }
      );
    }

    const userId = userRes.user.id;

    const account = await stripe.accounts.create({
      type: "standard",
      email,
    });

    const baseSlug = slugify(String(business_name));
    if (!baseSlug) {
      return NextResponse.json(
        { error: "Invalid business name" },
        { status: 400 }
      );
    }

    const businessesTable = supabase.from("businesses") as any;
    const slug = await ensureUniqueSlug(businessesTable, baseSlug);

    const { error: businessError } = await businessesTable.insert({
      id: randomUUID(),
      owner_id: userId,
      name: business_name,
      slug,
      stripe_account_id: account.id,
      plan: "inactive",
    });

    if (businessError) {
      return NextResponse.json(
        { error: businessError.message },
        { status: 400 }
      );
    }

    const baseUrl = getAppUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${baseUrl}/signup`,
      return_url: `${baseUrl}/admin/dashboard`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: accountLink.url,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
