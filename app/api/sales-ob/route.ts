import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Sum targets across every month that falls within [fromDate, toDate].
 * For months that are only partially covered, prorate by day.
 * If no date range is provided, return the single monthly target as-is.
 */
async function calculateRangedTarget(
  referenceid: string,
  fromDate: Date | null,
  toDate: Date | null,
  fallbackTarget: number
): Promise<number> {
  // No range → return the current month's target without proration
  if (!fromDate || !toDate) {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = monthNames[now.getMonth()];
    const { data } = await supabase
      .from("sales_ob")
      .select("ob_target")
      .eq("referenceid", referenceid)
      .eq("month", month)
      .eq("year", year)
      .single();
    return Number(data?.ob_target) || fallbackTarget;
  }

  const from = new Date(fromDate);
  const to = new Date(toDate);

  // Iterate month by month from `from` to `to`
  let total = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor <= to) {
    const year = cursor.getFullYear().toString();
    const month = monthNames[cursor.getMonth()];
    const daysInMonth = getDaysInMonth(cursor.getFullYear(), cursor.getMonth());

    // Clamp the range to this month's boundaries
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd   = new Date(cursor.getFullYear(), cursor.getMonth(), daysInMonth);
    const rangeFrom  = from > monthStart ? from : monthStart;
    const rangeTo    = to   < monthEnd   ? to   : monthEnd;
    const coveredDays = Math.round((rangeTo.getTime() - rangeFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { data } = await supabase
      .from("sales_ob")
      .select("ob_target")
      .eq("referenceid", referenceid)
      .eq("month", month)
      .eq("year", year)
      .single();

    const monthlyTarget = Number(data?.ob_target) || fallbackTarget;

    // If the entire month is covered, add the full monthly target;
    // otherwise prorate by covered days
    if (coveredDays >= daysInMonth) {
      total += monthlyTarget;
    } else {
      total += Math.round((monthlyTarget / daysInMonth) * coveredDays);
    }

    // Advance to the next month
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return total;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing reference ID." },
        { status: 400 }
      );
    }

    const fromDate = from ? new Date(from) : null;
    const toDate   = to   ? new Date(to)   : null;

    const target = await calculateRangedTarget(referenceid, fromDate, toDate, 5);

    return NextResponse.json({ success: true, target }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching sales ob target:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch sales ob target." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
