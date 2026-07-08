﻿﻿import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { connectToDatabase } from "@/lib/mongodb";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Fetch all rows from Supabase (handles pagination for large datasets) */
async function fetchAllRows<T = any>(
  query: any
): Promise<T[]> {
  const PAGE_SIZE = 1000; // Supabase's default max is 1000
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

function monthLabel(d: Date): string {
  return ["January","February","March","April","May","June",
          "July","August","September","October","November","December"][d.getMonth()];
}

function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
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

/** Calculate CSR metrics for an agent */
async function calculateCsrMetrics(
  referenceid: string,
  fromDate: Date,
  toDate: Date
): Promise<{
  avgResponseTime: number;
  avgQuotationHT: number;
  avgNonQuotationHT: number;
}> {
  try {
    const db = await connectToDatabase();
    const collection = db.collection("activity");

    const filter = {
      $or: [
        { referenceid: referenceid },
        { agent: referenceid },
      ],
    };

    const data = await collection.find(filter).toArray();

    const excluded = [
      "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
      "Supplier/Vendor Product Offer", "Internal Whistle Blower",
      "Threats/Extortion/Intimidation", "Prank Call",
    ];

    const fromTs = fromDate.getTime();
    const toDateObj = new Date(toDate);
    toDateObj.setHours(23, 59, 59, 999);
    const toTs = toDateObj.getTime();

    let rtTotal = 0, rtCount = 0;
    let nqTotal = 0, nqCount = 0;
    let qTotal = 0, qCount = 0;

    data.forEach((row: any) => {
      if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
      const created = new Date(row.date_created).getTime();
      if (isNaN(created) || created < fromTs || created > toTs) return;
      if (excluded.includes(row.wrap_up)) return;

      const tsaAck = new Date(row.tsa_acknowledge_date).getTime();
      const endorsed = new Date(row.ticket_endorsed).getTime();
      if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
        rtTotal += (tsaAck - endorsed) / 3600000;
        rtCount++;
      }

      const received = new Date(row.ticket_received).getTime();
      const tsaHandle = new Date(row.tsa_handling_time).getTime();
      const tsmHandle = new Date(row.tsm_handling_time).getTime();
      let baseHT = 0;
      if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received)
        baseHT = (tsaHandle - received) / 3600000;
      else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received)
        baseHT = (tsmHandle - received) / 3600000;
      if (!baseHT) return;

      const remarks = (row.remarks || "").toUpperCase();
      if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
        qTotal += baseHT; qCount++;
      } else {
        nqTotal += baseHT; nqCount++;
      }
    });

    return {
      avgResponseTime: rtCount ? rtTotal / rtCount : 0,
      avgQuotationHT: qCount ? qTotal / qCount : 0,
      avgNonQuotationHT: nqCount ? nqTotal / nqCount : 0,
    };
  } catch (err) {
    console.error("Error calculating CSR metrics for", referenceid, err);
    return { avgResponseTime: 0, avgQuotationHT: 0, avgNonQuotationHT: 0 };
  }
}

/** Fetch active TSA referenceid list under a TSM */
async function getAgents(tsm: string): Promise<{ referenceid: string; name: string }[]> {
  const query = supabase
    .from("users")
    .select("ReferenceID, Firstname, Lastname")
    .eq("TSM", tsm)
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")')
    .order("Lastname", { ascending: true });
  const data = await fetchAllRows(query);
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
    const now         = new Date();
    const year        = now.getFullYear().toString();
    const refDate     = from ? new Date(from) : now;
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

    // Monthly scope: always month-start → end-of-today (date only)
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const monthStartDate   = `${now.getFullYear()}-${currentMonth}-01`;
    const todayDate         = `${now.getFullYear()}-${currentMonth}-${String(now.getDate()).padStart(2, "0")}`;

    // New Account Dev scoped to the selected month (or current month)
    const naFrom = from ?? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-01`;
    const naTo   = to ?? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

    // SI / SO use the full date range (YTD when no filter)
    const siStart = from ? `${from}T00:00:00Z` : `${now.getFullYear()}-01-01T00:00:00Z`;
    const siEnd   = to ? `${to}T23:59:59Z` : `${todayDate}T23:59:59Z`;

    // OB Calls / Quotes / Pipeline: selected range, else current month
    const obStart = from ? `${from}T00:00:00Z` : `${monthStartDate}T00:00:00Z`;
    const obEnd   = to ? `${to}T23:59:59Z` : `${todayDate}T23:59:59Z`;
    const quotesStart = from ? `${from}T00:00:00Z` : `${monthStartDate}T00:00:00Z`;
    const quotesEnd   = to ? `${to}T23:59:59Z` : `${todayDate}T23:59:59Z`;
    const pipelineStart = from ? `${from}T00:00:00Z` : `${monthStartDate}T00:00:00Z`;
    const pipelineEnd   = to ? `${to}T23:59:59Z` : `${todayDate}T23:59:59Z`;

    // Client Visits (tasklog): use +08:00 timezone like fetch-tasklog-supabase
    const clientVisitsStart = from ? `${from}T00:00:00+08:00` : `${monthStartDate}T00:00:00+08:00`;
    const clientVisitsEnd   = to ? `${to}T23:59:59+08:00` : `${todayDate}T23:59:59+08:00`;

    // ── Fetch agents ──────────────────────────────────────────────────────────
    const agents = await getAgents(tsm);
    if (agents.length === 0) {
      return NextResponse.json({ success: true, agents: [] }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.referenceid);

    // ── Parallel data fetches ─────────────────────────────────────────────────

    // 1. Sales quotas per agent for the year
    const quotasQuery = supabase
      .from("sales_quota")
      .select("referenceid, month, amount")
      .in("referenceid", agentIds)
      .eq("year", year);

    // 2. SI (actual sales) — YTD or selected range, matches TSA annual quota target
    const siQuery = supabase
      .from("history")
      .select("referenceid, actual_sales")
      .in("referenceid", agentIds)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("date_created", siStart)
      .lte("date_created", siEnd);

    // 3. OB calls — scoped to the selected date range (or current month if no range)
    const obQuery = supabase
      .from("history")
      .select("referenceid")
      .in("referenceid", agentIds)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", obStart)
      .lte("date_created", obEnd);

    // 4. OB targets per agent — order by date_created DESC so latest row wins on duplicates.
    //    Secondary order by id DESC is a deterministic tie-breaker: when duplicate rows share
    //    the same (or null) date_created, Postgres does not guarantee row order on its own —
    //    without this, the "latest wins" dedup below could non-deterministically pick a stale
    //    row on one request and the fresh row on the next (same query, different result).
    const obTargetQuery = supabase
      .from("sales_ob")
      .select("id, referenceid, ob_target, month, year")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(now))         // always current calendar month
      .eq("year", now.getFullYear().toString())
      .order("date_created", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }); // ✅ FIX: deterministic tie-breaker

    // 5. Quotations — approved only, scoped to the selected date range
    //    (or current month if no range — matches kpi-monthly-actuals)
    const quotesQuery = supabase
      .from("history")
      .select("referenceid, quotation_number")
      .in("referenceid", agentIds)
      .eq("type_activity", "Quotation Preparation")
      .eq("status", "Quote-Done")
      .gte("date_created", quotesStart)
      .lte("date_created", quotesEnd);

    // 6. Quote targets per agent — fetch all months in the target range (like obTargetPromise)
    // Secondary order by id DESC is a deterministic tie-breaker: if there are duplicate rows
    // for the same referenceid+month+year with equal (or null) date_created, ordering by
    // date_created alone is not enough — Postgres can return them in any order, which is
    // exactly why "120" vs "4" was flip-flopping between identical requests.
    const quoteTargetQuery = supabase
      .from("sales_quotation")
      .select("id, referenceid, quote_target, month, year")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(now))         // always current calendar month
      .eq("year", now.getFullYear().toString())
      .order("date_created", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }); // ✅ FIX: deterministic tie-breaker — this is the real fix

    // 7. Pipeline activities — same scope as OB/quotes
    const pipelineQuery = supabase
      .from("history")
      .select("referenceid, activity_reference_number, source, type_activity")
      .in("referenceid", agentIds)
      .gte("date_created", pipelineStart)
      .lte("date_created", pipelineEnd);

    // 8. New account counts by agent in selected month
    const naCountQuery = supabase
      .from("account_development_plans")
      .select("referenceid")
      .in("referenceid", agentIds)
      .gte("created_at", `${naFrom}T00:00:00Z`)
      .lte("created_at", `${naTo}T23:59:59Z`);

    // 9. New account targets per agent
    const naTargetQuery = supabase
      .from("sales_account_development")
      .select("referenceid, target")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(refDate))
      .eq("year", refDate.getFullYear().toString());

    // 10. Site visit targets per agent — deduplicated: take highest target per agent
    //     (multiple rows per agent can exist if target was updated; highest wins)
    const siteVisitTargetQuery = supabase
      .from("site_visit_target")
      .select("referenceid, target")
      .in("referenceid", agentIds)
      .eq("month", monthLabel(now))         // always current calendar month
      .eq("year", now.getFullYear().toString());

    // 11. Client visits — scoped to the selected date range (or current month if no range)
    const clientVisitsQuery = supabase
      .from("tasklog")
      .select(`"ReferenceID", "Status"`)
      .in("ReferenceID", agentIds)
      .gte("date_created", clientVisitsStart)
      .lte("date_created", clientVisitsEnd);

    const [
      quotasData,
      siData,
      obData,
      obTargetData,
      quotesData,
      quoteTargetData,
      pipelineData,
      naCountData,
      naTargetData,
      siteVisitTargetData,
      clientVisitsData,
    ] = await Promise.all([
      fetchAllRows(quotasQuery),
      fetchAllRows(siQuery),
      fetchAllRows(obQuery),
      fetchAllRows(obTargetQuery),
      fetchAllRows(quotesQuery),
      fetchAllRows(quoteTargetQuery),
      fetchAllRows(pipelineQuery),
      fetchAllRows(naCountQuery),
      fetchAllRows(naTargetQuery),
      fetchAllRows(siteVisitTargetQuery),
      fetchAllRows(clientVisitsQuery),
    ]);

    console.log("[tsm-kpi] Debug:");
    console.log("- tsm:", tsm);
    console.log("- from:", from, "to:", to);
    console.log("- agents:", agents.map(a => `${a.referenceid} - ${a.name}`));
    console.log("- agentIds:", agentIds);
    console.log("- obStart:", obStart, "obEnd:", obEnd);
    console.log("- obData count:", obData?.length, "sample:", obData?.slice(0, 5));
    console.log("- pipelineData count:", pipelineData?.length);

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
    console.log("- obMap total:", Object.values(obMap).reduce((sum, c) => sum + c, 0));
    console.log("- obMap breakdown:", obMap);

    // OB target map — first row per agent+month wins (latest due to ORDER BY date_created DESC, id DESC)
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

    // Quote target map: { referenceid → rows } — first row per agent+month wins (latest due to ORDER BY date_created DESC, id DESC)
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

    // ── Calculate CSR metrics for each agent (current month) ──────────────────
    const csrFromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const csrToDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const csrMetricsPromises = agents.map((agent) =>
      calculateCsrMetrics(agent.referenceid, csrFromDate, csrToDate)
    );
    const csrMetricsResults = await Promise.all(csrMetricsPromises);
    const csrMetricsMap: Record<string, { avgResponseTime: number; avgQuotationHT: number; avgNonQuotationHT: number }> = {};
    agents.forEach((agent, index) => {
      csrMetricsMap[agent.referenceid] = csrMetricsResults[index];
    });

    // ── Assemble per-agent result ─────────────────────────────────────────────
    const result = agents.map(({ referenceid, name }) => {
      const groups = pipelineMap[referenceid];
      const csrMetrics = csrMetricsMap[referenceid] || { avgResponseTime: 0, avgQuotationHT: 0, avgNonQuotationHT: 0 };

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
        avgResponseTime:          csrMetrics.avgResponseTime,
        avgQuotationHT:           csrMetrics.avgQuotationHT,
        avgNonQuotationHT:        csrMetrics.avgNonQuotationHT,
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