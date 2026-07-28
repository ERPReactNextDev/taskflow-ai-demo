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

/**
 * GET /api/kpi-monthly-actuals?referenceid=<id>
 *
 * Returns all KPI actuals for the current calendar month so the
 * KpiWeightedScores card always compares apples-to-apples against
 * the monthly targets stored in sales_quota / sales_ob / sales_quotation.
 *
 * Response shape:
 * {
 *   success: true,
 *   totalActualSales: number,       // SI (Delivered) amount YTD — matches sales_quota annual target
 *   obCallsCount: number,           // Outbound-Touchbase rows this month
 *   quotesCount: number,            // Approved quotations this month
 *   callsToQuotesCount: number,     // Activity groups with outbound + quotation
 *   quoteToSOQuotationCount: number,
 *   quoteToSOSalesOrderCount: number,
 *   soToSISalesOrderCount: number,
 *   soToSIDeliveredCount: number,
 * }
 */
export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing referenceid." },
        { status: 400 }
      );
    }

    const now        = new Date();
    const year       = now.getFullYear();
    const month      = String(now.getMonth() + 1).padStart(2, "0");
    const monthStart = `${year}-${month}-01T00:00:00Z`;
    // Last moment of today (not end-of-month) — gives current progress
    const todayEnd   = `${year}-${month}-${String(now.getDate()).padStart(2, "0")}T23:59:59Z`;
    // For SI/sales quota the target is annual, so fetch YTD
    const yearStart  = `${year}-01-01T00:00:00Z`;

    // Run all queries in parallel — single round-trip to Supabase
    const siQuery = supabase
      .from("history")
      .select("actual_sales")
      .eq("referenceid", referenceid)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("delivery_date", yearStart)
      .lte("delivery_date", todayEnd);

    const [siData, obRes, quotesRes, convRes] = await Promise.all([
      // 1. SI (Delivered / Closed) — YTD to match the annual sales quota target
      fetchAllRows(siQuery),

      // 2. OB Calls this month
      supabase
        .from("history")
        .select("id", { count: "exact", head: true })
        .eq("referenceid", referenceid)
        .eq("source", "Outbound - Touchbase")
        .gte("date_created", monthStart)
        .lte("date_created", todayEnd),

      // 3. Approved quotations this month
      supabase
        .from("history")
        .select("quotation_number", { count: "exact", head: true })
        .eq("referenceid", referenceid)
        .eq("type_activity", "Quotation Preparation")
        .or("tsm_approved_status.eq.Approved By Sales Head,tsm_approved_status.eq.Approved")
        .gte("date_created", monthStart)
        .lte("date_created", todayEnd),

      // 4. Conversion ratios — fetch all relevant rows this month in one query
      fetchAllRows(
        supabase
          .from("history")
          .select("activity_reference_number, source, type_activity")
          .eq("referenceid", referenceid)
          .gte("date_created", monthStart)
          .lte("date_created", todayEnd)
      ),
    ]);

    // Check errors for non-fetchAllRows queries
    if (obRes.error)    throw obRes.error;
    if (quotesRes.error) throw quotesRes.error;

    // Aggregate SI total
    const totalActualSales = (siData ?? []).reduce(
      (sum, row) => sum + (Number(row.actual_sales) || 0),
      0
    );

    // OB count
    const obCallsCount = obRes.count ?? 0;

    // Approved quotes count
    const quotesCount = quotesRes.count ?? 0;

    // Conversion ratios from convRes rows
    type ConvGroup = {
      hasOutbound: boolean;
      hasQuotation: boolean;
      hasSalesOrder: boolean;
      hasDelivered: boolean;
    };
    const groups = new Map<string, ConvGroup>();

    for (const row of convRes ?? []) {
      if (!row.activity_reference_number) continue;
      if (!groups.has(row.activity_reference_number)) {
        groups.set(row.activity_reference_number, {
          hasOutbound: false,
          hasQuotation: false,
          hasSalesOrder: false,
          hasDelivered: false,
        });
      }
      const g = groups.get(row.activity_reference_number)!;
      if (row.source === "Outbound - Touchbase")                      g.hasOutbound  = true;
      if (row.type_activity === "Quotation Preparation")              g.hasQuotation = true;
      if (row.type_activity === "Sales Order Preparation")            g.hasSalesOrder = true;
      if (row.type_activity === "Delivered / Closed Transaction")     g.hasDelivered  = true;
    }

    let callsToQuotesCount       = 0;
    let quoteToSOQuotationCount  = 0;
    let quoteToSOSalesOrderCount = 0;
    let soToSISalesOrderCount    = 0;
    let soToSIDeliveredCount     = 0;

    groups.forEach((g) => {
      if (g.hasOutbound && g.hasQuotation)                           callsToQuotesCount++;
      if (g.hasOutbound && g.hasQuotation)                           quoteToSOQuotationCount++;
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)        quoteToSOSalesOrderCount++;
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)        soToSISalesOrderCount++;
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder && g.hasDelivered) soToSIDeliveredCount++;
    });

    return NextResponse.json({
      success: true,
      totalActualSales,
      obCallsCount,
      quotesCount,
      callsToQuotesCount,
      quoteToSOQuotationCount,
      quoteToSOSalesOrderCount,
      soToSISalesOrderCount,
      soToSIDeliveredCount,
    });
  } catch (err: any) {
    console.error("kpi-monthly-actuals error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch KPI actuals." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
