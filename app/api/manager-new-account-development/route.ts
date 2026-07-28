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

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function calculateProratedTarget(
  monthlyTarget: number,
  fromDate: Date | null,
  toDate: Date | null
): number {
  if (!fromDate || !toDate) return monthlyTarget;
  const totalDays   = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysInMonth = getDaysInMonth(fromDate.getFullYear(), fromDate.getMonth());
  return Math.round((monthlyTarget / daysInMonth) * totalDays);
}

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const from    = url.searchParams.get("from");
    const to      = url.searchParams.get("to");

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    const fromDate      = from ? new Date(from) : null;
    const toDate        = to   ? new Date(to)   : null;
    const referenceDate = fromDate || new Date();
    const year          = referenceDate.getFullYear().toString();
    const month         = MONTH_NAMES[referenceDate.getMonth()];

    const { data, error } = await supabase
      .from("sales_account_development")
      .select("count, target")
      .eq("manager", manager)
      .eq("month", month)
      .eq("year", year);

    if (error) throw error;

    const totalMonthlyTarget = (data ?? []).reduce((s, r) => s + (Number(r.target) || 0), 0);
    const totalTarget        = calculateProratedTarget(totalMonthlyTarget, fromDate, toDate);

    return NextResponse.json({ success: true, target: totalTarget, month, year }, { status: 200 });
  } catch (err: any) {
    console.error("manager-new-account-development GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
