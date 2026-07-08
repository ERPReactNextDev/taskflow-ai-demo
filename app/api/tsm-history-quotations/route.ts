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

    let query = supabase.from("history")
      .select("quotation_number")
      .in("referenceid", agentIds)
      .eq("type_activity", "Quotation Preparation")
      .eq("status", "Quote-Done")
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
