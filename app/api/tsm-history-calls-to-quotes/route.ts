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
    
    // Derive current month in Manila time for default range
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;

    // Use Asia/Manila timezone for date ranges (matches tsm-kpi and tsa-kpi)
    const rangeStart = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const rangeEnd   = to ? `${to}T23:59:59.999+08:00` : `${manilaToday}T23:59:59.999+08:00`;

    let query = supabase.from("history")
      .select("activity_reference_number, source, type_activity")
      .in("referenceid", agentIds)
      .gte("date_created", rangeStart);
    if (to) query = query.lte("date_created", rangeEnd);

    const { data, error } = await query;
    if (error) throw error;

    const groups = new Map<string, { hasOutbound: boolean; hasQuotation: boolean }>();
    data?.forEach(r => {
      if (!r.activity_reference_number) return;
      if (!groups.has(r.activity_reference_number))
        groups.set(r.activity_reference_number, { hasOutbound: false, hasQuotation: false });
      const g = groups.get(r.activity_reference_number)!;
      if (r.source === "Outbound - Touchbase") g.hasOutbound = true;
      if (r.type_activity === "Quotation Preparation") g.hasQuotation = true;
    });

    let count = 0;
    groups.forEach(g => { if (g.hasOutbound && g.hasQuotation) count++; });

    return NextResponse.json({ success: true, count }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
