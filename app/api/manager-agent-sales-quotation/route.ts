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

async function getAgents(manager: string) {
  const { data: tsms } = await supabase.from("users").select("ReferenceID")
    .eq("Manager", manager).eq("Role", "Territory Sales Manager")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');
  if (!tsms || tsms.length === 0) return [];
  const tsmIds = tsms.map((t) => t.ReferenceID);
  const { data: agents, error } = await supabase.from("users")
    .select("ReferenceID, Firstname, Lastname")
    .in("TSM", tsmIds).eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")')
    .order("Lastname", { ascending: true });
  if (error) throw error;
  return agents ?? [];
}

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const year    = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    const agents = await getAgents(manager);
    if (agents.length === 0) {
      return NextResponse.json({ success: true, agents: [], targets: {}, months: MONTHS, year }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    const { data: targetRows, error: targetError } = await supabase
      .from("sales_quotation")
      .select("referenceid, month, quote_target, quotation_amount_target")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (targetError) throw targetError;

    const targets: Record<string, Record<string, { quote_target: number; quotation_amount_target: number }>> = {};
    for (const row of targetRows ?? []) {
      if (!targets[row.referenceid]) targets[row.referenceid] = {};
      targets[row.referenceid][row.month] = {
        quote_target:            Number(row.quote_target) || 0,
        quotation_amount_target: Number(row.quotation_amount_target) || 0,
      };
    }

    return NextResponse.json({
      success: true,
      agents: agents.map((a) => ({
        referenceid: a.ReferenceID,
        name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
      })),
      targets, months: MONTHS, year,
    }, { status: 200 });
  } catch (err: any) {
    console.error("manager-agent-sales-quotation GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
