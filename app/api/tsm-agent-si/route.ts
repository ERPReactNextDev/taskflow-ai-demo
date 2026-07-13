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
      return NextResponse.json({ success: true, agents: [], siMap: {}, months: MONTHS, year }, { status: 200 });
    }

    const agentIds  = agents.map((a) => a.ReferenceID);
    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;

    // 2. Fetch all Delivered / Closed Transaction records for those agents for the year
    const query = supabase
      .from("history")
      .select("referenceid, actual_sales, delivery_date")
      .in("referenceid", agentIds)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("delivery_date", yearStart)
      .lte("delivery_date", yearEnd);

    const siRows = await fetchAllRows(query);

    // 3. Build siMap: { [referenceid]: { [month]: amount } }
    const siMap: Record<string, Record<string, number>> = {};

    for (const row of siRows ?? []) {
      const ref   = row.referenceid;
      const month = MONTHS[new Date(row.delivery_date).getMonth()];
      const amt   = Number(row.actual_sales) || 0;

      if (!siMap[ref])        siMap[ref] = {};
      if (!siMap[ref][month]) siMap[ref][month] = 0;
      siMap[ref][month] += amt;
    }

    return NextResponse.json(
      {
        success: true,
        agents: agents.map((a) => ({
          referenceid: a.ReferenceID,
          name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
        })),
        siMap,
        months: MONTHS,
        year,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error fetching TSM agent SI:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch SI data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
