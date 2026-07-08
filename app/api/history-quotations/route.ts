import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!referenceid) {
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
      .select("quotation_number")
      .eq("referenceid", referenceid)
      .eq("type_activity", "Quotation Preparation")
      .or("tsm_approved_status.eq.Approved By Sales Head,tsm_approved_status.eq.Approved")
      .gte("date_created", startDate.toISOString());

    if (finalEndDate) query = query.lte("date_created", finalEndDate.toISOString());

    const { data, error } = await query;
    if (error) throw error;

    // Count unique quotation numbers
    const uniqueQuotations = new Set<string>();
    data?.forEach(row => {
      if (row.quotation_number) {
        uniqueQuotations.add(row.quotation_number);
      }
    });

    return NextResponse.json({ success: true, count: uniqueQuotations.size }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching approved quotations:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch approved quotations." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
