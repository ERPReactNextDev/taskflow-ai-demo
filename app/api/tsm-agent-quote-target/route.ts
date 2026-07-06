import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/**
 * GET /api/tsm-agent-quote-target?tsm=<tsmId>&year=<YYYY>
 *
 * Returns per-agent quote targets for all active TSAs under the given TSM,
 * for the specified year. Shape mirrors tsm-agent-ob-target exactly.
 *
 * Response:
 * {
 *   success: true,
 *   agents:  [{ referenceid, name }],
 *   targets: { [referenceid]: { [month]: number } },
 *   months:  string[],
 *   year:    string
 * }
 */
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const year = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!tsm) {
      return NextResponse.json(
        { success: false, error: "Missing tsm." },
        { status: 400 }
      );
    }

    // 1. Get all active TSAs under this TSM
    const { data: agents, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentsError) throw agentsError;

    if (!agents || agents.length === 0) {
      return NextResponse.json(
        { success: true, agents: [], targets: {}, months: MONTHS, year },
        { status: 200 }
      );
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    // 2. Get all quote target rows for those agents for the given year
    const { data: targetRows, error: targetError } = await supabase
      .from("sales_quotation")
      .select("referenceid, month, quote_target")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (targetError) throw targetError;

    // 3. Build map: { [referenceid]: { [month]: quote_target } }
    const targets: Record<string, Record<string, number>> = {};
    for (const row of targetRows ?? []) {
      if (!targets[row.referenceid]) targets[row.referenceid] = {};
      targets[row.referenceid][row.month] = Number(row.quote_target) || 0;
    }

    return NextResponse.json(
      {
        success: true,
        agents: agents.map((a) => ({
          referenceid: a.ReferenceID,
          name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
        })),
        targets,
        months: MONTHS,
        year,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("tsm-agent-quote-target GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch quote targets." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
