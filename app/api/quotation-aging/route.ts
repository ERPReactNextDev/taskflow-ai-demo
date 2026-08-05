import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── helpers ───────────────────────────────────────────────────────────────────

function computeAgingStatus(
  dbStatus: string,
  daysAging: number,
  agingDays: number
): "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "FOLLOWED_UP" | "CONVERTED" | "DISMISSED" {
  if (dbStatus === "CONVERTED_TO_SO") return "CONVERTED";
  if (dbStatus === "DISMISSED")       return "DISMISSED";
  if (dbStatus === "FOLLOWED_UP")     return "FOLLOWED_UP";
  const remaining = agingDays - daysAging;
  if (daysAging > agingDays)          return "OVERDUE";
  if (remaining <= 2)                 return "DUE_SOON";
  return "ON_TRACK";
}

function enrichRow(row: any) {
  const now      = Date.now();
  const baseDate = new Date(row.tsm_approval_date).getTime();
  const daysAging    = Math.max(0, Math.floor((now - baseDate) / 86400000));
  const agingDays    = row.aging_days ?? 7;
  const daysRemaining = agingDays - daysAging;
  const aging_status  = computeAgingStatus(row.status, daysAging, agingDays);
  return { ...row, days_aging: daysAging, days_remaining: daysRemaining, aging_status };
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const status      = url.searchParams.get("status");
    const search      = url.searchParams.get("search");

    if (!referenceid)
      return NextResponse.json({ success: false, error: "Missing referenceid." }, { status: 400 });

    let query = supabase
      .from("quotation_aging")
      .select("*")
      .eq("tsm", referenceid)
      .order("tsm_approval_date", { ascending: true });

    if (search) {
      query = query.or(
        `quotation_number.ilike.%${search}%,company_name.ilike.%${search}%,agent_name.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    let rows = (data ?? []).map(enrichRow);

    // Sort: OVERDUE first
    const ORDER = { OVERDUE: 0, DUE_SOON: 1, ON_TRACK: 2, FOLLOWED_UP: 3, CONVERTED: 4, DISMISSED: 5 };
    rows.sort((a: any, b: any) => (ORDER[a.aging_status as keyof typeof ORDER] ?? 9) - (ORDER[b.aging_status as keyof typeof ORDER] ?? 9));

    // Filter by status AFTER computing
    if (status && status !== "ALL") {
      rows = rows.filter((r: any) => r.aging_status === status);
    }

    const summary = {
      total:          data?.length ?? 0,
      overdue_count:  rows.filter((r: any) => r.aging_status === "OVERDUE").length,
      due_soon_count: rows.filter((r: any) => r.aging_status === "DUE_SOON").length,
      on_track_count: rows.filter((r: any) => r.aging_status === "ON_TRACK").length,
      converted_count:rows.filter((r: any) => r.aging_status === "CONVERTED").length,
      total_amount:   (data ?? []).reduce((s: number, r: any) => s + (Number(r.quotation_amount) || 0), 0),
      overdue_amount: rows.filter((r: any) => r.aging_status === "OVERDUE")
                         .reduce((s: number, r: any) => s + (Number(r.quotation_amount) || 0), 0),
    };

    return NextResponse.json({ success: true, data: rows, summary }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── POST (upsert) ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      activity_id, quotation_number, referenceid, tsm, manager,
      company_name, quotation_amount, tsm_approval_date, agent_name, tsm_name,
      aging_days = 7, reminder_note, follow_up_date, created_by,
    } = body;

    if (!activity_id || !referenceid || !tsm)
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });

    // Fall back to current timestamp if no approval date recorded
    const approvalDate = tsm_approval_date || new Date().toISOString();

    const { data, error } = await supabase
      .from("quotation_aging")
      .upsert({
        activity_id, quotation_number, referenceid, tsm, manager,
        company_name, quotation_amount: Number(quotation_amount) || 0,
        tsm_approval_date: approvalDate, agent_name, tsm_name,
        aging_days: Number(aging_days) || 7,
        reminder_note: reminder_note || null,
        follow_up_date: follow_up_date || null,
        status: "PENDING",
        created_by,
        updated_at: new Date().toISOString(),
      }, { onConflict: "activity_id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id)
      return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });

    const { data, error } = await supabase
      .from("quotation_aging")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get("id");
    if (!id)
      return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });

    const { error } = await supabase.from("quotation_aging").delete().eq("id", Number(id));
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
