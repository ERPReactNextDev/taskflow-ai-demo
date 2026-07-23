import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MongoClient, Db } from "mongodb";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB  = process.env.MONGODB_DB;

if (!MONGODB_URI) throw new Error("Please define MONGODB_URI in .env.local");
if (!MONGODB_DB)  throw new Error("Please define MONGODB_DB in .env.local");

const mongoUri: string = MONGODB_URI;
const mongoDb:  string = MONGODB_DB;

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToMongoDb() {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
  const client = new MongoClient(mongoUri, {
    maxPoolSize: 5, minPoolSize: 1,
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000,
  });
  await client.connect();
  const db = client.db(mongoDb);
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

const CSR_EXCLUDED = [
  "Customer Feedback/Recommendation", "Job Inquiry", "Job Applicants",
  "Supplier/Vendor Product Offer", "Internal Whistle Blower",
  "Threats/Extortion/Intimidation", "Prank Call",
];

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
    const slice = slices[0];
    const row = rows.find((r) => r.month === slice.month && r.year === slice.year);
    return row != null ? row.targetValue : fallbackTarget;
  }
  let total = 0;
  for (const slice of slices) {
    const row = rows.find((r) => r.month === slice.month && r.year === slice.year);
    const monthly = row != null ? row.targetValue : fallbackTarget;
    if (slice.coveredDays >= slice.daysInMonth) total += monthly;
    else total += Math.round((monthly / slice.daysInMonth) * slice.coveredDays);
  }
  return total;
}

interface CsrMetrics {
  avgResponseTime: number;
  avgQuotationHT: number;
  avgNonQuotationHT: number;
  avgSpfHT: number;
}

async function calcCsrForAgents(
  agentIds: string[],
  fromDate: string,
  toDate: string,
  managerId: string
): Promise<Record<string, CsrMetrics>> {
  const result: Record<string, CsrMetrics> = {};
  try {
    const { db } = await connectToMongoDb();
    const col = db.collection("activity");
    const rows = await col.find({ department_head: managerId }).toArray();

    const fromTs = new Date(`${fromDate}T00:00:00+08:00`).getTime();
    const toTs   = new Date(`${toDate}T23:59:59+08:00`).getTime();

    const acc: Record<string, {
      rtTotal: number; rtCount: number;
      nqTotal: number; nqCount: number;
      qTotal:  number; qCount:  number;
      spfTotal: number; spfCount: number;
    }> = {};

    for (const row of rows) {
      if (row.status !== "Closed" && row.status !== "Converted into Sales") continue;
      const created = new Date(row.date_created).getTime();
      if (isNaN(created) || created < fromTs || created > toTs) continue;
      if (CSR_EXCLUDED.includes(row.wrap_up)) continue;

      let ref: string | null = null;
      if (row.agent && agentIds.includes(row.agent)) ref = row.agent;
      else if (row.referenceid && agentIds.includes(row.referenceid)) ref = row.referenceid;
      if (!ref) continue;

      if (!acc[ref]) acc[ref] = { rtTotal:0, rtCount:0, nqTotal:0, nqCount:0, qTotal:0, qCount:0, spfTotal:0, spfCount:0 };
      const a = acc[ref];

      const tsaAck   = new Date(row.tsa_acknowledge_date).getTime();
      const endorsed = new Date(row.ticket_endorsed).getTime();
      if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
        a.rtTotal += (tsaAck - endorsed) / 3600000;
        a.rtCount++;
      }

      const received  = new Date(row.ticket_received).getTime();
      const tsaHandle = new Date(row.tsa_handling_time).getTime();
      const tsmHandle = new Date(row.tsm_handling_time).getTime();
      let baseHT = 0;
      if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received)
        baseHT = (tsaHandle - received) / 3600000;
      else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received)
        baseHT = (tsmHandle - received) / 3600000;
      if (!baseHT) continue;

      const remarks = (row.remarks || "").toUpperCase();
      if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
        a.qTotal += baseHT; a.qCount++;
      } else if (remarks.includes("SPF")) {
        a.spfTotal += baseHT; a.spfCount++;
      } else {
        a.nqTotal += baseHT; a.nqCount++;
      }
    }

    for (const ref of agentIds) {
      const a = acc[ref];
      result[ref] = a
        ? {
            avgResponseTime:   a.rtCount  ? a.rtTotal  / a.rtCount  : 0,
            avgQuotationHT:    a.qCount   ? a.qTotal   / a.qCount   : 0,
            avgNonQuotationHT: a.nqCount  ? a.nqTotal  / a.nqCount  : 0,
            avgSpfHT:          a.spfCount ? a.spfTotal / a.spfCount : 0,
          }
        : { avgResponseTime:0, avgQuotationHT:0, avgNonQuotationHT:0, avgSpfHT:0 };
    }
  } catch (err) {
    console.error("[manager-kpi] CSR metrics error:", err);
    for (const ref of agentIds)
      result[ref] = { avgResponseTime:0, avgQuotationHT:0, avgNonQuotationHT:0, avgSpfHT:0 };
  }
  return result;
}

/** Get all active TSAs under a manager (via TSMs) */
async function getAgents(manager: string): Promise<{ referenceid: string; name: string; tsm: string }[]> {
  // 1. Get all active TSMs under this manager
  const { data: tsms } = await supabase
    .from("users")
    .select("ReferenceID")
    .eq("Manager", manager)
    .eq("Role", "Territory Sales Manager")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');

  if (!tsms || tsms.length === 0) return [];
  const tsmIds = tsms.map((t) => t.ReferenceID);

  // 2. Get all active TSAs under those TSMs
  const data = await fetchAllRows(
    supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname, TSM")
      .in("TSM", tsmIds)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true })
  );

  return (data ?? []).map((a) => ({
    referenceid: a.ReferenceID,
    name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
    tsm: a.TSM ?? "",
  }));
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const from    = url.searchParams.get("from");
    const to      = url.searchParams.get("to");

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    // ── Date scoping (identical logic to tsm-kpi) ─────────────────────────────
    const now         = new Date();
    const year        = now.getFullYear().toString();
    const monthSlices = [{
      year:        now.getFullYear().toString(),
      month:       monthLabel(now),
      daysInMonth: getDaysInMonth(now.getFullYear(), now.getMonth()),
      coveredDays: getDaysInMonth(now.getFullYear(), now.getMonth()),
    }];

    const manilaToday   = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [manilaYear, manilaMonthNum] = manilaToday.split("-");
    const monthStartDate = `${manilaYear}-${manilaMonthNum}-01`;
    const todayDate      = manilaToday;

    const naRefDate    = from ? new Date(`${from}T00:00:00+08:00`) : now;
    const naRefStr     = naRefDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [naYear, naMonth] = naRefStr.split("-");
    const naDaysInMonth = new Date(Number(naYear), Number(naMonth), 0).getDate();
    const naFrom = from ?? `${naYear}-${naMonth}-01`;
    const naTo   = to   ?? `${naYear}-${naMonth}-${String(naDaysInMonth).padStart(2, "0")}`;

    const siStart = from ? `${from}T00:00:00+08:00` : `${now.getFullYear()}-01-01T00:00:00+08:00`;
    const siEnd   = to   ? `${to}T23:59:59.999+08:00` : `${todayDate}T23:59:59.999+08:00`;

    const obStart = from ? `${from}T00:00:00+08:00` : `${monthStartDate}T00:00:00+08:00`;
    const obEnd   = to   ? `${to}T23:59:59.999+08:00` : `${todayDate}T23:59:59.999+08:00`;

    const quotesStart    = obStart;
    const quotesEnd      = obEnd;
    const pipelineStart  = obStart;
    const pipelineEnd    = obEnd;
    const clientVisitsStart = from ? `${from}T00:00:00+08:00` : `${monthStartDate}T00:00:00+08:00`;
    const clientVisitsEnd   = to   ? `${to}T23:59:59+08:00`   : `${todayDate}T23:59:59+08:00`;

    // ── Agents ────────────────────────────────────────────────────────────────
    const agents = await getAgents(manager);
    if (agents.length === 0) {
      return NextResponse.json({ success: true, agents: [], tsmNames: {} }, { status: 200 });
    }
    const agentIds = agents.map((a) => a.referenceid);

    // ── TSM name map for grouping ─────────────────────────────────────────────
    const { data: tsmUsersData } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("Manager", manager)
      .eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');
    const tsmNames: Record<string, string> = {};
    for (const t of tsmUsersData ?? []) {
      tsmNames[t.ReferenceID] = `${t.Firstname ?? ""} ${t.Lastname ?? ""}`.trim();
    }

    // ── Parallel Supabase fetches ─────────────────────────────────────────────
    const [
      quotasData, siData, obData, obTargetData,
      quotesData, quoteTargetData, pipelineData,
      naCountData, naTargetData, siteVisitTargetData, clientVisitsData,
    ] = await Promise.all([
      fetchAllRows(supabase.from("sales_quota").select("referenceid, amount").in("referenceid", agentIds).eq("year", year).eq("month", monthLabel(now))),
      fetchAllRows(supabase.from("history").select("referenceid, actual_sales").in("referenceid", agentIds).eq("type_activity", "Delivered / Closed Transaction").gte("date_created", siStart).lte("date_created", siEnd)),
      fetchAllRows(supabase.from("history").select("referenceid").in("referenceid", agentIds).eq("source", "Outbound - Touchbase").gte("date_created", obStart).lte("date_created", obEnd)),
      fetchAllRows(supabase.from("sales_ob").select("id, referenceid, ob_target, month, year").in("referenceid", agentIds).eq("month", monthLabel(now)).eq("year", now.getFullYear().toString()).order("date_created", { ascending: false, nullsFirst: false }).order("id", { ascending: false })),
      fetchAllRows(supabase.from("history").select("referenceid, quotation_number").in("referenceid", agentIds).eq("type_activity", "Quotation Preparation").eq("status", "Quote-Done").gte("date_created", quotesStart).lte("date_created", quotesEnd)),
      fetchAllRows(supabase.from("sales_quotation").select("id, referenceid, quote_target, month, year").in("referenceid", agentIds).eq("month", monthLabel(now)).eq("year", now.getFullYear().toString()).order("date_created", { ascending: false, nullsFirst: false }).order("id", { ascending: false })),
      fetchAllRows(supabase.from("history").select("referenceid, activity_reference_number, source, type_activity").in("referenceid", agentIds).gte("date_created", pipelineStart).lte("date_created", pipelineEnd)),
      fetchAllRows(supabase.from("account_development_plans").select("referenceid").in("referenceid", agentIds).gte("created_at", `${naFrom}T00:00:00+08:00`).lte("created_at", `${naTo}T23:59:59.999+08:00`)),
      fetchAllRows(supabase.from("sales_account_development").select("referenceid, target").in("referenceid", agentIds).eq("month", monthLabel(naRefDate)).eq("year", naRefDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4))),
      fetchAllRows(supabase.from("site_visit_target").select("referenceid, target").in("referenceid", agentIds).eq("month", monthLabel(now)).eq("year", now.getFullYear().toString())),
      fetchAllRows(supabase.from("tasklog").select(`"ReferenceID", "Status"`).in("ReferenceID", agentIds).gte("date_created", clientVisitsStart).lte("date_created", clientVisitsEnd)),
    ]);

    // ── Build lookup maps (identical to tsm-kpi) ──────────────────────────────
    const quotaMap: Record<string, number> = {};
    for (const r of quotasData) quotaMap[r.referenceid] = Number(r.amount) || 0;

    const siMap: Record<string, number> = {};
    for (const r of siData) siMap[r.referenceid] = (siMap[r.referenceid] ?? 0) + (Number(r.actual_sales) || 0);

    const obMap: Record<string, number> = {};
    for (const r of obData) obMap[r.referenceid] = (obMap[r.referenceid] ?? 0) + 1;

    const obTargetMap: Record<string, Array<{ month: string; year: string; targetValue: number }>> = {};
    const obTargetSeen = new Set<string>();
    for (const r of obTargetData) {
      const k = `${r.referenceid}|${r.month}|${r.year}`;
      if (obTargetSeen.has(k)) continue;
      obTargetSeen.add(k);
      if (!obTargetMap[r.referenceid]) obTargetMap[r.referenceid] = [];
      obTargetMap[r.referenceid].push({ month: r.month, year: r.year, targetValue: Number(r.ob_target) || 0 });
    }

    const quotesSetMap: Record<string, Set<string>> = {};
    for (const r of quotesData) {
      if (!quotesSetMap[r.referenceid]) quotesSetMap[r.referenceid] = new Set();
      if (r.quotation_number) quotesSetMap[r.referenceid].add(r.quotation_number);
    }

    const quoteTargetMap: Record<string, Array<{ month: string; year: string; targetValue: number }>> = {};
    const quoteTargetSeen = new Set<string>();
    for (const r of quoteTargetData) {
      const k = `${r.referenceid}|${r.month}|${r.year}`;
      if (quoteTargetSeen.has(k)) continue;
      quoteTargetSeen.add(k);
      if (!quoteTargetMap[r.referenceid]) quoteTargetMap[r.referenceid] = [];
      quoteTargetMap[r.referenceid].push({ month: r.month, year: r.year, targetValue: Number(r.quote_target) || 0 });
    }

    type PipelineGroup = { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean; hasDelivered: boolean };
    const pipelineMap: Record<string, Map<string, PipelineGroup>> = {};
    for (const r of pipelineData) {
      if (!r.activity_reference_number) continue;
      if (!pipelineMap[r.referenceid]) pipelineMap[r.referenceid] = new Map();
      const groups = pipelineMap[r.referenceid];
      if (!groups.has(r.activity_reference_number))
        groups.set(r.activity_reference_number, { hasOutbound: false, hasQuotation: false, hasSalesOrder: false, hasDelivered: false });
      const g = groups.get(r.activity_reference_number)!;
      if (r.source === "Outbound - Touchbase")                      g.hasOutbound   = true;
      if (r.type_activity === "Quotation Preparation")              g.hasQuotation  = true;
      if (r.type_activity === "Sales Order Preparation")            g.hasSalesOrder = true;
      if (r.type_activity === "Delivered / Closed Transaction")     g.hasDelivered  = true;
    }

    const naCountMap: Record<string, number> = {};
    for (const r of naCountData) naCountMap[r.referenceid] = (naCountMap[r.referenceid] ?? 0) + 1;

    const naTargetMap: Record<string, number> = {};
    for (const r of naTargetData) naTargetMap[r.referenceid] = Number(r.target) || 3;

    const siteVisitTargetMap: Record<string, number> = {};
    for (const r of siteVisitTargetData) siteVisitTargetMap[r.referenceid] = Number(r.target) || 10;

    const clientVisitsCountMap: Record<string, number> = {};
    for (const r of clientVisitsData) {
      if (r.Status !== "Login") continue;
      const ref = r.ReferenceID;
      if (ref) clientVisitsCountMap[ref] = (clientVisitsCountMap[ref] ?? 0) + 1;
    }

    // ── CSR metrics ───────────────────────────────────────────────────────────
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;
    const csrFrom = from || manilaMonthStart;
    const csrTo   = to   || manilaMonthEnd;

    const csrMetricsMap = await calcCsrForAgents(agentIds, csrFrom, csrTo, manager);

    // ── Assemble per-agent result ─────────────────────────────────────────────
    const result = agents.map(({ referenceid, name, tsm }) => {
      const groups     = pipelineMap[referenceid];
      const csrMetrics = csrMetricsMap[referenceid] || { avgResponseTime:0, avgQuotationHT:0, avgNonQuotationHT:0, avgSpfHT:0 };

      let c2qCount = 0, q2soQuotation = 0, q2soSalesOrder = 0;
      let soToSISalesOrder = 0, soToSIDelivered = 0;

      if (groups) {
        groups.forEach((g) => {
          if (g.hasOutbound && g.hasQuotation)                                           { c2qCount++; q2soQuotation++; }
          if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)                        { q2soSalesOrder++; soToSISalesOrder++; }
          if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder && g.hasDelivered)      soToSIDelivered++;
        });
      }

      return {
        referenceid,
        name,
        tsm,
        runningTarget:            quotaMap[referenceid]           ?? 0,
        totalActualSales:         siMap[referenceid]              ?? 0,
        obCallsCount:             obMap[referenceid]              ?? 0,
        obCallsTarget:            calculateRangedTarget(obTargetMap[referenceid] ?? [], monthSlices, 0, false),
        quotesCount:              quotesSetMap[referenceid]?.size ?? 0,
        quotesTarget:             calculateRangedTarget(quoteTargetMap[referenceid] ?? [], monthSlices, 0, false),
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
        avgSpfHT:                 csrMetrics.avgSpfHT,
      };
    });

    return NextResponse.json({ success: true, agents: result, tsmNames }, { status: 200 });
  } catch (err: any) {
    console.error("manager-kpi GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch manager KPI data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";