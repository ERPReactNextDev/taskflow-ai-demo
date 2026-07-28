import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Helper function to get days in a month
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Helper function to calculate prorated target based on date range
function calculateProratedTarget(
  monthlyTarget: number,
  fromDate: Date | null,
  toDate: Date | null
): number {
  if (!fromDate || !toDate) return monthlyTarget;

  const start = new Date(fromDate);
  const end = new Date(toDate);
  
  // Calculate total days in date range
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // If range spans multiple months, we'll handle it by getting each month's target
  // For simplicity, we'll use the first month's target as the base
  const daysInMonth = getDaysInMonth(start.getFullYear(), start.getMonth());
  const dailyTarget = monthlyTarget / daysInMonth;
  
  return Math.round(dailyTarget * totalDays);
}

export async function GET(req: Request) {
  try {
    const url        = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing reference ID." },
        { status: 400 }
      );
    }

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    
    // Use first date in range or current date to determine month/year
    const referenceDate = fromDate || new Date();
    const year = referenceDate.getFullYear().toString();
    const month = MONTH_NAMES[referenceDate.getMonth()];

    const { data, error } = await supabase
      .from("sales_account_development")
      .select("count, target")
      .eq("referenceid", referenceid)
      .eq("month", month)
      .eq("year", year);

    if (error) throw error;

    // Sum up all count and target values
    const totalMonthlyTarget = (data ?? []).reduce((sum, row) => sum + (Number(row.target) || 0), 0);
    const totalTarget = calculateProratedTarget(totalMonthlyTarget, fromDate, toDate);

    return NextResponse.json(
      { success: true, target: totalTarget, month: month, year: year },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error fetching sales account development:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch sales account development." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
