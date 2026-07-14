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

/** Return 0-indexed month from a date string, interpreted in Asia/Manila time */
function manilaMonthIndex(dateStr: string): number {
  return parseInt(
    new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).split("-")[1],
    10
  ) - 1;
}

export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const year = url.searchParams.get("year") ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
    }

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

    // Full calendar year in Manila time — matches what the breakdown page displays
    const startISO = `${year}-01-01T00:00:00+08:00`;
    const endISO   = `${year}-12-31T23:59:59.999+08:00`;

    const soRows = await fetchAllRows(
      supabase.from("history")
        .select("referenceid, so_amount, call_type, date_created")
        .in("referenceid", agentIds)
        .eq("status", "SO-Done")
        .gte("date_created", startISO)
        .lte("date_created", endISO)
    );

    // Build soMap — use Manila timezone to bucket into the correct month
    const soMap: Record<string, Record<string, { regular: number; spf: number; total: number }>> = {};

    for (const row of soRows) {
      const ref   = row.referenceid;
      const month = MONTHS[manilaMonthIndex(row.date_created)];
      const amt   = Number(row.so_amount) || 0;
      const isSpf = SPF_TYPES.includes((row.call_type || "").toLowerCase());

      if (!soMap[ref])        soMap[ref] = {};
      if (!soMap[ref][month]) soMap[ref][month] = { regular: 0, spf: 0, total: 0 };

      if (isSpf) soMap[ref][month].spf     += amt;
      else        soMap[ref][month].regular += amt;
      soMap[ref][month].total += amt;
    }

    return NextResponse.json({
      success: true,
      agents: agents.map((a) => ({
        referenceid: a.ReferenceID,
        name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
      })),
      soMap,
      months: MONTHS,
      year,
    }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching TSM agent SO:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch SO data." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
