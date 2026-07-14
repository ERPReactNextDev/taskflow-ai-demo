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

export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const referenceId = url.searchParams.get("referenceid");
    const from        = url.searchParams.get("from");
    const to          = url.searchParams.get("to");

    if (!referenceId) {
      return NextResponse.json({ success: false, error: "Missing reference ID." }, { status: 400 });
    }

    const now = new Date();
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;

    const startISO = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const endISO   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    const historyData = await fetchAllRows(
      supabase.from("history")
        .select("activity_reference_number, source, type_activity")
        .eq("referenceid", referenceId)
        .gte("date_created", startISO)
        .lte("date_created", endISO)
    );

    const activityGroups = new Map<string, { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean }>();
    for (const record of historyData) {
      if (!record.activity_reference_number) continue;
      if (!activityGroups.has(record.activity_reference_number))
        activityGroups.set(record.activity_reference_number, { hasOutbound: false, hasQuotation: false, hasSalesOrder: false });
      const group = activityGroups.get(record.activity_reference_number)!;
      if (record.source === "Outbound - Touchbase")              group.hasOutbound   = true;
      if (record.type_activity === "Quotation Preparation")      group.hasQuotation  = true;
      if (record.type_activity === "Sales Order Preparation")    group.hasSalesOrder = true;
    }

    let quoteToSOQuotationCount = 0, quoteToSOSalesOrderCount = 0;
    activityGroups.forEach((group) => {
      if (group.hasOutbound && group.hasQuotation)                     quoteToSOQuotationCount++;
      if (group.hasOutbound && group.hasQuotation && group.hasSalesOrder) quoteToSOSalesOrderCount++;
    });

    return NextResponse.json({ success: true, quoteToSOQuotationCount, quoteToSOSalesOrderCount }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching quote to SO:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch quote to SO." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
