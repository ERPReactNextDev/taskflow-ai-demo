/**
 * GET /api/meetings/stats?referenceid=&from=&to=
 * Returns aggregated meeting stats for dashboard insight cards.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");
    const tsm         = searchParams.get("tsm");
    const manager     = searchParams.get("manager");
    const from        = searchParams.get("from");
    const to          = searchParams.get("to");

    let query = supabase.from("meetings").select("*");

    if (referenceid) query = query.eq("referenceid", referenceid);
    else if (tsm)    query = query.eq("tsm", tsm);
    else if (manager) query = query.eq("manager", manager);

    if (from) query = query.gte("start_date", from);
    if (to)   query = query.lte("start_date", to);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const now  = new Date().toISOString();

    const total     = rows.length;
    const upcoming  = rows.filter(m => !m.is_cancelled && m.start_date >= now).length;
    const completed = rows.filter(m => m.status === "Completed" || (!m.is_cancelled && m.end_date < now)).length;
    const cancelled = rows.filter(m => m.is_cancelled).length;
    const noShow    = rows.filter(m => m.outcome === "No Show").length;

    // Outcome breakdown
    const outcomeCounts: Record<string, number> = {};
    for (const m of rows) {
      if (m.outcome) outcomeCounts[m.outcome] = (outcomeCounts[m.outcome] ?? 0) + 1;
    }

    // This week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeek = rows.filter(m => m.start_date >= weekStart.toISOString()).length;

    // Conversion score total
    const totalConversionDelta = rows.reduce((sum, m) => sum + (m.conversion_score_delta ?? 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        total, upcoming, completed, cancelled, noShow, thisWeek,
        totalConversionDelta, outcomeCounts,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
