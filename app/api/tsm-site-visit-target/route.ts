import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/**
 * GET /api/tsm-site-visit-target?tsm=<tsmId>&year=<YYYY>&month=<MonthName>
 *
 * Returns the aggregated (sum) site visit target for all active TSAs under
 * the given TSM, for the specified month/year.
 *
 * Designed for the TSM KPI Weighted Scores card where the TSM views
 * each agent's individual target (not a TSM-level total).
 *
 * Response:
 * {
 *   success: true,
 *   targets: { [referenceid]: number },  // per-agent targets
 *   total: number                         // sum of all agents' targets
 * }
 */
export async function GET(req: Request) {
  try {
    const url   = new URL(req.url);
    const tsm   = url.searchParams.get("tsm");
    const year  = url.searchParams.get("year")  ?? new Date().getFullYear().toString();
    const month = url.searchParams.get("month") ?? [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ][new Date().getMonth()];

    if (!tsm) {
      return NextResponse.json(
        { success: false, error: "Missing tsm parameter." },
        { status: 400 }
      );
    }

    // 1. Get all active TSAs under this TSM
    const { data: agents, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');

    if (agentsError) {
      console.error("tsm-site-visit-target: error fetching agents:", agentsError);
      return NextResponse.json(
        { success: false, error: agentsError.message },
        { status: 500 }
      );
    }

    const agentIds = (agents ?? []).map((a) => a.ReferenceID).filter(Boolean);

    if (agentIds.length === 0) {
      return NextResponse.json(
        { success: true, targets: {}, total: 0 },
        { status: 200 }
      );
    }

    // 2. Fetch site_visit_target rows for all agents for the given month/year
    //    Order by target DESC so that when we pick one row per agent we get the highest
    const { data: rows, error: targetError } = await supabase
      .from("site_visit_target")
      .select("referenceid, target")
      .in("referenceid", agentIds)
      .eq("month", month)
      .eq("year", year)
      .order("target", { ascending: false });

    if (targetError) {
      console.error("tsm-site-visit-target: error fetching targets:", targetError);
      return NextResponse.json(
        { success: false, error: targetError.message },
        { status: 500 }
      );
    }

    // 3. Build per-agent target map (first row per agent = highest target)
    const targets: Record<string, number> = {};
    for (const row of rows ?? []) {
      if (!targets[row.referenceid]) {
        targets[row.referenceid] = Number(row.target) || 0;
      }
    }

    const total = Object.values(targets).reduce((sum, t) => sum + t, 0);

    return NextResponse.json(
      { success: true, targets, total },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("tsm-site-visit-target error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch TSM site visit targets." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
