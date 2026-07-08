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

    // Helper to convert YYYY-MM-DD to Asia/Manila time range as UTC ISO strings
    function getManilaDateRange(dateStr: string): { start: string; end: string } {
      return {
        start: `${dateStr}T00:00:00+08:00`,
        end:   `${dateStr}T23:59:59.999+08:00`,
      };
    }

    // Default range: start of current month in Manila time
    const manilaMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
    const defaultStartISO = `${manilaMonth}-01T00:00:00+08:00`;

    const startISO = from ? getManilaDateRange(from).start : defaultStartISO;
    const endISO   = to   ? getManilaDateRange(to).end   : (from ? getManilaDateRange(from).end : null);

    let query = supabase
      .from("history")
      .select("quotation_number")
      .eq("referenceid", referenceid)
      .eq("type_activity", "Quotation Preparation")
      .or("tsm_approved_status.eq.Approved By Sales Head,tsm_approved_status.eq.Approved")
      .gte("date_created", startISO);

    if (endISO) query = query.lte("date_created", endISO);

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
