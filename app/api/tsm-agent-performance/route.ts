import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MongoClient, Db } from "mongodb";
import { neon } from "@neondatabase/serverless";

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

// Neon database client for accounts table
const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL;
if (!TASKFLOW_DB_URL) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const sql = neon(TASKFLOW_DB_URL);

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
): Promise<Record<string, { total: number; breakdown: Record<string, number> }>> {
  const result: Record<string, { total: number; breakdown: Record<string, number> }> = {};
  try {
    // Fetch from history table — include type_activity for breakdown
    const historyQ = fetchAllRows(
      supabase.from("history")
        .select("referenceid, start_date, end_date, type_activity")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartDate)
        .lte("date_created", rangeEndDate)
    );

    // Fetch from revised_quotations table
    const revisedQ = fetchAllRows(
      supabase.from("revised_quotations")
        .select("referenceid, start_date, end_date")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartDate)
        .lte("date_created", rangeEndDate)
    );

    // Fetch from meetings table
    const meetingsQ = fetchAllRows(
      supabase.from("meetings")
        .select("referenceid, start_date, end_date")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartTs)
        .lte("date_created", rangeEndTs)
    );

    // Fetch from documentation table
    const docsQ = fetchAllRows(
      supabase.from("documentation")
        .select("referenceid, start_date, end_date")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartTs)
        .lte("date_created", rangeEndTs)
    );

    const [historyData, revisedData, meetingsData, docsData] = await Promise.all([
      historyQ, revisedQ, meetingsQ, docsQ
    ]);

    const addMs = (ref: string, activity: string, ms: number) => {
      if (!result[ref]) result[ref] = { total: 0, breakdown: {} };
      result[ref].total += ms;
      result[ref].breakdown[activity] = (result[ref].breakdown[activity] ?? 0) + ms;
    };

    for (const row of historyData) {
      const ref = row.referenceid;
      if (!ref || !row.start_date || !row.end_date) continue;
      const s = new Date(row.start_date).getTime();
      const e = new Date(row.end_date).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) {
        addMs(ref, row.type_activity || "Other", e - s);
      }
    }
    for (const row of revisedData) {
      const ref = row.referenceid;
      if (!ref || !row.start_date || !row.end_date) continue;
      const s = new Date(row.start_date).getTime();
      const e = new Date(row.end_date).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) addMs(ref, "Revised Quotation", e - s);
    }
    for (const row of meetingsData) {
      const ref = row.referenceid;
      if (!ref || !row.start_date || !row.end_date) continue;
      const s = new Date(row.start_date).getTime();
      const e = new Date(row.end_date).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) addMs(ref, "Client Meeting", e - s);
    }
    for (const row of docsData) {
      const ref = row.referenceid;
      if (!ref || !row.start_date || !row.end_date) continue;
      const s = new Date(row.start_date).getTime();
      const e = new Date(row.end_date).getTime();
      if (!isNaN(s) && !isNaN(e) && e > s) addMs(ref, "Documentation", e - s);
    }
  } catch (err) {
    console.error("tsm-agent-performance: time spent error", err);
  }
  return result;
}

// ── DB Coverage (cluster accounts + activities) ───────────────────────────────

interface DbCoverageResult {
  coveredCount: number;
  totalCount: number;
}

// Normalize a company name: lowercase → collapse whitespace → strip trailing dot(s)
const normalizeCompany = (name: string): string =>
  (name || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/\.+$/, "");

async function calcDbCoverageForAgents(
  agentIds: string[],
  monthStartDate: string,
  monthEndDate: string
): Promise<Record<string, DbCoverageResult>> {
  const result: Record<string, DbCoverageResult> = {};
  try {
    console.log("[calcDbCoverageForAgents] Starting with agentIds:", agentIds, "monthStart:", monthStartDate, "monthEnd:", monthEndDate);
    // Fetch all cluster accounts for these agents — only Active status
    const clusterAccounts = await sql`
      SELECT referenceid, company_name, account_reference_number, status, type_client
      FROM accounts
      WHERE referenceid = ANY(${agentIds}) 
        AND LOWER(TRIM(status)) = 'active'
    `;
    console.log("[calcDbCoverageForAgents] Found clusterAccounts:", clusterAccounts.length, clusterAccounts);

    // Fetch activities from ALL 5 relevant tables for these agents (full month)
    const allActivities: any[] = [];
    const tables = ["history"];
    
    for (const table of tables) {
      let query = supabase.from(table)
        .select("referenceid, company_name, account_reference_number, date_created")
        .in("referenceid", agentIds)
        .gte("date_created", monthStartDate);
      
      const d = new Date(monthEndDate);
      d.setHours(23, 59, 59, 999);
      query = query.lte("date_created", d.toISOString());
      
      const data = await fetchAllRows(query);
      if (data) {
        console.log("[calcDbCoverageForAgents] Table", table, "returned", data.length, "rows");
        allActivities.push(...data);
      }
    }
    console.log("[calcDbCoverageForAgents] Total allActivities:", allActivities.length);

    // Group accounts per agent
    const agentAccounts: Record<string, any[]> = {};
    for (const acc of clusterAccounts) {
      const ref = acc.referenceid;
      if (!agentAccounts[ref]) agentAccounts[ref] = [];
      agentAccounts[ref].push(acc);
    }

    // Group touched account reference numbers/companies per agent
    const agentTouchedAccountRefs: Record<string, Set<string>> = {};
    const agentTouchedCompanies: Record<string, Set<string>> = {};

    for (const act of allActivities) {
      const ref = act.referenceid;
      if (!ref) continue;

      const dateStr = act.date_created.toString().split("T")[0];
      const [y, m, day] = dateStr.split("-").map(Number);
      if (!y || !m || !day) continue;
      const actDate = Date.UTC(y, m - 1, day);
      const [monthStartY, monthStartM] = monthStartDate.split("-").map(Number);
      const [monthEndY, monthEndM] = monthEndDate.split("-").map(Number);
      const monthStart = Date.UTC(monthStartY, monthStartM - 1, 1);
      const monthEnd = Date.UTC(monthEndY, monthEndM, 0, 23, 59, 59, 999);
      if (actDate < monthStart || actDate > monthEnd) continue;

      if (!agentTouchedAccountRefs[ref]) agentTouchedAccountRefs[ref] = new Set();
      if (!agentTouchedCompanies[ref]) agentTouchedCompanies[ref] = new Set();

      if (act.account_reference_number) {
        agentTouchedAccountRefs[ref].add(act.account_reference_number.toString().trim());
      }
      const companyName = act.company_name || act.customer_name || act.company;
      if (companyName) {
        agentTouchedCompanies[ref].add(normalizeCompany(companyName));
      }
    }

    // Filter accounts — only Active status, valid type_client
    const allowedTypes = new Set(["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"]);

    for (const ref of agentIds) {
      const accounts = agentAccounts[ref] || [];
      // Only count accounts with status = "active" and a valid type_client
      const filteredAccounts = accounts.filter((acc) => {
        const status     = (acc.status     || "").toLowerCase().trim();
        const typeClient = (acc.type_client || "").toLowerCase().trim();
        return status === "active" && allowedTypes.has(typeClient);
      });

      const touchedAccountRefs = agentTouchedAccountRefs[ref] || new Set<string>();
      const touchedCompanies   = agentTouchedCompanies[ref]   || new Set<string>();

      const coveredCount = filteredAccounts.filter((acc) => {
        // Match by account_reference_number first
        if (acc.account_reference_number &&
            touchedAccountRefs.has(acc.account_reference_number.toString().trim())) {
          return true;
        }
        // Fallback: match by normalized company name
        if (acc.company_name && touchedCompanies.has(normalizeCompany(acc.company_name))) {
          return true;
        }
        return false;
      }).length;

      result[ref] = { coveredCount, totalCount: filteredAccounts.length };
    }
  } catch (err) {
    console.error("tsm-agent-performance: db coverage error", err);
    for (const ref of agentIds) {
      result[ref] = { coveredCount: 0, totalCount: 0 };
    }
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
      .select("ReferenceID, Lastname, Firstname")
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
      name: `${a.Lastname ?? ""}, ${a.Firstname ?? ""} `.trim(),
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

    // SI always uses full month boundaries derived from the 'from' date (or current month if not provided).
    // SI total is never filtered by the selected date range — always the full month.
    const siRefDate = from ? new Date(`${from}T00:00:00+08:00`) : now;
    const siYear    = siRefDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);
    const siMonth   = siRefDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7);
    const siMonthDays = new Date(Number(siYear), Number(siMonth), 0).getDate();
    const siStart   = `${siYear}-${siMonth}-01`;
    const siEnd     = `${siYear}-${siMonth}-${String(siMonthDays).padStart(2, "0")}`;

    // SO uses full +08:00 timestamp bounds — same as tsm-history-so and tsm-agent-so
    const soStartISO = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const soEndISO   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

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

    // SI (actual sales) - always based on full month boundaries of delivery_date
    const siQ = (() => {
      let q = supabase.from("history")
        .select("referenceid, actual_sales")
        .in("referenceid", agentIds)
        .eq("type_activity", "Delivered / Closed Transaction")
        .gte("delivery_date", siStart)
        .lte("delivery_date", siEnd);
      return fetchAllRows(q);
    })();

    // SO amount — use Manila-aware +08:00 bounds to match tsm-history-so and tsm-agent-so
    const soQ = (() => {
      let q = supabase.from("history")
        .select("referenceid, so_amount")
        .in("referenceid", agentIds)
        .eq("status", "SO-Done")
        .gte("date_created", soStartISO)
        .lte("date_created", soEndISO);
      return fetchAllRows(q);
    })();

    // OB calls — Successful only
    const obQ = fetchAllRows(
      supabase.from("history")
        .select("referenceid")
        .in("referenceid", agentIds)
        .eq("source", "Outbound - Touchbase")
        .eq("call_status", "Successful")
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

    // Quotation amount target (from sales_quotation table, current month of the range)
    const quotaMonthDate = from ? new Date(`${from}T00:00:00+08:00`) : now;
    const quotaMonth = quotaMonthDate.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Manila" });
    const quotaMonthYear = quotaMonthDate.toLocaleDateString("en-CA", { year: "numeric", timeZone: "Asia/Manila" }).split("-")[0];

    // Sales quota — monthly plan (filter by year + month to avoid summing the full year)
    const quotaQ = fetchAllRows(
      supabase
        .from("sales_quota")
        .select("referenceid, amount")
        .in("referenceid", agentIds)
        .eq("year", quotaYear)
        .eq("month", quotaMonth)
    );

    const quotationTargetQ = fetchAllRows(
      supabase
        .from("sales_quotation")
        .select("referenceid, quotation_amount_target")
        .in("referenceid", agentIds)
        .eq("month", quotaMonth)
        .eq("year", quotaMonthYear)
    );

    // Site visit target (from site_visit_target table, current month of the range)
    const siteVisitTargetQ = fetchAllRows(
      supabase
        .from("site_visit_target")
        .select("referenceid, target")
        .in("referenceid", agentIds)
        .eq("month", quotaMonth)
        .eq("year", quotaMonthYear)
    );

    // Account development target (from sales_account_development table, current month of the range)
    const accountDevTargetQ = fetchAllRows(
      supabase
        .from("sales_account_development")
        .select("referenceid, target")
        .in("referenceid", agentIds)
        .eq("month", quotaMonth)
        .eq("year", quotaMonthYear)
    );

    // OB call target (from sales_ob table, current month of the range)
    const obTargetQ = fetchAllRows(
      supabase
        .from("sales_ob")
        .select("referenceid, ob_target")
        .in("referenceid", agentIds)
        .eq("month", quotaMonth)
        .eq("year", quotaMonthYear)
    );

    // Conversion pipeline — single query for calls→quote, quote→SO, SO→SI per agent
    const convQ = fetchAllRows(
      supabase.from("history")
        .select("referenceid, activity_reference_number, source, type_activity")
        .in("referenceid", agentIds)
        .gte("date_created", rangeStartTs)
        .lte("date_created", rangeEndTs)
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
      quotationTargetData,
      siteVisitTargetData,
      accountDevTargetData,
      obTargetData,
      convData,
      csrMap,
      timeSpentMap,
      dbCoverageMap,
    ] = await Promise.all([
      siQ, soQ, obQ, qaQ, svQ, naQ, quotaQ, quotationTargetQ, siteVisitTargetQ, accountDevTargetQ, obTargetQ, convQ,
      calcCsrForAgents(agentIds, rangeStartDate, rangeEndDate, tsm),
      calcTimeSpentForAgents(agentIds, rangeStartDate, rangeEndDate, rangeStartTs, rangeEndTs),
      calcDbCoverageForAgents(agentIds, manilaMonthStart, manilaMonthEnd),
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
    const quotationTargetMap:  Record<string, number> = {};
    const siteVisitTargetMap:  Record<string, number> = {};
    const accountDevTargetMap: Record<string, number> = {};
    const obTargetMap:         Record<string, number> = {};

    for (const r of siData)    siMap[r.referenceid]    = (siMap[r.referenceid]    ?? 0) + (Number(r.actual_sales)     || 0);
    for (const r of soData)    soMap[r.referenceid]    = (soMap[r.referenceid]    ?? 0) + (Number(r.so_amount)        || 0);
    for (const r of obData)    obMap[r.referenceid]    = (obMap[r.referenceid]    ?? 0) + 1;
    for (const r of qaData)    qaMap[r.referenceid]    = (qaMap[r.referenceid]    ?? 0) + (Number(r.quotation_amount) || 0);
    for (const r of svData)    { if (r.Status === "Login") svMap[r.ReferenceID] = (svMap[r.ReferenceID] ?? 0) + 1; }
    for (const r of naData)    naMap[r.referenceid]    = (naMap[r.referenceid]    ?? 0) + 1;
    for (const r of quotaData) quotaMap[r.referenceid] = (quotaMap[r.referenceid] ?? 0) + (Number(r.amount) || 0);
    for (const r of quotationTargetData)  quotationTargetMap[r.referenceid]  = (quotationTargetMap[r.referenceid]  ?? 0) + (Number(r.quotation_amount_target) || 0);
    for (const r of siteVisitTargetData)  siteVisitTargetMap[r.referenceid]  = (siteVisitTargetMap[r.referenceid]  ?? 0) + (Number(r.target) || 0);
    for (const r of accountDevTargetData) accountDevTargetMap[r.referenceid] = (accountDevTargetMap[r.referenceid] ?? 0) + (Number(r.target) || 0);
    for (const r of obTargetData)         obTargetMap[r.referenceid]         = (obTargetMap[r.referenceid]         ?? 0) + (Number(r.ob_target) || 0);

    // ── Per-agent conversion counts (calls→quote, quote→SO, SO→SI) ────────────
    // Group activity rows by agent + activity_reference_number, flag pipeline stages
    type ConvGroup = { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean; hasDelivered: boolean };
    const convGroups: Record<string, Map<string, ConvGroup>> = {};
    for (const ref of agentIds) convGroups[ref] = new Map();

    for (const r of convData) {
      const ref = r.referenceid;
      const arn = r.activity_reference_number;
      if (!ref || !arn || !convGroups[ref]) continue;
      if (!convGroups[ref].has(arn))
        convGroups[ref].set(arn, { hasOutbound: false, hasQuotation: false, hasSalesOrder: false, hasDelivered: false });
      const g = convGroups[ref].get(arn)!;
      if (r.source         === "Outbound - Touchbase")                  g.hasOutbound   = true;
      if (r.type_activity  === "Quotation Preparation")                 g.hasQuotation  = true;
      if (r.type_activity  === "Sales Order Preparation")               g.hasSalesOrder = true;
      if (r.type_activity  === "Delivered / Closed Transaction")        g.hasDelivered  = true;
    }

    // callsToQuote = groups with outbound + quotation
    // quoteToSO_q  = groups with outbound + quotation (denominator for Q→SO)
    // quoteToSO_so = groups with outbound + quotation + salesOrder
    // soToSI_so    = groups with outbound + quotation + salesOrder (denominator for SO→SI)
    // soToSI_si    = groups with outbound + quotation + salesOrder + delivered
    const callsToQuoteMap: Record<string, number> = {};
    const quoteToSOQuotMap: Record<string, number> = {};
    const quoteToSOSoMap:   Record<string, number> = {};
    const soToSISoMap:      Record<string, number> = {};
    const soToSISiMap:      Record<string, number> = {};

    for (const ref of agentIds) {
      let c2q = 0, q2soQ = 0, q2soSO = 0, s2siSO = 0, s2siSI = 0;
      convGroups[ref].forEach((g) => {
        if (g.hasOutbound && g.hasQuotation)                                        { c2q++;  q2soQ++;  }
        if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)                     { q2soSO++; s2siSO++; }
        if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder && g.hasDelivered)   { s2siSI++; }
      });
      callsToQuoteMap[ref] = c2q;
      quoteToSOQuotMap[ref] = q2soQ;
      quoteToSOSoMap[ref]   = q2soSO;
      soToSISoMap[ref]      = s2siSO;
      soToSISiMap[ref]      = s2siSI;
    }

    // ── 5. Assemble result ────────────────────────────────────────────────────
    const result = agents.map(({ referenceid, name }) => {
      const plan  = quotaMap[referenceid] ?? 0;
      const si    = siMap[referenceid]    ?? 0;
      const so    = soMap[referenceid]    ?? 0;
      const siPct = plan > 0 ? Math.round((si / plan) * 100) : 0;
      const csr   = csrMap[referenceid]   ?? { avgResponseTime: 0, avgQuotationHT: 0, avgNonQuotationHT: 0, avgSpfHT: 0 };
      const dbCov = dbCoverageMap[referenceid] ?? { coveredCount: 0, totalCount: 0 };

      return {
        referenceid,
        name,
        plan,
        siActual:             si,
        soActual:             so,
        siPercentage:         siPct,
        obCalls:              obMap[referenceid]        ?? 0,
        obCallsTarget:        obTargetMap[referenceid]  ?? 0,
        callsToQuote:         callsToQuoteMap[referenceid]  ?? 0,
        quoteToSOQuotation:   quoteToSOQuotMap[referenceid] ?? 0,
        quoteToSOSalesOrder:  quoteToSOSoMap[referenceid]   ?? 0,
        soToSISalesOrder:     soToSISoMap[referenceid]      ?? 0,
        soToSIDelivered:      soToSISiMap[referenceid]      ?? 0,
        quotationAmountTarget: quotationTargetMap[referenceid] ?? 0,
        quotationAmount:      qaMap[referenceid]        ?? 0,
        siteVisits:           svMap[referenceid]        ?? 0,
        siteVisitTarget:      siteVisitTargetMap[referenceid]  ?? 0,
        accountDevelopment:   naMap[referenceid]        ?? 0,
        accountDevelopmentTarget: accountDevTargetMap[referenceid] ?? 0,
        dbCoverageCovered:    dbCov.coveredCount,
        dbCoverageTotal:      dbCov.totalCount,
        timeSpentMs:          timeSpentMap[referenceid]?.total   ?? 0,
        timeSpentBreakdown:   timeSpentMap[referenceid]?.breakdown ?? {},
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
