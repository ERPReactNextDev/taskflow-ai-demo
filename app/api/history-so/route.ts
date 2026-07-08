import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const SPF_TYPES = ["spf - special project", "spf - local", "spf - foreign"];

export async function GET(req: Request) {
  try {
    const Xchire_url  = new URL(req.url);
    const referenceId = Xchire_url.searchParams.get("referenceid");
    const from        = Xchire_url.searchParams.get("from");
    const to          = Xchire_url.searchParams.get("to");

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

    // Default range: start of current year
    const defaultStart = new Date(now.getFullYear(), 0, 1);
    const { start: startDate, end: endDate } = from 
      ? getLocalDateRange(from)
      : { start: defaultStart, end: null };
    
    const finalEndDate = to ? getLocalDateRange(to).end : endDate;

    let q = supabase
      .from("history")
      .select("so_amount, call_type")
      .eq("referenceid", referenceId)
      .eq("status", "SO-Done")
      .gte("date_created", startDate.toISOString());

    if (finalEndDate) q = q.lte("date_created", finalEndDate.toISOString());

    const { data, error } = await q;
    if (error) throw error;

    let totalRegular = 0;
    let totalSPF     = 0;

    data?.forEach(item => {
      const amount   = Number(item.so_amount) || 0;
      const callType = (item.call_type || "").toLowerCase();
      if (SPF_TYPES.includes(callType)) {
        totalSPF += amount;
      } else {
        totalRegular += amount;
      }
    });

    const total = totalRegular + totalSPF;

    return NextResponse.json({ success: true, total, totalRegular, totalSPF }, { status: 200 });
  } catch (Xchire_error: any) {
    console.error("Error fetching history so:", Xchire_error);
    return NextResponse.json({ success: false, error: Xchire_error.message || "Failed to fetch history so." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
