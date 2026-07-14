import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const PAGE_SIZE = 1000;

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

/**
 * GET /api/tsm-agent-outbound-history?tsm=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns all history rows for agents under the TSM within the date range,
 * filtered to outbound-related sources + all activities needed for conversion tracing.
 * Also returns agent list with profile pictures.
 */
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!tsm) return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });

    // 1. Get agents + profile pictures
    const { data: agentRows, error: agentErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname, profilePicture")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentErr) throw agentErr;
    if (!agentRows || agentRows.length === 0) {
      return NextResponse.json({ success: true, history: [], agents: [] }, { status: 200 });
    }

    const agentIds = agentRows.map((a) => a.ReferenceID);

    const agents = agentRows.map((a) => ({
      ReferenceID:    a.ReferenceID,
      Firstname:      a.Firstname ?? "",
      Lastname:       a.Lastname  ?? "",
      profilePicture: a.profilePicture ?? "",
    }));

    // 2. Build date bounds — Manila +08:00 to match tsm-history-outbound exactly
    const now = new Date();
    const startISO = from ? `${from}T00:00:00+08:00` : (() => {
      const manilaMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
      return `${manilaMonth}-01T00:00:00+08:00`;
    })();
    const endISO = to ? `${to}T23:59:59.999+08:00` : null;

    // 3. Fetch all relevant history rows — history table only, by referenceid (same as tsm-history-outbound)
    let q = supabase
      .from("history")
      .select("referenceid, source, call_status, status, type_activity, actual_sales, quotation_amount, so_amount, start_date, end_date, date_created, activity_reference_number")
      .in("referenceid", agentIds)
      .gte("date_created", startISO);
    if (endISO) q = q.lte("date_created", endISO);

    const history = await fetchAllRows(q);

    return NextResponse.json({ success: true, history, agents }, { status: 200 });
  } catch (err: any) {
    console.error("tsm-agent-outbound-history error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch outbound history." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
