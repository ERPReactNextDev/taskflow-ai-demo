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

async function getAgentIds(tsm: string): Promise<string[]> {
  const { data: agents } = await supabase.from("users").select("ReferenceID")
    .eq("TSM", tsm).eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');
  return (agents ?? []).map((a) => a.ReferenceID);
}

/**
 * GET /api/tsm-pipeline-conversion?tsm=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns all pipeline conversion counts in one query using a single flat global map.
 * Used by both the Sales Pipeline card and Agent Performance Detail so numbers always tally.
 */
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
    }

    const agentIds = await getAgentIds(tsm);
    if (agentIds.length === 0) {
      return NextResponse.json({
        success: true,
        callsToQuoteCount: 0,
        quoteToSOQuotationCount: 0,
        quoteToSOSalesOrderCount: 0,
        soToSISalesOrderCount: 0,
        soToSIDeliveredCount: 0,
      }, { status: 200 });
    }

    const now = new Date();
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;
    const startISO = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const endISO   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    const agentIdSet = new Set(agentIds);

    // Single query — same rows used for all four pipeline stages
    const data = await fetchAllRows(
      supabase.from("history")
        .select("referenceid, activity_reference_number, source, type_activity")
        .in("referenceid", agentIds)
        .gte("date_created", startISO)
        .lte("date_created", endISO)
    );

    type Group = {
      hasOutbound:   boolean;
      hasQuotation:  boolean;
      hasSalesOrder: boolean;
      hasDelivered:  boolean;
    };
    const groups = new Map<string, Group>();

    for (const r of data) {
      if (!r.activity_reference_number) continue;
      if (!groups.has(r.activity_reference_number)) {
        groups.set(r.activity_reference_number, {
          hasOutbound: false, hasQuotation: false,
          hasSalesOrder: false, hasDelivered: false,
        });
      }
      const g = groups.get(r.activity_reference_number)!;
      if (r.source        === "Outbound - Touchbase")                 g.hasOutbound   = true;
      if (r.type_activity === "Quotation Preparation")                g.hasQuotation  = true;
      if (r.type_activity === "Sales Order Preparation")              g.hasSalesOrder = true;
      if (r.type_activity === "Delivered / Closed Transaction")       g.hasDelivered  = true;
    }

    let callsToQuoteCount        = 0;
    let quoteToSOQuotationCount  = 0;
    let quoteToSOSalesOrderCount = 0;
    let soToSISalesOrderCount    = 0;
    let soToSIDeliveredCount     = 0;

    groups.forEach((g) => {
      if (g.hasOutbound && g.hasQuotation) {
        callsToQuoteCount++;
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
      callsToQuoteCount,
      quoteToSOQuotationCount,
      quoteToSOSalesOrderCount,
      soToSISalesOrderCount,
      soToSIDeliveredCount,
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
