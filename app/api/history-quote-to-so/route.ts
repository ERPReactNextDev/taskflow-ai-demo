import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referenceId = url.searchParams.get("referenceid");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!referenceId) {
      return NextResponse.json({ success: false, error: "Missing reference ID." }, { status: 400 });
    }

    const now = new Date();
    
    // Derive current month in Manila time for default range
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;

    // Use Asia/Manila timezone for date ranges (matches tsm-kpi and tsa-kpi)
    const rangeStart = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const rangeEnd   = to   ? `${to}T23:59:59.999+08:00` : `${manilaToday}T23:59:59.999+08:00`;

    let query = supabase
      .from("history")
      .select("activity_reference_number, source, type_activity")
      .eq("referenceid", referenceId)
      .gte("date_created", rangeStart);

    if (to) query = query.lte("date_created", rangeEnd);

    const { data: historyData, error: historyError } = await query;
    if (historyError) throw historyError;

    const activityGroups = new Map<string, { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean }>();

    historyData?.forEach((record) => {
      if (!record.activity_reference_number) return;
      if (!activityGroups.has(record.activity_reference_number))
        activityGroups.set(record.activity_reference_number, { hasOutbound: false, hasQuotation: false, hasSalesOrder: false });
      const group = activityGroups.get(record.activity_reference_number)!;
      if (record.source === "Outbound - Touchbase") group.hasOutbound = true;
      if (record.type_activity === "Quotation Preparation") group.hasQuotation = true;
      if (record.type_activity === "Sales Order Preparation") group.hasSalesOrder = true;
    });

    let quoteToSOQuotationCount = 0, quoteToSOSalesOrderCount = 0;
    activityGroups.forEach((group) => {
      if (group.hasOutbound && group.hasQuotation) quoteToSOQuotationCount++;
      if (group.hasOutbound && group.hasQuotation && group.hasSalesOrder) quoteToSOSalesOrderCount++;
    });

    return NextResponse.json({ success: true, quoteToSOQuotationCount, quoteToSOSalesOrderCount }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching quote to SO:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch quote to SO." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
