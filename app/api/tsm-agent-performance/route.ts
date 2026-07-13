import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MongoClient, Db } from "mongodb";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// MongoDB connection setup (same as act-fetch-activity-v2)
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local",
  );
}

if (!MONGODB_DB) {
  throw new Error(
    "Please define the MONGODB_DB environment variable inside .env.local",
  );
}

const mongoUri: string = MONGODB_URI;
const mongoDb: string = MONGODB_DB;

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(mongoUri, {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();

  const db = client.db(mongoDb);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

/**
 * GET /api/tsm-agent-performance?tsm=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns per-agent performance data for all active TSAs under the given TSM.
 * Columns match the TSA single agent view:
 *   plan, SI actual, SO actual, SI %, OB calls, quotation amount,
 *   site visits, account dev, time spent (ms), TSA response time,
 *   non-quotation HT, quotation HT, SPF handling duration.
 */

// ── Pagination helper ─────────────────────────────────────────────────────────

/** Fetch all rows from Supabase (handles pagination for large datasets) */
async function fetchAllRows<T = any>(query: any): Promise<T[]> {
  const PAGE_SIZE = 1000;
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

// ── CSR metrics (from MongoDB activity collection) ───────────────────────────

const CSR_EXCLUDED = [
  "Customer Feedback/Recommendation", "Job Inquiry", "Job Applicants",
  "Supplier/Vendor Product Offer", "Internal Whistle Blower",
  "Threats/Extortion/Intimidation", "Prank Call",
];

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
  tsmId: string
): Promise<Record<string, CsrMetrics>> {
  const result: Record<string, CsrMetrics> = {};
  try {
    console.log("[tsm-agent-performance] calcCsrForAgents called with tsmId:", tsmId, "agentIds:", agentIds, "fromDate:", fromDate, "toDate:", toDate);
    const { db } = await connectToDatabase();
    const col = db.collection("activity");

    const rows = await col
      .find({ manager: tsmId })
      .toArray();

    console.log("[tsm-agent-performance] Found", rows.length, "activity rows in MongoDB for manager:", tsmId);
    console.log("[tsm-agent-performance] Sample row:", rows[0]);

    const fromTs = new Date(`${fromDate}T00:00:00+08:00`).getTime();
    const toTs = new Date(`${toDate}T23:59:59+08:00`).getTime();
    console.log("[tsm-agent-performance] Date range (ts):", fromTs, "-", toTs);
   
    // per-agent accumulators
    const acc: Record<string, {
      rtTotal: number; rtCount: number;
      nqTotal: number; nqCount: number;
      qTotal:  number; qCount:  number;
      spfTotal: number; spfCount: number;
    }> = {};

    for (const row of rows) {
      console.log("[tsm-agent-performance] Processing row _id:", row._id, "status:", row.status, "date_created:", row.date_created, "wrap_up:", row.wrap_up, "referenceid:", row.referenceid, "agent:", row.agent, "manager:", row.manager);
      if (row.status !== "Closed" && row.status !== "Converted into Sales") {
        console.log("[tsm-agent-performance] Skipping row (wrong status):", row._id);
        continue;
      }
      const created = new Date(row.date_created).getTime();
      console.log("[tsm-agent-performance] Row created ts:", created, "fromTs:", fromTs, "toTs:", toTs);
      if (isNaN(created)) {
        console.log("[tsm-agent-performance] Skipping row (invalid date):", row._id);
        continue;
      }
      if (created < fromTs || created > toTs) {
        console.log("[tsm-agent-performance] Skipping row (out of date range):", row._id);
        continue;
      }
      if (CSR_EXCLUDED.includes(row.wrap_up)) {
        console.log("[tsm-agent-performance] Skipping row (excluded wrap_up):", row._id, row.wrap_up);
        continue;
      }

      // Check if agent is in agentIds first, then referenceid
      let ref: string | null = null;
      if (row.agent && agentIds.includes(row.agent)) {
        ref = row.agent;
      } else if (row.referenceid && agentIds.includes(row.referenceid)) {
        ref = row.referenceid;
      }
      console.log("[tsm-agent-performance] Determined ref:", ref, "row.agent:", row.agent, "row.referenceid:", row.referenceid, "agentIds:", agentIds);
      if (!ref) {
        console.log("[tsm-agent-performance] Skipping row (ref not in agentIds):", row._id);
        continue;
      }

      if (!acc[ref]) acc[ref] = { rtTotal:0, rtCount:0, nqTotal:0, nqCount:0, qTotal:0, qCount:0, spfTotal:0, spfCount:0 };
      const a = acc[ref];

      const tsaAck  = new Date(row.tsa_acknowledge_date).getTime();
      const endorsed = new Date(row.ticket_endorsed).getTime();
      console.log("[tsm-agent-performance] Row tsa_acknowledge_date:", row.tsa_acknowledge_date, "ticket_endorsed:", row.ticket_endorsed, "tsaAck:", tsaAck, "endorsed:", endorsed);
      if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
        a.rtTotal += (tsaAck - endorsed) / 3600000;
        a.rtCount++;
        console.log("[tsm-agent-performance] Added to rtTotal:", (tsaAck - endorsed)/3600000, "new rtCount:", a.rtCount);
      }

      const received  = new Date(row.ticket_received).getTime();
      const tsaHandle = new Date(row.tsa_handling_time).getTime();
      const tsmHandle = new Date(row.tsm_handling_time).getTime();
      let baseHT = 0;
      if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received) {
        baseHT = (tsaHandle - received) / 3600000;
        console.log("[tsm-agent-performance] Using tsaHandle baseHT:", baseHT);
      } else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received) {
        baseHT = (tsmHandle - received) / 3600000;
        console.log("[tsm-agent-performance] Using tsmHandle baseHT:", baseHT);
      } else {
        console.log("[tsm-agent-performance] Skipping row (no baseHT):", row._id, "received:", received, "tsaHandle:", tsaHandle, "tsmHandle:", tsmHandle);
      }
      if (!baseHT) continue;

      const remarks = (row.remarks || "").toUpperCase();
      console.log("[tsm-agent-performance] Row remarks:", remarks);
      if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
        a.qTotal += baseHT; a.qCount++;
        console.log("[tsm-agent-performance] Added to qTotal:", baseHT, "new qCount:", a.qCount);
      } else if (remarks.includes("SPF")) {
        a.spfTotal += baseHT; a.spfCount++;
        console.log("[tsm-agent-performance] Added to spfTotal:", baseHT, "new spfCount:", a.spfCount);
      } else {
        a.nqTotal += baseHT; a.nqCount++;
        console.log("[tsm-agent-performance] Added to nqTotal:", baseHT, "new nqCount:", a.nqCount);
      }
    }

    console.log("[tsm-agent-performance] Final accumulators:", acc);

    for (const ref of agentIds) {
      const a = acc[ref];
      result[ref] = a
        ? {
            avgResponseTime:  a.rtCount  ? a.rtTotal  / a.rtCount  : 0,
            avgQuotationHT:   a.qCount   ? a.qTotal   / a.qCount   : 0,
            avgNonQuotationHT:a.nqCount  ? a.nqTotal  / a.nqCount  : 0,
            avgSpfHT:         a.spfCount ? a.spfTotal / a.spfCount : 0,
          }
        : { avgResponseTime:0, avgQuotationHT:0, avgNonQuotationHT:0, avgSpfHT:0 };
    }
  } catch (err) {
    console.error("[tsm-agent-performance] CSR metrics error:", err);
    for (const ref of agentIds)
      result[ref] = { avgResponseTime:0, avgQuotationHT:0, avgNonQuotationHT:0, avgSpfHT:0 };
  }
  return result;
}

// ── Time spent (from multiple Supabase tables with start_date / end_date) ─────

async function calcTimeSpentForAgents(
  agentIds: string[],
  rangeStartDate: string,
  rangeEndDate: string,
  rangeStartTs: string,
  rangeEndTs: string
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  try {
    
    // Fetch from history table (date-only date_created)
    const historyQ = (() => {
      let q = supabase.from("history")
        .select("referenceid, start_date, end_date")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartDate)
        .lte("date_created", rangeEndDate);
      return fetchAllRows(q);
    })();

    // Fetch from revised_quotations table (date-only date_created)
    const revisedQ = (() => {
      let q = supabase.from("revised_quotations")
        .select("referenceid, start_date, end_date")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartDate)
        .lte("date_created", rangeEndDate);
      return fetchAllRows(q);
    })();

    // Fetch from meetings table (timestamp date_created)
    const meetingsQ = (() => {
      let q = supabase.from("meetings")
        .select("referenceid, start_date, end_date")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartTs)
        .lte("date_created", rangeEndTs);
      return fetchAllRows(q);
    })();

    // Fetch from documentation table (timestamp date_created)
    const docsQ = (() => {
      let q = supabase.from("documentation")
        .select("referenceid, start_date, end_date")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartTs)
        .lte("date_created", rangeEndTs);
      return fetchAllRows(q);
    })();

    const [historyData, revisedData, meetingsData, docsData] = await Promise.all([
      historyQ, revisedQ, meetingsQ, docsQ
    ]);

    const allData = [...historyData, ...revisedData, ...meetingsData, ...docsData];

    for (const row of allData) {
      const ref = row.referenceid;
      if (!ref) continue;
      if (row.start_date && row.end_date) {
        const s = new Date(row.start_date).getTime();
        const e = new Date(row.end_date).getTime();
        if (!isNaN(s) && !isNaN(e) && e > s) {
          result[ref] = (result[ref] ?? 0) + (e - s);
        }
      }
    }
  } catch (err) {
    console.error("tsm-agent-performance: time spent error", err);
  }
  return result;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to   = url.searchParams.get("to");   // YYYY-MM-DD

    console.log("[tsm-agent-performance] GET called with tsm:", tsm, "from:", from, "to:", to);

    if (!tsm) {
      return NextResponse.json(
        { success: false, error: "Missing tsm parameter." },
        { status: 400 }
      );
    }

    // ── 1. Resolve active TSAs under this TSM ─────────────────────────────────
    console.log("[tsm-agent-performance] Fetching agents from Supabase");
    const { data: agentRows, error: agentErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentErr) {
      console.error("[tsm-agent-performance] Error fetching agents from Supabase:", agentErr);
      throw agentErr;
    }

    const agents = (agentRows ?? []).map((a) => ({
      referenceid: a.ReferenceID as string,
      name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
    }));

    console.log("[tsm-agent-performance] Found agents:", agents);

    if (agents.length === 0) {
      return NextResponse.json({ success: true, agents: [] }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.referenceid);

    // ── 2. Date scoping ───────────────────────────────────────────────────────
    const now         = new Date();
    const currentYear = now.getFullYear().toString();

    // Derive today and current month in Manila time
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;

    // SI (uses delivery_date, date-only) / SO (uses date_created, timestamp)
    const siStart = from ? from : `${mYear}-01-01`;
    const siEnd   = to   ? to : null;

    // Date-only for history table (date_created)
    const rangeStartDate = from || manilaMonthStart;
    const rangeEndDate   = to || manilaMonthEnd;

    // Timestamp strings for other tables (tasklog, account_development_plans, etc.)
    const rangeStartTs = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const rangeEndTs   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    // New account dev — selected range (or current month)
    const naStart = rangeStartTs;
    const naEnd   = rangeEndTs;

    // Site visits — same range, +08:00 timezone
    const svStart = rangeStartTs;
    const svEnd   = rangeEndTs;

    // Quota year
    const quotaYear = from ? new Date(`${from}T00:00:00+08:00`).getFullYear().toString() : currentYear;

    // ── 3. Parallel Supabase queries ──────────────────────────────────────────

    // SI (actual sales) - based on delivery_date
    const siQ = (() => {
      let q = supabase.from("history")
        .select("referenceid, actual_sales")
        .in("referenceid", agentIds)
        .eq("type_activity", "Delivered / Closed Transaction")
        .gte("delivery_date", siStart);
      if (siEnd) q = q.lte("delivery_date", siEnd);
      return fetchAllRows(q);
    })();

    // SO amount
    const soQ = (() => {
      let q = supabase.from("history")
        .select("referenceid, so_amount")
        .in("referenceid", agentIds)
        .eq("status", "SO-Done")
        .gte("date_created", siStart);
      if (siEnd) q = q.lte("date_created", siEnd);
      return fetchAllRows(q);
    })();

    // OB calls
    const obQ = fetchAllRows(
      supabase.from("history")
        .select("referenceid")
        .in("referenceid", agentIds)
        .eq("source", "Outbound - Touchbase")
        .gte("date_created", rangeStartDate)
        .lte("date_created", rangeEndDate)
    );

    // Quotation amount (Quote-Done, sum of quotation_amount)
    const qaQ = fetchAllRows(
      supabase.from("history")
        .select("referenceid, quotation_amount")
        .in("referenceid", agentIds)
        .eq("type_activity", "Quotation Preparation")
        .eq("status", "Quote-Done")
        .gte("date_created", rangeStartDate)
        .lte("date_created", rangeEndDate)
    );

    // Site visits (tasklog Login entries)
    const svQ = fetchAllRows(
      supabase
        .from("tasklog")
        .select(`"ReferenceID", "Status"`)
        .in("ReferenceID", agentIds)
        .gte("date_created", svStart)
        .lte("date_created", svEnd)
    );

    // New account development
    const naQ = fetchAllRows(
      supabase
        .from("account_development_plans")
        .select("referenceid")
        .in("referenceid", agentIds)
        .gte("created_at", naStart)
        .lte("created_at", naEnd)
    );

    // Sales quota (annual plan)
    const quotaQ = fetchAllRows(
      supabase
        .from("sales_quota")
        .select("referenceid, amount")
        .in("referenceid", agentIds)
        .eq("year", quotaYear)
    );

    console.log("[tsm-agent-performance] Starting parallel queries");
    const [
      siData,
      soData,
      obData,
      qaData,
      svData,
      naData,
      quotaData,
      csrMap,
      timeSpentMap,
    ] = await Promise.all([
      siQ, soQ, obQ, qaQ, svQ, naQ, quotaQ,
      calcCsrForAgents(agentIds, rangeStartDate, rangeEndDate, tsm),
      calcTimeSpentForAgents(agentIds, rangeStartDate, rangeEndDate, rangeStartTs, rangeEndTs),
    ]);
    console.log("[tsm-agent-performance] Parallel queries complete");

    // ── 4. Aggregate per agent ────────────────────────────────────────────────

    const siMap:    Record<string, number> = {};
    const soMap:    Record<string, number> = {};
    const obMap:    Record<string, number> = {};
    const qaMap:    Record<string, number> = {};
    const svMap:    Record<string, number> = {};
    const naMap:    Record<string, number> = {};
    const quotaMap: Record<string, number> = {};

    for (const r of siData)    siMap[r.referenceid]    = (siMap[r.referenceid]    ?? 0) + (Number(r.actual_sales)     || 0);
    for (const r of soData)    soMap[r.referenceid]    = (soMap[r.referenceid]    ?? 0) + (Number(r.so_amount)        || 0);
    for (const r of obData)    obMap[r.referenceid]    = (obMap[r.referenceid]    ?? 0) + 1;
    for (const r of qaData)    qaMap[r.referenceid]    = (qaMap[r.referenceid]    ?? 0) + (Number(r.quotation_amount) || 0);
    for (const r of svData)    { if (r.Status === "Login") svMap[r.ReferenceID] = (svMap[r.ReferenceID] ?? 0) + 1; }
    for (const r of naData)    naMap[r.referenceid]    = (naMap[r.referenceid]    ?? 0) + 1;
    for (const r of quotaData) quotaMap[r.referenceid] = (quotaMap[r.referenceid] ?? 0) + (Number(r.amount) || 0);

    // ── 5. Assemble result ────────────────────────────────────────────────────
    const result = agents.map(({ referenceid, name }) => {
      const plan  = quotaMap[referenceid] ?? 0;
      const si    = siMap[referenceid]    ?? 0;
      const so    = soMap[referenceid]    ?? 0;
      const siPct = plan > 0 ? Math.round((si / plan) * 100) : 0;
      const csr   = csrMap[referenceid]   ?? { avgResponseTime: 0, avgQuotationHT: 0, avgNonQuotationHT: 0, avgSpfHT: 0 };

      return {
        referenceid,
        name,
        plan,
        siActual:             si,
        soActual:             so,
        siPercentage:         siPct,
        obCalls:              obMap[referenceid]        ?? 0,
        quotationAmount:      qaMap[referenceid]        ?? 0,
        siteVisits:           svMap[referenceid]        ?? 0,
        accountDevelopment:   naMap[referenceid]        ?? 0,
        timeSpentMs:          timeSpentMap[referenceid] ?? 0,
        avgResponseTime:      csr.avgResponseTime,
        avgNonQuotationHT:    csr.avgNonQuotationHT,
        avgQuotationHT:       csr.avgQuotationHT,
        avgSpfHT:             csr.avgSpfHT,
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
