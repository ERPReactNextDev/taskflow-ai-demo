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

// ─── GET — fetch all agents under TSM with their monthly account development targets ───
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const year = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
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
      return NextResponse.json({ success: true, agents: [], targets: {} }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    // 2. Get all sales_account_development rows for those agents for the given year
    const { data: targetRows, error: targetError } = await supabase
      .from("sales_account_development")
      .select("referenceid, month, target, count")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (targetError) throw targetError;

    // 3. Build map: { [referenceid]: { [month]: { target: number, count: number } } }
    const targets: Record<string, Record<string, { target: number; count: number }>> = {};
    for (const row of targetRows ?? []) {
      if (!targets[row.referenceid]) targets[row.referenceid] = {};
      targets[row.referenceid][row.month] = {
        target: Number(row.target) || 0,
        count: Number(row.count) || 0,
      };
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
    console.error("Error fetching TSM agent account development targets:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch targets." },
      { status: 500 }
    );
  }
}

// ─── PUT — upsert a single agent-month account development target ─────────────
export async function PUT(req: Request) {
  try {
    const { referenceid, month, year, target, count, tsm, manager } = await req.json();

    if (!referenceid || !month || !year || target === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Check if row exists
    const { data: existing } = await supabase
      .from("sales_account_development")
      .select("id")
      .eq("referenceid", referenceid)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("sales_account_development")
        .update({
          target: String(target),
          count: count !== undefined ? String(count) : null,
          date_updated: new Date().toISOString(),
        })
        .eq("referenceid", referenceid)
        .eq("month", month)
        .eq("year", year);
    } else {
      result = await supabase
        .from("sales_account_development")
        .insert({
          referenceid,
          month,
          year,
          target: String(target),
          count: count !== undefined ? String(count) : null,
          tsm: tsm ?? null,
          manager: manager ?? null,
        });
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("Error upserting account development target:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save target." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
