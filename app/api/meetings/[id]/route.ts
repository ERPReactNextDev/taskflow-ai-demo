/**
 * /api/meetings/[id]
 * GET    → single meeting
 * PATCH  → update (reschedule, outcome, cancel, etc.)
 * DELETE → soft delete (sets is_cancelled=true) or hard delete
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const OUTCOME_SCORE_DELTA: Record<string, number> = {
  "Quotation Requested": +15,
  "Proposal Sent":       +10,
  "Interested":          +8,
  "No Decision":          0,
  "Closed Won":          +40,
  "Not Interested":      -20,
  "Rescheduled":          -5,
  "Referred Lead":       +10,
  "No Show":              0,
};

/** date_updated column is type DATE — send YYYY-MM-DD only */
function todayDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // "2026-08-07"
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id === "undefined") {
      return NextResponse.json({ success: false, error: "Invalid meeting ID" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id === "undefined") {
      return NextResponse.json({ success: false, error: "Invalid meeting ID" }, { status: 400 });
    }

    const body = await _req.json();
    const { outcome, outcome_notes, ...rest } = body;

    const updatePayload: Record<string, any> = {
      date_updated: todayDate(),
    };

    const allowedFields = [
      "start_date", "end_date", "remarks", "type_activity", "company_name",
      "status", "location", "meeting_link", "attendees",
      "follow_up_date", "follow_up_notes", "is_cancelled", "cancellation_reason",
    ];
    for (const field of allowedFields) {
      if (rest[field] !== undefined) updatePayload[field] = rest[field];
    }

    if (outcome !== undefined) {
      updatePayload.outcome                = outcome;
      updatePayload.outcome_notes          = outcome_notes ?? null;
      updatePayload.conversion_score_delta = OUTCOME_SCORE_DELTA[outcome] ?? 0;
      updatePayload.status                 = "Completed";

      try {
        const { data: mtg } = await supabase
          .from("meetings").select("referenceid").eq("id", id).single();

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "";
        if (mtg?.referenceid && appUrl) {
          fetch(`${appUrl}/api/lead-conversion/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ referenceid: mtg.referenceid }),
          }).catch(() => {});
        }
      } catch { /* non-fatal */ }
    }

    const { data, error } = await supabase
      .from("meetings")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("[PATCH /api/meetings/[id]]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id === "undefined") {
      return NextResponse.json({ success: false, error: "Invalid meeting ID" }, { status: 400 });
    }

    const body = await _req.json().catch(() => ({}));
    const { cancellation_reason, hard_delete = false } = body;

    if (hard_delete) {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("meetings")
        .update({
          is_cancelled:        true,
          cancellation_reason: cancellation_reason ?? "Cancelled",
          status:              "Cancelled",
          date_updated:        todayDate(),
        })
        .eq("id", id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/meetings/[id]]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
