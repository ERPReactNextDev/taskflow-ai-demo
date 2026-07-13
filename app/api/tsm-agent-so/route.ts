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

const SPF_TYPES = ["spf - special project", "spf - local", "spf - foreign"];

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

    // 1. Get all TSAs under this TSM (exclude non-TSA roles and inactive statuses)
    const { data: agents, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentsError) throw agentsError;
    if (!agents || agents.length === 0) {
      return NextResponse.json({ success: true, agents: [], soMap: {}, months: MONTHS, year }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);
    const yearStart = `${year}-01-01T00:00:00Z`;
    const yearEnd   = `${year}-12-31T23:59:59Z`;

    // 2. Fetch all SO-Done records for those agents for the year
    const query = supabase
      .from("history")
      .select("referenceid, so_amount, call_type, date_created")
      .in("referenceid", agentIds)
      .eq("status", "SO-Done")
      .gte("date_created", yearStart)
      .lte("date_created", yearEnd);

    const soRows = await fetchAllRows(query);

    // 3. Build soMap: { [referenceid]: { [month]: { regular, spf, total } } }
    const soMap: Record<string, Record<string, { regular: number; spf: number; total: number }>> = {};

    for (const row of soRows ?? []) {
      const ref   = row.referenceid;
      const month = MONTHS[new Date(row.date_created).getMonth()];
      const amt   = Number(row.so_amount) || 0;
      const isSpf = SPF_TYPES.includes((row.call_type || "").toLowerCase());

      if (!soMap[ref])        soMap[ref] = {};
      if (!soMap[ref][month]) soMap[ref][month] = { regular: 0, spf: 0, total: 0 };

      if (isSpf) soMap[ref][month].spf     += amt;
      else        soMap[ref][month].regular += amt;
      soMap[ref][month].total += amt;
    }

    return NextResponse.json(
      {
        success: true,
        agents: agents.map((a) => ({
          referenceid: a.ReferenceID,
          name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
        })),
        soMap,
        months: MONTHS,
        year,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error fetching TSM agent SO:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch SO data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
