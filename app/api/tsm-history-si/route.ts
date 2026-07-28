import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

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

async function getAgentIds(tsm: string): Promise<{ ids: string[]; agents: { referenceid: string; name: string }[] }> {
  const { data } = await supabase.from("users")
    .select("ReferenceID, Firstname, Lastname")
    .eq("TSM", tsm).eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")')
    .order("Lastname", { ascending: true });
  const rows = data ?? [];
  return {
    ids: rows.map((a) => a.ReferenceID),
    agents: rows.map((a) => ({
      referenceid: a.ReferenceID,
      name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
    })),
  };
}

export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!tsm) return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });

    const { ids: agentIds, agents } = await getAgentIds(tsm);
    if (agentIds.length === 0) return NextResponse.json({ success: true, total: 0, records: [], agents: [] }, { status: 200 });

    const now = new Date();
    
    // Helper to convert Date to YYYY-MM-DD string
    function formatDateString(d: Date): string {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // Default range: start of current year
    const defaultStart = new Date(now.getFullYear(), 0, 1);
    const startDateStr = from ? from : formatDateString(defaultStart);
    const endDateStr = to ? to : null;

    let q = supabase.from("history").select("referenceid, actual_sales, delivery_date")
      .in("referenceid", agentIds)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("delivery_date", startDateStr);
    if (endDateStr) q = q.lte("delivery_date", endDateStr);

    const records = await fetchAllRows(q);

    const total = (records ?? []).reduce((sum, r) => sum + (Number(r.actual_sales) || 0), 0);
    return NextResponse.json({ success: true, total, records, agents }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
