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

// ── GET — fetch all agents under TSM with their monthly OB targets ─────────────

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
        { success: true, agents: [], targets: {} },
        { status: 200 }
      );
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    // 2. Get all OB target rows for those agents for the given year
    const { data: targetRows, error: targetError } = await supabase
      .from("sales_ob")
      .select("referenceid, month, ob_target")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (targetError) throw targetError;

    // 3. Build map: { [referenceid]: { [month]: ob_target } }
    const targets: Record<string, Record<string, number>> = {};
    for (const row of targetRows ?? []) {
      if (!targets[row.referenceid]) targets[row.referenceid] = {};
      targets[row.referenceid][row.month] = Number(row.ob_target) || 0;
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
    console.error("tsm-agent-ob-target GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch OB targets." },
      { status: 500 }
    );
  }
}

// ── PUT — upsert a single agent-month OB target ────────────────────────────────

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { referenceid, month, year, ob_target, tsm, manager } = body;

    if (!referenceid || !month || !year || ob_target === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: referenceid, month, year, ob_target." },
        { status: 400 }
      );
    }

    // Validate ob_target is a non-negative integer
    const targetNum = Number(ob_target);
    if (!Number.isFinite(targetNum) || targetNum < 0) {
      return NextResponse.json(
        { success: false, error: "ob_target must be a non-negative number." },
        { status: 422 }
      );
    }

    // Check if row already exists for this agent + month + year
    const { data: existing } = await supabase
      .from("sales_ob")
      .select("id")
      .eq("referenceid", referenceid)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    let result;
    if (existing) {
      // Update existing row
      result = await supabase
        .from("sales_ob")
        .update({
          ob_target: String(targetNum),
          date_updated: new Date().toISOString(),
        })
        .eq("referenceid", referenceid)
        .eq("month", month)
        .eq("year", year);
    } else {
      // Insert new row
      result = await supabase
        .from("sales_ob")
        .insert({
          referenceid,
          month,
          year,
          ob_target: String(targetNum),
          tsm:     tsm     ?? null,
          manager: manager ?? null,
        });
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("tsm-agent-ob-target PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save OB target." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
