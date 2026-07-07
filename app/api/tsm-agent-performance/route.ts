import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/**
 * GET /api/tsm-agent-performance?tsm=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns per-agent performance data for all active TSAs under the given TSM:
 * SI actual, SO actual, OB calls, site visits (Login count from tasklog),
 * new account development count, and sales quota (plan).
 *
 * Deliberately isolated from tsm-kpi so that changes here cannot break
 * the KPI weighted scores calculation.
 */
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to   = url.searchParams.get("to");   // YYYY-MM-DD

    if (!tsm) {
      return NextResponse.json(
        { success: false, error: "Missing tsm parameter." },
        { status: 400 }
      );
    }

    // ── 1. Resolve active TSAs under this TSM ─────────────────────────────────
    const { data: agentRows, error: agentErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentErr) throw agentErr;

    const agents = (agentRows ?? []).map((a) => ({
      referenceid: a.ReferenceID as string,
      name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
    }));

    if (agents.length === 0) {
      return NextResponse.json({ success: true, agents: [] }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.referenceid);

    // ── 2. Date scoping ───────────────────────────────────────────────────────
    const now         = new Date();
    const currentYear = now.getFullYear().toString();

    // SI / SO — YTD or selected range
    const siStart = from ? `${from}T00:00:00Z` : `${currentYear}-01-01T00:00:00Z`;
    const siEnd   = to   ? `${to}T23:59:59Z`   : null;

    // OB calls — selected range (or current month if no filter)
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const obStart = from ? `${from}T00:00:00Z`
      : `${currentYear}-${currentMonth}-01T00:00:00Z`;
    const obEnd   = to   ? `${to}T23:59:59Z`   : null;

    // New account dev — selected range (or current month)
    const naStart = from ? `${from}T00:00:00Z`
      : `${currentYear}-${currentMonth}-01T00:00:00Z`;
    const naEnd   = to   ? `${to}T23:59:59Z`
      : `${currentYear}-${currentMonth}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}T23:59:59Z`;

    // Site visits — selected range (or current month), +08:00 timezone (matches fetch-tasklog-supabase)
    const svStart = from ? `${from}T00:00:00+08:00`
      : `${currentYear}-${currentMonth}-01T00:00:00+08:00`;
    const svEnd   = to
      ? `${to}T23:59:59+08:00`
      : `${currentYear}-${currentMonth}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}T23:59:59+08:00`;

    // Quota year
    const quotaYear = from ? new Date(from).getFullYear().toString() : currentYear;

    // ── 3. Parallel queries ───────────────────────────────────────────────────

    // SI (actual sales)
    const siQ = (() => {
      let q = supabase.from("history")
        .select("referenceid, actual_sales")
        .in("referenceid", agentIds)
        .eq("type_activity", "Delivered / Closed Transaction")
        .gte("date_created", siStart);
      if (siEnd) q = q.lte("date_created", siEnd);
      return q;
    })();

    // SO amount
    const soQ = (() => {
      let q = supabase.from("history")
        .select("referenceid, so_amount")
        .in("referenceid", agentIds)
        .eq("status", "SO-Done")
        .gte("date_created", siStart);
      if (siEnd) q = q.lte("date_created", siEnd);
      return q;
    })();

    // OB calls
    const obQ = (() => {
      let q = supabase.from("history")
        .select("referenceid")
        .in("referenceid", agentIds)
        .eq("source", "Outbound - Touchbase")
        .gte("date_created", obStart);
      if (obEnd) q = q.lte("date_created", obEnd);
      return q;
    })();

    // Site visits (tasklog Login entries)
    const svQ = supabase
      .from("tasklog")
      .select(`"ReferenceID", "Status"`)
      .in("ReferenceID", agentIds)
      .gte("date_created", svStart)
      .lte("date_created", svEnd);

    // New account development
    const naQ = supabase
      .from("account_development_plans")
      .select("referenceid")
      .in("referenceid", agentIds)
      .gte("created_at", naStart)
      .lte("created_at", naEnd);

    // Sales quota (annual plan)
    const quotaQ = supabase
      .from("sales_quota")
      .select("referenceid, amount")
      .in("referenceid", agentIds)
      .eq("year", quotaYear);

    const [
      { data: siData  },
      { data: soData  },
      { data: obData  },
      { data: svData  },
      { data: naData  },
      { data: quotaData },
    ] = await Promise.all([siQ, soQ, obQ, svQ, naQ, quotaQ]);

    // ── 4. Aggregate per agent ────────────────────────────────────────────────

    const siMap:    Record<string, number> = {};
    const soMap:    Record<string, number> = {};
    const obMap:    Record<string, number> = {};
    const svMap:    Record<string, number> = {};
    const naMap:    Record<string, number> = {};
    const quotaMap: Record<string, number> = {};

    for (const r of siData    ?? []) siMap[r.referenceid]    = (siMap[r.referenceid]    ?? 0) + (Number(r.actual_sales) || 0);
    for (const r of soData    ?? []) soMap[r.referenceid]    = (soMap[r.referenceid]    ?? 0) + (Number(r.so_amount)    || 0);
    for (const r of obData    ?? []) obMap[r.referenceid]    = (obMap[r.referenceid]    ?? 0) + 1;
    for (const r of svData    ?? []) {
      if (r.Status === "Login") svMap[r.ReferenceID] = (svMap[r.ReferenceID] ?? 0) + 1;
    }
    for (const r of naData    ?? []) naMap[r.referenceid]    = (naMap[r.referenceid]    ?? 0) + 1;
    for (const r of quotaData ?? []) quotaMap[r.referenceid] = (quotaMap[r.referenceid] ?? 0) + (Number(r.amount) || 0);

    // ── 5. Assemble result ────────────────────────────────────────────────────
    const result = agents.map(({ referenceid, name }) => {
      const plan   = quotaMap[referenceid] ?? 0;
      const si     = siMap[referenceid]    ?? 0;
      const so     = soMap[referenceid]    ?? 0;
      const siPct  = plan > 0 ? Math.round((si / plan) * 100) : 0;

      return {
        referenceid,
        name,
        plan,
        siActual:           si,
        soActual:           so,
        siPercentage:       siPct,
        obCalls:            obMap[referenceid] ?? 0,
        siteVisits:         svMap[referenceid] ?? 0,
        accountDevelopment: naMap[referenceid] ?? 0,
      };
    });

    return NextResponse.json({ success: true, agents: result }, { status: 200 });
  } catch (err: any) {
    console.error("tsm-agent-performance error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch agent performance." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
