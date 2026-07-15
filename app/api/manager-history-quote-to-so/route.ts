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
    if (agentIds.length === 0)
      return NextResponse.json({ success: true, quoteToSOQuotationCount: 0, quoteToSOSalesOrderCount: 0 }, { status: 200 });

    const now = new Date();
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;
    const startISO = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const endISO   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    const data = await fetchAllRows(
      supabase.from("history")
        .select("activity_reference_number, source, type_activity")
        .in("referenceid", agentIds)
        .gte("date_created", startISO)
        .lte("date_created", endISO)
    );

    const groups = new Map<string, { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean }>();
    for (const r of data) {
      if (!r.activity_reference_number) continue;
      if (!groups.has(r.activity_reference_number))
        groups.set(r.activity_reference_number, { hasOutbound: false, hasQuotation: false, hasSalesOrder: false });
      const g = groups.get(r.activity_reference_number)!;
      if (r.source === "Outbound - Touchbase")           g.hasOutbound   = true;
      if (r.type_activity === "Quotation Preparation")   g.hasQuotation  = true;
      if (r.type_activity === "Sales Order Preparation") g.hasSalesOrder = true;
    }

    let quoteToSOQuotationCount = 0, quoteToSOSalesOrderCount = 0;
    groups.forEach((g) => {
      if (g.hasOutbound && g.hasQuotation)                    quoteToSOQuotationCount++;
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder) quoteToSOSalesOrderCount++;
    });

    return NextResponse.json({ success: true, quoteToSOQuotationCount, quoteToSOSalesOrderCount }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
