/**
 * /api/meetings
 * GET  → list meetings (with filters)
 * POST → create meeting (with conflict detection)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MANILA_TZ = "Asia/Manila";

/** Convert any date string to Manila local time ISO string */
function toManila(dateStr: string): string {
  return new Date(dateStr).toLocaleString("sv-SE", { timeZone: MANILA_TZ }).replace(" ", "T");
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");
    const tsm = searchParams.get("tsm");
    const manager = searchParams.get("manager");
    const from = searchParams.get("from");       // ISO date string
    const to = searchParams.get("to");           // ISO date string
    const status = searchParams.get("status");   // upcoming|past|no_show|cancelled
    const limit = parseInt(searchParams.get("limit") ?? "500");
    const offset = parseInt(searchParams.get("offset") ?? "0");

    let query = supabase
      .from("meetings")
      .select("*", { count: "exact" })
      .order("start_date", { ascending: false })
      .range(offset, offset + limit - 1);

    // Role-based filter
    if (referenceid) query = query.eq("referenceid", referenceid);
    else if (tsm) query = query.eq("tsm", tsm);
    else if (manager) query = query.eq("manager", manager);

    // Date range
    if (from) query = query.gte("start_date", from);
    if (to)   query = query.lte("start_date", to);

    // Status filter
    const now = new Date().toISOString();
    if (status === "upcoming")  query = query.gte("start_date", now).neq("is_cancelled", true);
    if (status === "past")      query = query.lt("end_date", now).neq("is_cancelled", true);
    if (status === "no_show")   query = query.eq("outcome", "No Show");
    if (status === "cancelled") query = query.eq("is_cancelled", true);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      referenceid, tsm, manager,
      type_activity, company_name, remarks,
      start_date, end_date,
      location, meeting_link, attendees,
      override_conflict = false,
    } = body;

    if (!referenceid || !start_date || !end_date || !type_activity) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: referenceid, start_date, end_date, type_activity" },
        { status: 400 }
      );
    }

    // ── Conflict detection ──────────────────────────────────────────────────
    if (!override_conflict) {
      const { data: conflicts } = await supabase
        .from("meetings")
        .select("id, start_date, end_date, type_activity, company_name")
        .eq("referenceid", referenceid)
        .neq("is_cancelled", true)
        .lt("start_date", end_date)
        .gt("end_date", start_date);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({
          success: false,
          conflict: true,
          conflicts,
          error: "Overlapping meeting exists. Use override_conflict=true (manager only) to bypass.",
        }, { status: 409 });
      }
    }

    // ── Insert — only use columns guaranteed to exist ───────────────────────
    const insertPayload: Record<string, any> = {
      referenceid, tsm, manager,
      type_activity,
      company_name: company_name ?? null,
      remarks:      remarks ?? "No remarks",
      start_date, end_date,
      // date_updated is DATE type — send YYYY-MM-DD only
      date_updated: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
    };

    // Add new columns only if they have values (will be ignored if migration not run)
    if (location)     insertPayload.location     = location;
    if (meeting_link) insertPayload.meeting_link = meeting_link;
    if (attendees)    insertPayload.attendees     = attendees;

    // Try inserting with new columns, fall back to base columns if schema not migrated
    let data: any;
    try {
      const result = await supabase
        .from("meetings")
        .insert([{ ...insertPayload, status: "Scheduled", is_cancelled: false }])
        .select()
        .single();
      if (result.error) throw result.error;
      data = result.data;
    } catch (insertErr: any) {
      if (insertErr.message?.includes("column") || insertErr.message?.includes("does not exist")) {
        // Fallback: insert without new columns
        const { data: fallback, error: fallbackErr } = await supabase
          .from("meetings")
          .insert([insertPayload])
          .select()
          .single();
        if (fallbackErr) throw fallbackErr;
        data = fallback;
      } else {
        throw insertErr;
      }
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
