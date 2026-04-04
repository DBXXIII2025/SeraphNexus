import { NextResponse } from "next/server";
import { getActiveBusiness } from "@/lib/getActiveBusiness";
import { LEAD_STATUS_VALUES, type LeadStatus } from "@/lib/leads";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type LeadUpdatePayload = {
  id?: string;
  status?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
};

const ALLOWED_STATUSES = new Set<string>(LEAD_STATUS_VALUES);

function normalizeNullableString(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseContactDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeBusiness = await getActiveBusiness();

    if (!activeBusiness?.id) {
      return NextResponse.json({ error: "No active business" }, { status: 400 });
    }

    const payload = (await req.json().catch(() => ({}))) as LeadUpdatePayload;
    const id = normalizeNullableString(payload.id);
    const status = normalizeNullableString(payload.status);
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : null;
    const requestedContactAt = normalizeNullableString(payload.last_contacted_at);

    if (!id) {
      return NextResponse.json({ error: "Missing lead event id" }, { status: 400 });
    }

    if (
      status !== null &&
      !ALLOWED_STATUSES.has(status)
    ) {
      return NextResponse.json({ error: "Invalid lead status" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: leadEvent, error: leadError } = await supabaseAdmin
      .from("lead_events")
      .select("id, business_id, status, notes, last_contacted_at")
      .eq("id", id)
      .maybeSingle();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }

    if (!leadEvent?.id || leadEvent.business_id !== activeBusiness.id) {
      return NextResponse.json({ error: "Lead event not found" }, { status: 404 });
    }

    const updatePayload: {
      status?: LeadStatus | null;
      notes?: string | null;
      last_contacted_at?: string | null;
    } = {};

    if (status !== null) {
      updatePayload.status = status as LeadStatus;
    }

    if (typeof payload.notes === "string") {
      updatePayload.notes = notes;
    }

    if (requestedContactAt !== null) {
      const parsed = parseContactDate(requestedContactAt);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid contact date" }, { status: 400 });
      }

      updatePayload.last_contacted_at = parsed;
    } else if (status === "contacted" && !leadEvent.last_contacted_at) {
      updatePayload.last_contacted_at = new Date().toISOString();
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { data: updatedLead, error: updateError } = await supabaseAdmin
      .from("lead_events")
      .update(updatePayload)
      .eq("id", id)
      .eq("business_id", activeBusiness.id)
      .select("id, status, notes, last_contacted_at")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: updatedLead,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update lead event";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
