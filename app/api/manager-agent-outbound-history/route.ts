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
 * GET /api/manager-agent-outbound-history?manager=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns all history rows for TSA agents under the manager within the date range.
 * Mirrors tsm-agent-outbound-history but scoped to Manager instead of TSM.
 * Used by the manager ob-breakdown page so Touchbase and Outbound History tabs
 * share the same data source and totals tally.
 */
export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const from    = url.searchParams.get("from");
    const to      = url.searchParams.get("to");

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    // 1. Get all active TSMs under this manager
    const { data: tsmRows, error: tsmErr } = await supabase
      .from("users")
      .select("ReferenceID")
      .eq("Manager", manager)
      .eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');

    if (tsmErr) throw tsmErr;
    if (!tsmRows || tsmRows.length === 0) {
      return NextResponse.json({ success: true, history: [], agents: [] }, { status: 200 });
    }

    const tsmIds = tsmRows.map((t) => t.ReferenceID);

    // 2. Get all active TSA agents under those TSMs
    const { data: agentRows, error: agentErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname, profilePicture")
      .in("TSM", tsmIds)
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
      Firstname:      a.Firstname      ?? "",
      Lastname:       a.Lastname       ?? "",
      profilePicture: a.profilePicture ?? "",
    }));

    // 2. Build date bounds — Manila +08:00 (same as tsm-agent-outbound-history)
    const now = new Date();
    const startISO = from
      ? `${from}T00:00:00+08:00`
      : (() => {
          const manilaMonth = now
            .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
            .slice(0, 7);
          return `${manilaMonth}-01T00:00:00+08:00`;
        })();
    const endISO = to ? `${to}T23:59:59.999+08:00` : null;

    // 3. Fetch all history rows for those agents in the date range
    let q = supabase
      .from("history")
      .select(
        "referenceid, source, call_status, status, type_activity, actual_sales, quotation_amount, so_amount, start_date, end_date, date_created, activity_reference_number"
      )
      .in("referenceid", agentIds)
      .gte("date_created", startISO);
    if (endISO) q = q.lte("date_created", endISO);

    const history = await fetchAllRows(q);

    return NextResponse.json({ success: true, history, agents }, { status: 200 });
  } catch (err: any) {
    console.error("manager-agent-outbound-history error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch outbound history." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
