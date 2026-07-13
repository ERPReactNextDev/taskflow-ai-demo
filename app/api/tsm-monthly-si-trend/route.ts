import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/** Fetch all rows from Supabase (handles pagination for large datasets) */
async function fetchAllRows<T = any>(query: any): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allData: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allData;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * GET /api/tsm-monthly-si-trend?tsm=<tsmId>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns month-by-month SI (Delivered / Closed Transaction) totals for
 * all active TSAs under the given TSM, aggregated as a team total.
 *
 * Response shape: { success: true, months: [{ month: "Jan", total: number }, ...] }
 */
export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const tsm         = url.searchParams.get("tsm");
    const from        = url.searchParams.get("from");
    const to          = url.searchParams.get("to");
    const granularity = url.searchParams.get("granularity"); // "weekly" | null

    if (!tsm) {
      return NextResponse.json(
        { success: false, error: "Missing tsm parameter." },
        { status: 400 }
      );
    }

    // 1. Resolve active TSA agent IDs under this TSM
    const { data: agentRows, error: agentError } = await supabase
      .from("users")
      .select("ReferenceID")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');

    if (agentError) throw agentError;

    const agentIds = (agentRows ?? []).map((a) => a.ReferenceID).filter(Boolean);

    const currentYear = new Date().getFullYear();
    const startDate   = from ? from : `${currentYear}-01-01`;
    const endDate     = to   ? to : null;

    if (agentIds.length === 0) {
      const endMonth   = to   ? new Date(to).getMonth()   : new Date().getMonth();
      const startMonth = from ? new Date(from).getMonth() : 0;
      const months = MONTH_NAMES.slice(startMonth, endMonth + 1).map((name) => ({ month: name, total: 0 }));
      return NextResponse.json({ success: true, months, weeks: null }, { status: 200 });
    }

    // 2. Fetch Delivered / Closed Transaction records
    let query = supabase
      .from("history")
      .select("actual_sales, delivery_date")
      .in("referenceid", agentIds)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("delivery_date", startDate);

    if (endDate) query = query.lte("delivery_date", endDate);

    const data = await fetchAllRows(query);

    // 3a. Weekly granularity — bucket by week-of-month
    if (granularity === "weekly") {
      const weekTotals: Record<string, number> = { W1: 0, W2: 0, W3: 0, W4: 0, W5: 0 };
      for (const record of data ?? []) {
        const date = new Date(record.delivery_date);
        if (isNaN(date.getTime())) continue;
        const day   = date.getDate();
        const week  = day <= 7 ? "W1" : day <= 14 ? "W2" : day <= 21 ? "W3" : day <= 28 ? "W4" : "W5";
        weekTotals[week] += Number(record.actual_sales) || 0;
      }
      const weeks = ["W1","W2","W3","W4","W5"].map((w) => ({ week: w, total: weekTotals[w] }));
      return NextResponse.json({ success: true, months: null, weeks }, { status: 200 });
    }

    // 3b. Monthly granularity (default)
    const monthlyTotals = new Array(12).fill(0);
    for (const record of data ?? []) {
      const date = new Date(record.delivery_date);
      if (isNaN(date.getTime())) continue;
      monthlyTotals[date.getMonth()] += Number(record.actual_sales) || 0;
    }

    const endLimit   = to   ? new Date(to).getMonth()   : new Date().getMonth();
    const startLimit = from ? new Date(from).getMonth() : 0;
    const months = MONTH_NAMES.slice(startLimit, endLimit + 1).map((name, i) => ({
      month: name,
      total: monthlyTotals[startLimit + i],
    }));

    return NextResponse.json({ success: true, months, weeks: null }, { status: 200 });
  } catch (err: any) {
    console.error("tsm-monthly-si-trend error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch TSM monthly SI trend." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
