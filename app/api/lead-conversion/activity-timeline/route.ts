/**
 * GET /api/lead-conversion/activity-timeline?account_reference_number=
 * Returns ordered activity history for a single lead/client.
 * Used by the Activity Timeline Tracker in the lead profile.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const STAGE_ORDER = [
  "Outbound Calls",
  "Quotation Preparation",
  "Sales Order Preparation",
  "Delivered / Closed Transaction",
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get("account_reference_number");

    if (!ref) {
      return NextResponse.json({ success: false, error: "account_reference_number required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("history")
      .select("type_activity, source, date_created, status, notes, referenceid")
      .eq("account_reference_number", ref)
      .order("date_created", { ascending: true });

    if (error) throw error;

    const rows = data ?? [];

    // Build per-stage summary
    const stageMap: Record<string, { completed: boolean; date: string | null; count: number }> = {
      "Outbound Calls":               { completed: false, date: null, count: 0 },
      "Quotation Preparation":        { completed: false, date: null, count: 0 },
      "Sales Order Preparation":      { completed: false, date: null, count: 0 },
      "Delivered / Closed Transaction": { completed: false, date: null, count: 0 },
    };

    for (const r of rows) {
      const activity = r.source === "Outbound - Touchbase" ? "Outbound Calls" : r.type_activity;
      if (stageMap[activity]) {
        stageMap[activity].completed = true;
        stageMap[activity].date = r.date_created;
        stageMap[activity].count++;
      }
    }

    const completedCount = Object.values(stageMap).filter(s => s.completed).length;
    const progressPct = Math.round((completedCount / STAGE_ORDER.length) * 100);

    // Find current stage (last completed)
    let currentStageIndex = -1;
    for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
      if (stageMap[STAGE_ORDER[i]].completed) { currentStageIndex = i; break; }
    }

    const nextStage = currentStageIndex < STAGE_ORDER.length - 1
      ? STAGE_ORDER[currentStageIndex + 1]
      : null;

    const timeline = STAGE_ORDER.map((stage, i) => ({
      stage,
      completed: stageMap[stage].completed,
      date: stageMap[stage].date,
      count: stageMap[stage].count,
      isCurrent: i === currentStageIndex,
      isNext: stage === nextStage,
    }));

    return NextResponse.json({
      success: true,
      account_reference_number: ref,
      timeline,
      progress_pct: progressPct,
      current_stage: currentStageIndex >= 0 ? STAGE_ORDER[currentStageIndex] : "Not Started",
      next_stage: nextStage,
      raw_history: rows,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
