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

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const year    = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    const { data: tsms } = await supabase.from("users").select("ReferenceID")
      .eq("Manager", manager).eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');

    if (!tsms || tsms.length === 0) {
      return NextResponse.json({ success: true, agents: [], targets: {}, months: MONTHS, year }, { status: 200 });
    }

    const tsmIds = tsms.map((t) => t.ReferenceID);

    const { data: agentRows, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .in("TSM", tsmIds)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentsError) throw agentsError;
    if (!agentRows || agentRows.length === 0) {
      return NextResponse.json({ success: true, agents: [], targets: {}, months: MONTHS, year }, { status: 200 });
    }

    const agentIds = agentRows.map((a) => a.ReferenceID);

    const { data: targetRows, error: targetError } = await supabase
      .from("sales_ob")
      .select("referenceid, month, ob_target")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (targetError) throw targetError;

    const targets: Record<string, Record<string, number>> = {};
    for (const row of targetRows ?? []) {
      if (!targets[row.referenceid]) targets[row.referenceid] = {};
      targets[row.referenceid][row.month] = Number(row.ob_target) || 0;
    }

    return NextResponse.json(
      {
        success: true,
        agents: agentRows.map((a) => ({
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
    console.error("manager-agent-ob-target-sum GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch OB targets." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
