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

const PAGE_SIZE = 1000;

async function fetchAllRows<T = any>(query: any): Promise<T[]> {
  let all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const year    = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    // 1. Get all active TSMs under this manager
    const { data: tsms, error: tsmsError } = await supabase
      .from("users")
      .select("ReferenceID")
      .eq("Manager", manager)
      .eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');

    if (tsmsError) throw tsmsError;
    if (!tsms || tsms.length === 0) {
      return NextResponse.json({ success: true, agents: [], obMap: {}, months: MONTHS, year }, { status: 200 });
    }

    const tsmIds = tsms.map((t) => t.ReferenceID);

    // 2. Get all active TSAs under those TSMs
    const { data: agents, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .in("TSM", tsmIds)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return NextResponse.json({ success: true, agents: [], obMap: {}, months: MONTHS, year }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    // Use Manila +08:00 bounds — consistent with manager-agent-outbound-history
    const yearStart = `${year}-01-01T00:00:00+08:00`;
    const yearEnd   = `${year}-12-31T23:59:59.999+08:00`;

    // 3. Fetch all Outbound - Touchbase records for those agents for the year
    const obRows = await fetchAllRows(
      supabase
        .from("history")
        .select("referenceid, date_created")
        .in("referenceid", agentIds)
        .eq("source", "Outbound - Touchbase")
        .gte("date_created", yearStart)
        .lte("date_created", yearEnd)
    );

    // 4. Build obMap: { [referenceid]: { [month]: count } }
    //    Use Manila timezone for month bucketing so months align with Outbound History tab.
    const obMap: Record<string, Record<string, number>> = {};
    for (const row of obRows) {
      const ref   = row.referenceid;
      const month = new Date(row.date_created).toLocaleDateString("en-US", {
        month: "long",
        timeZone: "Asia/Manila",
      });
      if (!obMap[ref])        obMap[ref] = {};
      if (!obMap[ref][month]) obMap[ref][month] = 0;
      obMap[ref][month]++;
    }

    return NextResponse.json(
      {
        success: true,
        agents: agents.map((a) => ({
          referenceid: a.ReferenceID,
          name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
        })),
        obMap,
        months: MONTHS,
        year,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("manager-agent-ob GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch OB data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
