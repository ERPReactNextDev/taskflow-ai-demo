/**
 * GET /api/meetings/report?referenceid=&tsm=&manager=&from=&to=&type=
 * Returns detailed meeting data for the Sales Reports module.
 * type = funnel | cycle_time | source | all (default: all)
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MANILA = "Asia/Manila";
function diffDays(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");
    const tsm         = searchParams.get("tsm");
    const manager     = searchParams.get("manager");
    const from        = searchParams.get("from");
    const to          = searchParams.get("to");
    const reportType  = searchParams.get("type") ?? "all";

    let query = supabase
      .from("meetings")
      .select("*")
      .order("start_date", { ascending: false });

    if (referenceid) query = query.eq("referenceid", referenceid);
    else if (tsm)    query = query.eq("tsm", tsm);
    else if (manager) query = query.eq("manager", manager);

    if (from) query = query.gte("start_date", from);
    if (to)   query = query.lte("start_date", to);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];

    // ── Report 1: Funnel Conversion ─────────────────────────────────────────
    const funnel = {
      total:           rows.length,
      scheduled:       rows.filter(m => m.status === "Scheduled" || !m.status).length,
      completed:       rows.filter(m => m.status === "Completed").length,
      no_show:         rows.filter(m => m.outcome === "No Show").length,
      cancelled:       rows.filter(m => m.is_cancelled).length,
      quote_requested: rows.filter(m => m.outcome === "Quotation Requested").length,
      closed_won:      rows.filter(m => m.outcome === "Closed Won").length,
      completion_rate: rows.length > 0
        ? Math.round(rows.filter(m => m.status === "Completed").length / rows.length * 100)
        : 0,
    };

    // ── Report 2: Cycle Time (avg days from meeting to outcome) ─────────────
    const withOutcome = rows.filter(m => m.outcome && m.start_date && m.date_updated);
    const avgCycleDays = withOutcome.length > 0
      ? withOutcome.reduce((sum, m) => sum + diffDays(m.start_date, m.date_updated), 0) / withOutcome.length
      : 0;

    const cycleTime = {
      avg_days_to_outcome: Math.round(avgCycleDays * 10) / 10,
      sample_size: withOutcome.length,
    };

    // ── Report 3: Outcome distribution ─────────────────────────────────────
    const outcomeDist: Record<string, number> = {};
    for (const m of rows) {
      const key = m.outcome ?? "No Outcome";
      outcomeDist[key] = (outcomeDist[key] ?? 0) + 1;
    }

    // ── Report 4: Meeting type breakdown ────────────────────────────────────
    const typeDist: Record<string, number> = {};
    for (const m of rows) {
      const key = m.type_activity ?? "Unknown";
      typeDist[key] = (typeDist[key] ?? 0) + 1;
    }

    // ── Report 5: Company coverage ──────────────────────────────────────────
    const companyCoverage: Record<string, { count: number; lastMeeting: string; outcomes: string[] }> = {};
    for (const m of rows) {
      const key = m.company_name ?? "No Company";
      if (!companyCoverage[key]) companyCoverage[key] = { count: 0, lastMeeting: m.start_date, outcomes: [] };
      companyCoverage[key].count++;
      if (m.start_date > companyCoverage[key].lastMeeting) companyCoverage[key].lastMeeting = m.start_date;
      if (m.outcome) companyCoverage[key].outcomes.push(m.outcome);
    }

    return NextResponse.json({
      success: true,
      data: rows,
      reports: {
        funnel,
        cycle_time: cycleTime,
        outcome_distribution: outcomeDist,
        type_distribution: typeDist,
        company_coverage: companyCoverage,
        total_records: rows.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
