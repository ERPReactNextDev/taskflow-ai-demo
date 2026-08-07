/**
 * GET /api/field-attendance/stats
 * Returns daily summary stats for the agent dashboard.
 * ZERO writes to tasklog.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { todayManilaStr } from "@/types/tasklog";

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
    const date        = searchParams.get("date") ?? todayManilaStr(); // YYYY-MM-DD

    let query = supabase
      .from("tasklog")
      .select(`"ReferenceID", "Type", "Status", date_created, "updatedAt"`)
      .gte("date_created", `${date}T00:00:00+08:00`)
      .lte("date_created", `${date}T23:59:59+08:00`);

    if (referenceid) query = query.eq('"ReferenceID"', referenceid);
    else if (tsm)    query = query.eq('"TSM"', tsm);
    else if (manager) query = query.eq('"Manager"', manager);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];

    const visits_today   = rows.length;
    const checked_in     = rows.filter((r: any) => r.Status === "Checked In" || r.Status === "Login").length;
    const checked_out    = rows.filter((r: any) => r.Status === "Checked Out" || r.Status === "Logout").length;
    const violations     = rows.filter((r: any) => ["Off-Site","Invalid GPS","Late Check-In","Missed Visit"].includes(r.Status)).length;

    // Total duration (sum of computed durations)
    const total_duration_minutes = rows.reduce((sum: number, r: any) => {
      if (r.updatedAt && r.date_created) {
        const diff = new Date(r.updatedAt).getTime() - new Date(r.date_created).getTime();
        return diff > 0 ? sum + Math.round(diff / 60000) : sum;
      }
      return sum;
    }, 0);

    return NextResponse.json({
      success: true,
      stats: { visits_today, checked_in, checked_out, violations, total_duration_minutes, date },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
