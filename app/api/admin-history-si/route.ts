import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

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

/** Get all active TSA ReferenceIDs system-wide */
async function getAllAgentIds(): Promise<string[]> {
  const { data: agents, error } = await supabase
    .from("users")
    .select("ReferenceID")
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');

  if (error) throw error;
  return (agents ?? []).map((a) => a.ReferenceID).filter(Boolean);
}

// GET /api/admin-history-si?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    const agentIds = await getAllAgentIds();
    if (agentIds.length === 0) {
      return NextResponse.json({ success: true, total: 0, records: [] }, { status: 200 });
    }

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), 0, 1);
    const startDateStr = from ?? defaultStart.toISOString().slice(0, 10);

    let q = supabase
      .from("history")
      .select("referenceid, actual_sales, delivery_date")
      .in("referenceid", agentIds)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("delivery_date", startDateStr);

    if (to) q = q.lte("delivery_date", to);

    const records = await fetchAllRows(q);
    const total   = records.reduce((sum, r) => sum + (Number(r.actual_sales) || 0), 0);

    return NextResponse.json({ success: true, total, records }, { status: 200 });
  } catch (err: any) {
    console.error("admin-history-si GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
