import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from        = url.searchParams.get("from");
    const to          = url.searchParams.get("to");

    if (!referenceid) {
      return NextResponse.json({ success: false, error: "Missing reference ID." }, { status: 400 });
    }

    const now = new Date();
    
    // Helper to convert YYYY-MM-DD to local time range (Asia/Manila)
    function getLocalDateRange(dateStr: string): { start: Date; end: Date } {
      const [year, month, day] = dateStr.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      return { start, end };
    }

    // Get default range (start of current month if no from/to)
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const { start: startDate, end: endDate } = from 
      ? getLocalDateRange(from)
      : { start: defaultStart, end: null };
    
    // If we have a "to" date, use its local end time
    const finalEndDate = to ? getLocalDateRange(to).end : endDate;

    let q = supabase
      .from("history")
      .select("*", { count: "exact" })
      .eq("referenceid", referenceid)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", startDate.toISOString());

    if (finalEndDate) q = q.lte("date_created", finalEndDate.toISOString());

    const { error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching outbound calls:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch outbound calls." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
