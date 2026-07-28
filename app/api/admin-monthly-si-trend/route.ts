import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const PAGE_SIZE = 1000;
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

async function getAllAgentIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("users").select("ReferenceID")
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');
  if (error) throw error;
  return (data ?? []).map((a) => a.ReferenceID).filter(Boolean);
}

// GET /api/admin-monthly-si-trend?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=weekly
export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const from        = url.searchParams.get("from");
    const to          = url.searchParams.get("to");
    const granularity = url.searchParams.get("granularity");

    const agentIds = await getAllAgentIds();

    const currentYear = new Date().getFullYear();
    const startDate   = from || `${currentYear}-01-01`;
    const endDate     = to   || null;

    if (agentIds.length === 0) {
      const endM   = to   ? new Date(to).getMonth()   : new Date().getMonth();
      const startM = from ? new Date(from).getMonth() : 0;
      return NextResponse.json({
        success: true,
        months: MONTH_NAMES.slice(startM, endM + 1).map((m) => ({ month: m, total: 0 })),
        weeks: null,
      }, { status: 200 });
    }

    let q = supabase.from("history")
      .select("actual_sales, delivery_date")
      .in("referenceid", agentIds)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("delivery_date", startDate);
    if (endDate) q = q.lte("delivery_date", endDate);

    const data = await fetchAllRows(q);

    // Weekly
    if (granularity === "weekly") {
      const weekTotals: Record<string, number> = { W1:0, W2:0, W3:0, W4:0, W5:0 };
      for (const r of data) {
        const d = new Date(r.delivery_date);
        if (isNaN(d.getTime())) continue;
        const day  = d.getDate();
        const week = day<=7?"W1":day<=14?"W2":day<=21?"W3":day<=28?"W4":"W5";
        weekTotals[week] += Number(r.actual_sales) || 0;
      }
      return NextResponse.json({
        success: true, months: null,
        weeks: ["W1","W2","W3","W4","W5"].map((w) => ({ week: w, total: weekTotals[w] })),
      }, { status: 200 });
    }

    // Monthly
    const monthlyTotals = new Array(12).fill(0);
    for (const r of data) {
      const d = new Date(r.delivery_date);
      if (isNaN(d.getTime())) continue;
      monthlyTotals[d.getMonth()] += Number(r.actual_sales) || 0;
    }

    const endLimit   = to   ? new Date(to).getMonth()   : new Date().getMonth();
    const startLimit = from ? new Date(from).getMonth() : 0;
    const months = MONTH_NAMES.slice(startLimit, endLimit + 1).map((name, i) => ({
      month: name,
      total: monthlyTotals[startLimit + i],
    }));

    return NextResponse.json({ success: true, months, weeks: null }, { status: 200 });
  } catch (err: any) {
    console.error("admin-monthly-si-trend error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
