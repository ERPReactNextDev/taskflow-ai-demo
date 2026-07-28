import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

async function fetchAllRows<T = any>(query: any): Promise<T[]> {
  const PAGE_SIZE = 1000;
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

async function getAgentIds(manager: string): Promise<string[]> {
  const { data: tsms } = await supabase.from("users").select("ReferenceID")
    .eq("Manager", manager).eq("Role", "Territory Sales Manager")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');
  if (!tsms || tsms.length === 0) return [];
  const tsmIds = tsms.map((t) => t.ReferenceID);
  const { data: agents } = await supabase.from("users").select("ReferenceID")
    .in("TSM", tsmIds).eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');
  return (agents ?? []).map((a) => a.ReferenceID);
}

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const from    = url.searchParams.get("from");
    const to      = url.searchParams.get("to");

    if (!manager) return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });

    const agentIds = await getAgentIds(manager);
    if (agentIds.length === 0) return NextResponse.json({ success: true, count: 0 }, { status: 200 });

    const now = new Date();
    const manilaMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
    const defaultStartDate = `${manilaMonth}-01`;

    const startDate = from || defaultStartDate;
    const endDate   = to || (from ? from : null);

    let query = supabase.from("history")
      .select("quotation_number")
      .in("referenceid", agentIds)
      .eq("type_activity", "Quotation Preparation")
      .eq("status", "Quote-Done")
      .gte("date_created", startDate);
    if (endDate) query = query.lte("date_created", endDate);

    const data = await fetchAllRows(query);

    const uniqueQuotations = new Set<string>();
    data.forEach((row) => { if (row.quotation_number) uniqueQuotations.add(row.quotation_number); });

    return NextResponse.json({ success: true, count: uniqueQuotations.size }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
