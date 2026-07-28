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

/** Fetch all rows from Supabase (handles pagination for large datasets) */
async function fetchAllRows<T = any>(query: any): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allData: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allData;
}

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
      return NextResponse.json({ success: true, agents: [], obMap: {}, months: MONTHS, year }, { status: 200 });
    }

    const agentIds  = agents.map((a) => a.ReferenceID);
    // Use Manila +08:00 bounds — consistent with tsm-agent-outbound-history
    const yearStart = `${year}-01-01T00:00:00+08:00`;
    const yearEnd   = `${year}-12-31T23:59:59.999+08:00`;

    // 2. Fetch all Outbound - Touchbase records for those agents for the year
    const query = supabase
      .from("history")
      .select("referenceid, date_created")
      .in("referenceid", agentIds)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", yearStart)
      .lte("date_created", yearEnd);

    const obRows = await fetchAllRows(query);

    // 3. Build obMap: { [referenceid]: { [month]: count } }
    //    Use Manila timezone for month bucketing so months align with Outbound History tab.
    const obMap: Record<string, Record<string, number>> = {};

    for (const row of obRows ?? []) {
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
    console.error("Error fetching TSM agent OB calls:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch OB data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
