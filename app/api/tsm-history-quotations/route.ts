import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

async function getAgentIds(tsm: string): Promise<string[]> {
  const { data } = await supabase.from("users").select("ReferenceID")
    .eq("TSM", tsm).eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');
  return (data ?? []).map((a) => a.ReferenceID);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tsm = url.searchParams.get("tsm");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!tsm) return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });

    const agentIds = await getAgentIds(tsm);
    if (agentIds.length === 0) return NextResponse.json({ success: true, count: 0 }, { status: 200 });

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

    let query = supabase.from("history")
      .select("quotation_number")
      .in("referenceid", agentIds)
      .eq("type_activity", "Quotation Preparation")
      .eq("status", "Quote-Done")
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
