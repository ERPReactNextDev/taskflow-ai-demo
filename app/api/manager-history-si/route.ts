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

/** Get all TSA ReferenceIDs under a manager (via TSMs → TSAs) */
async function getAgentIds(manager: string): Promise<string[]> {
  const { data: tsms } = await supabase
    .from("users")
    .select("ReferenceID")
    .eq("Manager", manager)
    .eq("Role", "Territory Sales Manager")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');

  if (!tsms || tsms.length === 0) return [];
  const tsmIds = tsms.map((t) => t.ReferenceID);

  const { data: agents } = await supabase
    .from("users")
    .select("ReferenceID")
    .in("TSM", tsmIds)
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');

  return (agents ?? []).map((a) => a.ReferenceID);
}

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const from    = url.searchParams.get("from");
    const to      = url.searchParams.get("to");

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    const agentIds = await getAgentIds(manager);
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
    console.error("manager-history-si GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
