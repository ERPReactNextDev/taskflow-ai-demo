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

async function getAllAgentIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("users").select("ReferenceID")
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');
  if (error) throw error;
  return (data ?? []).map((a) => a.ReferenceID).filter(Boolean);
}

// GET /api/admin-pipeline?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns all pipeline conversion counts system-wide.
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    const agentIds = await getAllAgentIds();
    if (agentIds.length === 0) {
      return NextResponse.json({
        success: true, quotesCount: 0, callsToQuotesCount: 0,
        quoteToSOQuotationCount: 0, quoteToSOSalesOrderCount: 0,
        soToSISalesOrderCount: 0, soToSIDeliveredCount: 0,
      }, { status: 200 });
    }

    const now = new Date();
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;
    const startISO = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const endISO   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    // Quotes count (unique quotation numbers)
    const quotesRows = await fetchAllRows(
      supabase.from("history").select("quotation_number")
        .in("referenceid", agentIds)
        .eq("type_activity", "Quotation Preparation")
        .eq("status", "Quote-Done")
        .gte("date_created", startISO).lte("date_created", endISO)
    );
    const uniqueQuotes = new Set<string>();
    for (const r of quotesRows) { if (r.quotation_number) uniqueQuotes.add(r.quotation_number); }

    // Pipeline conversion counts
    const pipelineRows = await fetchAllRows(
      supabase.from("history")
        .select("activity_reference_number, source, type_activity")
        .in("referenceid", agentIds)
        .gte("date_created", startISO).lte("date_created", endISO)
    );

    type Group = { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean; hasDelivered: boolean };
    const groups = new Map<string, Group>();
    for (const r of pipelineRows) {
      if (!r.activity_reference_number) continue;
      if (!groups.has(r.activity_reference_number))
        groups.set(r.activity_reference_number, { hasOutbound:false, hasQuotation:false, hasSalesOrder:false, hasDelivered:false });
      const g = groups.get(r.activity_reference_number)!;
      if (r.source === "Outbound - Touchbase")                  g.hasOutbound   = true;
      if (r.type_activity === "Quotation Preparation")          g.hasQuotation  = true;
      if (r.type_activity === "Sales Order Preparation")        g.hasSalesOrder = true;
      if (r.type_activity === "Delivered / Closed Transaction") g.hasDelivered  = true;
    }

    let callsToQuotesCount = 0, quoteToSOQuotationCount = 0;
    let quoteToSOSalesOrderCount = 0, soToSISalesOrderCount = 0, soToSIDeliveredCount = 0;

    groups.forEach((g) => {
      if (g.hasOutbound && g.hasQuotation) {
        callsToQuotesCount++;
        quoteToSOQuotationCount++;
      }
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder) {
        quoteToSOSalesOrderCount++;
        soToSISalesOrderCount++;
      }
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder && g.hasDelivered) {
        soToSIDeliveredCount++;
      }
    });

    return NextResponse.json({
      success: true,
      quotesCount:             uniqueQuotes.size,
      callsToQuotesCount,
      quoteToSOQuotationCount,
      quoteToSOSalesOrderCount,
      soToSISalesOrderCount,
      soToSIDeliveredCount,
    }, { status: 200 });
  } catch (err: any) {
    console.error("admin-pipeline GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
