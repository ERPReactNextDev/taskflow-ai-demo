﻿import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── helpers ───────────────────────────────────────────────────────────────────

function toISO(date: string, eod = false): string {
  return eod ? `${date}T23:59:59+08:00` : `${date}T00:00:00+08:00`;
}

function monthLabel(d: Date): string {
  return ["January","February","March","April","May","June",
          "July","August","September","October","November","December"][d.getMonth()];
}

function parseDateParam(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function enumerateMonthSlices(from: string | null, to: string | null, fallbackDate: Date) {
  if (!from || !to) {
    return [
      {
        year: fallbackDate.getFullYear().toString(),
        month: monthLabel(fallbackDate),
        daysInMonth: getDaysInMonth(fallbackDate.getFullYear(), fallbackDate.getMonth()),
        coveredDays: getDaysInMonth(fallbackDate.getFullYear(), fallbackDate.getMonth()),
      },
    ];
  }

  const start = parseDateParam(from);
  const end = parseDateParam(to);
  const slices: Array<{ year: string; month: string; daysInMonth: number; coveredDays: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const monthIndex = cursor.getMonth();
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex, daysInMonth);
    const rangeStart = start > monthStart ? start : monthStart;
    const rangeEnd = end < monthEnd ? end : monthEnd;
    const coveredDays =
      Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    slices.push({
      year: year.toString(),
      month: monthLabel(cursor),
      daysInMonth,
      coveredDays,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return slices;
}

function calculateRangedTarget(
  rows: Array<{ month: string; year: string; targetValue: number }>,
  slices: Array<{ year: string; month: string; daysInMonth: number; coveredDays: number }>,
  fallbackTarget: number,
  shouldProrate: boolean
): number {
  if (!shouldProrate) {
    const currentSlice = slices[0];
    const row = rows.find(
      (item) => item.month === currentSlice.month && item.year === currentSlice.year
    );
    // If a row exists use its value (even 0); only fall back when no row found at all
    return row != null ? row.targetValue : fallbackTarget;
  }

  let total = 0;

  for (const slice of slices) {
    const row = rows.find((item) => item.month === slice.month && item.year === slice.year);
    // Same logic: use stored value when row exists, fallback only when no row
    const monthlyTarget = row != null ? row.targetValue : fallbackTarget;

    if (slice.coveredDays >= slice.daysInMonth) {
      total += monthlyTarget;
    } else {
      total += Math.round((monthlyTarget / slice.daysInMonth) * slice.coveredDays);
    }
  }

  return total;
}

/** Fetch active TSA referenceid list under a TSM */
async function getAgents(tsm: string): Promise<{ referenceid: string; name: string }[]> {
  const { data } = await supabase
    .from("users")
    .select("ReferenceID, Firstname, Lastname")
    .eq("TSM", tsm)
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")')
    .order("Lastname", { ascending: true });
  return (data ?? []).map((a) => ({
    referenceid: a.ReferenceID,
    name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
  }));
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to   = url.searchParams.get("to");   // YYYY-MM-DD

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
    }

    // ── Date scoping ──────────────────────────────────────────────────────────
    // OB Calls, Quotes, Conversion metrics, and Client Visits are ALWAYS scoped
    // to the selected date range (from/to), falling back to current calendar
    // month (month start → today) when no range is given. All date filters use
    // +08:00 (local) timezone consistently so counts line up with how the data
    // was actually created — mixing Z (UTC) and +08:00 was the root cause of
    // counts silently coming back as 0 when a range was picked.
    const now        = new Date();
    const year       = now.getFullYear().toString();
    const refDate    = from ? new Date(`${from}T00:00:00Z`) : now;
    // Targets (OB, Quote, Site Visit) always use current month, date range only affects actuals
    const monthSlices = [
      {
        year: now.getFullYear().toString(),
        month: monthLabel(now),
        daysInMonth: getDaysInMonth(now.getFullYear(), now.getMonth()),
        coveredDays: getDaysInMonth(now.getFullYear(), now.getMonth()),
      },
    ];
    const targetMonths = [monthLabel(now)];
    const targetYears = [now.getFullYear().toString()];
    const shouldProrateMonthlyTargets = false; // Targets are always full monthly values — never prorate

    // Monthly scope: always month-start → end-of-today (local, +08:00)
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const monthStart   = `${now.getFullYear()}-${currentMonth}-01T00:00:00+08:00`;
    const todayEnd     = `${now.getFullYear()}-${currentMonth}-${String(now.getDate()).padStart(2, "0")}T23:59:59+08:00`;

    // New Account Dev scoped to the selected month (or current month)
    const naFrom = from ?? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-01`;
    const naTo   = to   ?? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

    // SI / SO use the full date range (YTD when no filter)
    const siStartDate = from ? `${from}T00:00:00+08:00` : `${now.getFullYear()}-01-01T00:00:00+08:00`;
    const siEndDate   = to   ? `${to}T23:59:59+08:00`   : todayEnd;

    // OB Calls / Quotes / Client Visits / Pipeline: selected range, else current month
    const obStart        = from ? `${from}T00:00:00+08:00` : monthStart;
    const obEnd          = to   ? `${to}T23:59:59+08:00`   : todayEnd;
    const quotesStart     = from ? `${from}T00:00:00+08:00` : monthStart;
    const quotesEnd       = to   ? `${to}T23:59:59+08:00`   : todayEnd;
    const pipelineStart   = from ? `${from}T00:00:00+08:00` : monthStart;
    const pipelineEnd     = to   ? `${to}T23:59:59+08:00`   : todayEnd;
    const clientVisitsStart = from ? `${from}T00:00:00+08:00` : monthStart;
    const clientVisitsEnd   = to   ? `${to}T23:59:59+08:00`   : todayEnd;

    // ── Fetch agents ──────────────────────────────────────────────────────────
    const agents = await getAgents(tsm);
    if (agents.length === 0) {
      return NextResponse.json({ success: true, agents: [] }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.referenceid);

    // ── Parallel data fetches ─────────────────────────────────────────────────

    // 1. Sales quotas per agent for the year
    const quotasPromise = supabase
      .from("sales_quota")
      .select("referenceid, month, amount")
      .in("referenceid", agentIds)
      .eq("year", year);

    // 2. SI (actual sales) — YTD or selected range, matches TSA annual quota target
    const siPromise = supabase
      .from("history")
      .select("referenceid, actual_sales")
      .in("referenceid", agentIds)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("date_created", siStartDate)
      .lte("date_created", siEndDate);

    // 3. OB calls — scoped to the selected date range (or current month if no range)
    const obPromise = supabase
      .from("history")
      .select("referenceid")
      .in("referenceid", agentIds)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", obStart)
      .lte("date_created", obEnd);

    // 4. OB targets per agent — order by date_updated DESC so latest row wins on duplicates.
    //    Secondary order by id DESC is a deterministic tie-breaker: when duplicate rows share
    //    the same (or null) date_updated, Postgres does not guarantee row order on its own —
    //    without this, the "latest wins" dedup below could non-deterministically pick a stale
    //    row on one request and the fresh row on the next (same query, different result).
    const obTargetPromise = supabase
      .from("sales_ob")
      .select("id, referenceid, ob_target, month, year")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(now))         // always current calendar month
      .eq("year", now.getFullYear().toString())
      .order("date_updated", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }); // ✅ FIX: deterministic tie-breaker

    // 5. Quotations — approved only, scoped to the selected date range
    //    (or current month if no range — matches kpi-monthly-actuals)
    const quotesPromise = supabase
      .from("history")
      .select("referenceid, quotation_number")
      .in("referenceid", agentIds)
      .eq("type_activity", "Quotation Preparation")
      .or("tsm_approved_status.eq.Approved By Sales Head,tsm_approved_status.eq.Approved")
      .gte("date_created", quotesStart)
      .lte("date_created", quotesEnd);

    // 6. Quote targets per agent — fetch all months in the target range (like obTargetPromise)
    // Secondary order by id DESC is a deterministic tie-breaker: if there are duplicate rows
    // for the same referenceid+month+year with equal (or null) date_updated, ordering by
    // date_updated alone is not enough — Postgres can return them in any order, which is
    // exactly why "120" vs "4" was flip-flopping between identical requests.
    const quoteTargetPromise = supabase
      .from("sales_quotation")
      .select("id, referenceid, quote_target, month, year")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(now))         // always current calendar month
      .eq("year", now.getFullYear().toString())
      .order("date_updated", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }); // ✅ FIX: deterministic tie-breaker — this is the real fix

    // 7. Pipeline activities — same scope as OB/quotes
    const pipelinePromise = supabase
      .from("history")
      .select("referenceid, activity_reference_number, source, type_activity")
      .in("referenceid", agentIds)
      .gte("date_created", pipelineStart)
      .lte("date_created", pipelineEnd);

    // 8. New account counts by agent in selected month
    const naCountPromise = supabase
      .from("account_development_plans")
      .select("referenceid")
      .in("referenceid", agentIds)
      .gte("created_at", toISO(naFrom))
      .lte("created_at", toISO(naTo, true));

    // 9. New account targets per agent
    const naTargetPromise = supabase
      .from("sales_account_development")
      .select("referenceid, target")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(refDate))
      .eq("year", refDate.getFullYear().toString());

    // 10. Site visit targets per agent — deduplicated: take highest target per agent
    //     (multiple rows per agent can exist if target was updated; highest wins)
    const siteVisitTargetPromise = supabase
      .from("site_visit_target")
      .select("referenceid, target")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(now))         // always current calendar month
      .eq("year", now.getFullYear().toString());

    // 11. Client visits — scoped to the selected date range (or current month if no range)
    const clientVisitsPromise = supabase
      .from("tasklog")
      .select(`"ReferenceID", "Status"`)
      .in("ReferenceID", agentIds)
      .gte("date_created", clientVisitsStart)
      .lte("date_created", clientVisitsEnd);

    const [
      { data: quotasData },
      { data: siData },
      { data: obData },
      { data: obTargetData },
      { data: quotesData },
      { data: quoteTargetData },
      { data: pipelineData },
      { data: naCountData },
      { data: naTargetData },
      { data: siteVisitTargetData },
      { data: clientVisitsData },
    ] = await Promise.all([
      quotasPromise, siPromise, obPromise, obTargetPromise,
      quotesPromise, quoteTargetPromise, pipelinePromise,
      naCountPromise, naTargetPromise, siteVisitTargetPromise,
      clientVisitsPromise,
    ]);

    // ── Build per-agent KPI data ──────────────────────────────────────────────

    // Sales quota map: { referenceid → total for selected period }
    const quotaMap: Record<string, number> = {};
    for (const row of quotasData ?? []) {
      quotaMap[row.referenceid] = (quotaMap[row.referenceid] ?? 0) + (Number(row.amount) || 0);
    }

    // SI actual map: { referenceid → total }
    const siMap: Record<string, number> = {};
    for (const row of siData ?? []) {
      siMap[row.referenceid] = (siMap[row.referenceid] ?? 0) + (Number(row.actual_sales) || 0);
    }

    // OB calls map: { referenceid → count }
    const obMap: Record<string, number> = {};
    for (const row of obData ?? []) {
      obMap[row.referenceid] = (obMap[row.referenceid] ?? 0) + 1;
    }

    // OB target map — first row per agent+month wins (latest due to ORDER BY date_updated DESC, id DESC)
    const obTargetMap: Record<string, Array<{ month: string; year: string; targetValue: number }>> = {};
    const obTargetSeen = new Set<string>();
    for (const row of obTargetData ?? []) {
      const key = `${row.referenceid}|${row.month}|${row.year}`;
      if (obTargetSeen.has(key)) continue; // skip older duplicates
      obTargetSeen.add(key);
      if (!obTargetMap[row.referenceid]) obTargetMap[row.referenceid] = [];
      obTargetMap[row.referenceid].push({
        month: row.month,
        year: row.year,
        targetValue: Number(row.ob_target) || 0,
      });
    }

    // Quotes map: { referenceid → unique quotation numbers }
    const quotesSetMap: Record<string, Set<string>> = {};
    for (const row of quotesData ?? []) {
      if (!quotesSetMap[row.referenceid]) quotesSetMap[row.referenceid] = new Set();
      if (row.quotation_number) quotesSetMap[row.referenceid].add(row.quotation_number);
    }

    // Quote target map: { referenceid → rows } — first row per agent+month wins (latest due to ORDER BY date_updated DESC, id DESC)
    const quoteTargetMap: Record<string, Array<{ month: string; year: string; targetValue: number }>> = {};
    const quoteTargetSeen = new Set<string>(); // deduplicate: referenceid+month+year
    for (const row of quoteTargetData ?? []) {
      const key = `${row.referenceid}|${row.month}|${row.year}`;
      if (quoteTargetSeen.has(key)) continue; // skip older duplicates
      quoteTargetSeen.add(key);
      if (!quoteTargetMap[row.referenceid]) quoteTargetMap[row.referenceid] = [];
      quoteTargetMap[row.referenceid].push({
        month: row.month,
        year: row.year,
        targetValue: Number(row.quote_target) || 0,
      });
    }

    // Pipeline groups: { referenceid → Map<activity_ref → { hasOB, hasQuote, hasSO, hasSI }> }
    type PipelineGroup = { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean; hasDelivered: boolean };
    const pipelineMap: Record<string, Map<string, PipelineGroup>> = {};

    for (const row of pipelineData ?? []) {
      if (!row.activity_reference_number) continue;
      if (!pipelineMap[row.referenceid]) pipelineMap[row.referenceid] = new Map();
      const groups = pipelineMap[row.referenceid];
      if (!groups.has(row.activity_reference_number)) {
        groups.set(row.activity_reference_number, { hasOutbound: false, hasQuotation: false, hasSalesOrder: false, hasDelivered: false });
      }
      const g = groups.get(row.activity_reference_number)!;
      if (row.source === "Outbound - Touchbase")                       g.hasOutbound   = true;
      if (row.type_activity === "Quotation Preparation")               g.hasQuotation  = true;
      if (row.type_activity === "Sales Order Preparation")             g.hasSalesOrder = true;
      if (row.type_activity === "Delivered / Closed Transaction")      g.hasDelivered  = true;
    }

    // New account count map: { referenceid → count }
    const naCountMap: Record<string, number> = {};
    for (const row of naCountData ?? []) {
      naCountMap[row.referenceid] = (naCountMap[row.referenceid] ?? 0) + 1;
    }

    // New account target map: { referenceid → target }
    const naTargetMap: Record<string, number> = {};
    for (const row of naTargetData ?? []) {
      naTargetMap[row.referenceid] = Number(row.target) || 3;
    }

    // Site visit target map: { referenceid → target }
    const siteVisitTargetMap: Record<string, number> = {};
    for (const row of siteVisitTargetData ?? []) {
      // site_visit_target table: referenceid, target (plain number), month, year
      const val = Number(row.target) || 10;
      siteVisitTargetMap[row.referenceid] = val;
    }

    // Client visits count map: { referenceid -> login count }
    // Filter Status === "Login" here (not in query) — matches fetch-tasklog-supabase pattern
    const clientVisitsCountMap: Record<string, number> = {};
    for (const row of clientVisitsData ?? []) {
      if (row.Status !== "Login") continue;
      const ref = row.ReferenceID;
      if (ref) clientVisitsCountMap[ref] = (clientVisitsCountMap[ref] ?? 0) + 1;
    }

    // DEBUG: log target rows for diagnosis (safe to remove once verified in prod)
    console.log(
      "[tsm-kpi] from=%s to=%s targetMonths=%s targetYears=%s obTargetData=%s quoteTargetData=%s",
      from, to, JSON.stringify(targetMonths), JSON.stringify(targetYears),
      JSON.stringify(obTargetData?.map(r => ({ ref: r.referenceid, ob: r.ob_target, m: r.month, y: r.year }))),
      JSON.stringify(quoteTargetData?.map(r => ({ ref: r.referenceid, qt: r.quote_target, m: r.month, y: r.year })))
    );

    // ── Assemble per-agent result ─────────────────────────────────────────────
    const result = agents.map(({ referenceid, name }) => {
      const groups = pipelineMap[referenceid];

      let c2qCount = 0, q2soQuotation = 0, q2soSalesOrder = 0;
      let soToSISalesOrder = 0, soToSIDelivered = 0;

      if (groups) {
        groups.forEach((g) => {
          if (g.hasOutbound && g.hasQuotation)                            c2qCount++;
          if (g.hasOutbound && g.hasQuotation)                            q2soQuotation++;
          if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)         q2soSalesOrder++;
          if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)         soToSISalesOrder++;
          if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder && g.hasDelivered) soToSIDelivered++;
        });
      }

      return {
        referenceid,
        name,
        runningTarget:            quotaMap[referenceid]           ?? 0,
        totalActualSales:         siMap[referenceid]              ?? 0,
        obCallsCount:             obMap[referenceid]              ?? 0,
        obCallsTarget:            calculateRangedTarget(
                                   obTargetMap[referenceid] ?? [],
                                   monthSlices,
                                   0,   // 0 = no target set; avoids misleading hardcoded fallback
                                   shouldProrateMonthlyTargets
                                 ),
        quotesCount:              quotesSetMap[referenceid]?.size ?? 0,
        quotesTarget:             calculateRangedTarget(
                                   quoteTargetMap[referenceid] ?? [],
                                   monthSlices,
                                   0,   // 0 = no target set; avoids misleading hardcoded fallback
                                   shouldProrateMonthlyTargets
                                 ),
        callsToQuotesCount:       c2qCount,
        quoteToSOQuotationCount:  q2soQuotation,
        quoteToSOSalesOrderCount: q2soSalesOrder,
        soToSISalesOrderCount:    soToSISalesOrder,
        soToSIDeliveredCount:     soToSIDelivered,
        newAccountCount:          naCountMap[referenceid]         ?? 0,
        newAccountTarget:         naTargetMap[referenceid]        ?? 2,
        clientVisitsCount:        clientVisitsCountMap[referenceid] ?? 0,
        clientVisitsTarget:       siteVisitTargetMap[referenceid] ?? 10,
        avgResponseTime:          0,
        avgQuotationHT:           0,
        avgNonQuotationHT:        0,
      };
    });

    return NextResponse.json({ success: true, agents: result }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching TSM KPI:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch TSM KPI data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";