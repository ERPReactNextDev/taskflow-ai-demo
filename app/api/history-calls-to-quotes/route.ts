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
    
    // Helper to convert YYYY-MM-DD to local time range
    function getLocalDateRange(dateStr: string): { start: Date; end: Date } {
      const [year, month, day] = dateStr.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      return { start, end };
    }

    // Default range: start of current month
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const { start: startDate, end: endDate } = from 
      ? getLocalDateRange(from)
      : { start: defaultStart, end: null };
    
    const finalEndDate = to ? getLocalDateRange(to).end : endDate;

    let query = supabase
      .from("history")
      .select("activity_reference_number, source, type_activity")
      .eq("referenceid", referenceId)
      .gte("date_created", startDate.toISOString());

    if (finalEndDate) query = query.lte("date_created", finalEndDate.toISOString());

    const { data: historyData, error: historyError } = await query;
    if (historyError) throw historyError;

    const activityGroups = new Map<string, { hasOutbound: boolean; hasQuotation: boolean }>();

    historyData?.forEach(record => {
      if (!record.activity_reference_number) return;
      if (!activityGroups.has(record.activity_reference_number))
        activityGroups.set(record.activity_reference_number, { hasOutbound: false, hasQuotation: false });
      const group = activityGroups.get(record.activity_reference_number)!;
      if (record.source === "Outbound - Touchbase") group.hasOutbound = true;
      if (record.type_activity === "Quotation Preparation") group.hasQuotation = true;
    });

    let count = 0;
    activityGroups.forEach(group => { if (group.hasOutbound && group.hasQuotation) count++; });

    return NextResponse.json({ success: true, count }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching calls to quotes:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch calls to quotes." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
