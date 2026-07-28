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

// ─── GET — fetch all agents under TSM with their monthly quotas ───────────────
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const year = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
    }

    // 1. Get all TSAs under this TSM
    const { data: agents, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return NextResponse.json({ success: true, agents: [], quotas: {} }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    // 2. Get all quota rows for those agents for the given year
    const { data: quotaRows, error: quotaError } = await supabase
      .from("sales_quota")
      .select("referenceid, month, amount")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (quotaError) throw quotaError;

    // 3. Build a map: { [referenceid]: { [month]: amount } }
    const quotaMap: Record<string, Record<string, number>> = {};
    for (const row of quotaRows ?? []) {
      if (!quotaMap[row.referenceid]) quotaMap[row.referenceid] = {};
      quotaMap[row.referenceid][row.month] = Number(row.amount) || 0;
    }

    return NextResponse.json(
      {
        success: true,
        agents: agents.map((a) => ({
          referenceid: a.ReferenceID,
          name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
        })),
        quotas: quotaMap,
        months: MONTHS,
        year,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error fetching TSM agent quotas:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch quotas." },
      { status: 500 }
    );
  }
}

// ─── PUT — upsert a single agent-month quota ──────────────────────────────────
export async function PUT(req: Request) {
  try {
    const { referenceid, month, year, amount, tsm, manager } = await req.json();

    if (!referenceid || !month || !year || amount === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Check if a row already exists
    const { data: existing } = await supabase
      .from("sales_quota")
      .select("id")
      .eq("referenceid", referenceid)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("sales_quota")
        .update({ amount: Number(amount), date_updated: new Date().toISOString() })
        .eq("referenceid", referenceid)
        .eq("month", month)
        .eq("year", year);
    } else {
      result = await supabase
        .from("sales_quota")
        .insert({
          referenceid,
          month,
          year,
          amount: Number(amount),
          tsm:     tsm     ?? null,
          manager: manager ?? null,
        });
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("Error upserting quota:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save quota." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
