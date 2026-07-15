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
      return NextResponse.json({ success: true, agents: [], siMap: {}, months: MONTHS, year }, { status: 200 });
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
      return NextResponse.json({ success: true, agents: [], siMap: {}, months: MONTHS, year }, { status: 200 });
    }

    const agentIds  = agents.map((a) => a.ReferenceID);
    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;

    // 3. Fetch all Delivered / Closed Transaction records for the year
    const siRows = await fetchAllRows(
      supabase
        .from("history")
        .select("referenceid, actual_sales, delivery_date")
        .in("referenceid", agentIds)
        .eq("type_activity", "Delivered / Closed Transaction")
        .gte("delivery_date", yearStart)
        .lte("delivery_date", yearEnd)
    );

    // 4. Build siMap: { [referenceid]: { [month]: amount } }
    const siMap: Record<string, Record<string, number>> = {};
    for (const row of siRows) {
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
    console.error("manager-agent-si GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch SI data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
