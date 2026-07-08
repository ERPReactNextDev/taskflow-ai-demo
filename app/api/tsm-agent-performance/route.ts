import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { connectToDatabase } from "@/lib/mongodb";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/**
 * GET /api/tsm-agent-performance?tsm=<id>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Returns per-agent performance data for all active TSAs under the given TSM.
 * Columns match the TSA single agent view:
 *   plan, SI actual, SO actual, SI %, OB calls, quotation amount,
 *   site visits, account dev, time spent (ms), TSA response time,
 *   non-quotation HT, quotation HT, SPF handling duration.
 */

// ── CSR metrics (from MongoDB activity collection) ───────────────────────────

const CSR_EXCLUDED = [
  "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
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
  fromISO: string,
  toISO: string
): Promise<Record<string, CsrMetrics>> {
  const result: Record<string, CsrMetrics> = {};
  try {
    const db = await connectToDatabase();
    const col = db.collection("activity");

    const rows = await col
      .find({ $or: [{ referenceid: { $in: agentIds } }, { agent: { $in: agentIds } }] })
      .toArray();

    const fromTs = new Date(fromISO).getTime();
    const toTs   = new Date(toISO).getTime();

    // per-agent accumulators
    const acc: Record<string, {
      rtTotal: number; rtCount: number;
      nqTotal: number; nqCount: number;
      qTotal:  number; qCount:  number;
      spfTotal:number; spfCount:number;
    }> = {};

    for (const row of rows) {
      if (row.status !== "Closed" && row.status !== "Converted into Sales") continue;
      const created = new Date(row.date_created).getTime();
      if (isNaN(created) || created < fromTs || created > toTs) continue;
      if (CSR_EXCLUDED.includes(row.wrap_up)) continue;

      const ref = row.referenceid || row.agent;
      if (!ref || !agentIds.includes(ref)) continue;

      if (!acc[ref]) acc[ref] = { rtTotal:0, rtCount:0, nqTotal:0, nqCount:0, qTotal:0, qCount:0, spfTotal:0, spfCount:0 };
      const a = acc[ref];

      const tsaAck  = new Date(row.tsa_acknowledge_date).getTime();
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
            avgResponseTime:  a.rtCount  ? a.rtTotal  / a.rtCount  : 0,
            avgQuotationHT:   a.qCount   ? a.qTotal   / a.qCount   : 0,
            avgNonQuotationHT:a.nqCount  ? a.nqTotal  / a.nqCount  : 0,
            avgSpfHT:         a.spfCount ? a.spfTotal / a.spfCount : 0,
          }
        : { avgResponseTime: 0, avgQuotationHT: 0, avgNonQuotationHT: 0, avgSpfHT: 0 };
    }
  } catch (err) {
    console.error("tsm-agent-performance: CSR metrics error", err);
    for (const ref of agentIds)
      result[ref] = { avgResponseTime: 0, avgQuotationHT: 0, avgNonQuotationHT: 0, avgSpfHT: 0 };
  }
  return result;
}

// ── Time spent (from Supabase activity table start_date / end_date) ───────────

async function calcTimeSpentForAgents(
  agentIds: string[],
  fromISO: string,
  toISO: string
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  try {
    // Fetch activity rows with start_date & end_date for the date range
    const { data, error } = await supabase
      .from("activity")
      .select("referenceid, start_date, end_date, duration")
      .in("referenceid", agentIds)
      .gte("date_created", fromISO)
      .lte("date_created", toISO);

    if (error) throw error;

    for (const row of data ?? []) {
      const ref = row.referenceid;
      if (!ref) continue;
      let ms = 0;
      if (row.start_date && row.end_date) {
        const s = new Date(row.start_date).getTime();
        const e = new Date(row.end_date).getTime();
        if (!isNaN(s) && !isNaN(e) && e > s) ms = e - s;
      } else if (row.duration) {
        ms = Number(row.duration) * 1000;
      }
      result[ref] = (result[ref] ?? 0) + ms;
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

    // Derive today and current month in Manila time
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }); // YYYY-MM-DD
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;

    // SI / SO — YTD or selected range
    const siStart = from ? `${from}T00:00:00+08:00` : `${mYear}-01-01T00:00:00+08:00`;
    const siEnd   = to   ? `${to}T23:59:59.999+08:00` : null;

    // OB calls / quotations / pipeline / time spent — selected range or current month
    const rangeStart = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const rangeEnd   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    // New account dev — selected range (or current month)
    const naStart = rangeStart;
    const naEnd   = rangeEnd;

    // Site visits — same range, +08:00 timezone
    const svStart = rangeStart;
    const svEnd   = rangeEnd;

    // Quota year
    const quotaYear = from ? new Date(`${from}T00:00:00+08:00`).getFullYear().toString() : currentYear;

    // ── 3. Parallel Supabase queries ──────────────────────────────────────────

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
    const obQ = supabase.from("history")
      .select("referenceid")
      .in("referenceid", agentIds)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", rangeStart)
      .lte("date_created", rangeEnd);

    // Quotation amount (Quote-Done, sum of quotation_amount)
    const qaQ = supabase.from("history")
      .select("referenceid, quotation_amount")
      .in("referenceid", agentIds)
      .eq("type_activity", "Quotation Preparation")
      .eq("status", "Quote-Done")
      .gte("date_created", rangeStart)
      .lte("date_created", rangeEnd);

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
      { data: siData   },
      { data: soData   },
      { data: obData   },
      { data: qaData   },
      { data: svData   },
      { data: naData   },
      { data: quotaData },
      csrMap,
      timeSpentMap,
    ] = await Promise.all([
      siQ, soQ, obQ, qaQ, svQ, naQ, quotaQ,
      calcCsrForAgents(agentIds, rangeStart, rangeEnd),
      calcTimeSpentForAgents(agentIds, rangeStart, rangeEnd),
    ]);

    // ── 4. Aggregate per agent ────────────────────────────────────────────────

    const siMap:    Record<string, number> = {};
    const soMap:    Record<string, number> = {};
    const obMap:    Record<string, number> = {};
    const qaMap:    Record<string, number> = {};
    const svMap:    Record<string, number> = {};
    const naMap:    Record<string, number> = {};
    const quotaMap: Record<string, number> = {};

    for (const r of siData    ?? []) siMap[r.referenceid]    = (siMap[r.referenceid]    ?? 0) + (Number(r.actual_sales)     || 0);
    for (const r of soData    ?? []) soMap[r.referenceid]    = (soMap[r.referenceid]    ?? 0) + (Number(r.so_amount)        || 0);
    for (const r of obData    ?? []) obMap[r.referenceid]    = (obMap[r.referenceid]    ?? 0) + 1;
    for (const r of qaData    ?? []) qaMap[r.referenceid]    = (qaMap[r.referenceid]    ?? 0) + (Number(r.quotation_amount) || 0);
    for (const r of svData    ?? []) {
      if (r.Status === "Login") svMap[r.ReferenceID] = (svMap[r.ReferenceID] ?? 0) + 1;
    }
    for (const r of naData    ?? []) naMap[r.referenceid]    = (naMap[r.referenceid]    ?? 0) + 1;
    for (const r of quotaData ?? []) quotaMap[r.referenceid] = (quotaMap[r.referenceid] ?? 0) + (Number(r.amount) || 0);

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
