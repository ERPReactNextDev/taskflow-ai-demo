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
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!tsm) return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });

    const agentIds = await getAgentIds(tsm);
    if (agentIds.length === 0) return NextResponse.json({ success: true, count: 0 }, { status: 200 });

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

    let q = supabase.from("history")
      .select("id", { count: "exact", head: true })
      .in("referenceid", agentIds)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", startDate.toISOString());
    if (finalEndDate) q = q.lte("date_created", finalEndDate.toISOString());

    const { count, error } = await q;
    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
