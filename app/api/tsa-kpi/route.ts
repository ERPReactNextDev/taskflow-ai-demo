import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

// ── CSR helpers (same logic as csr.tsx / tsm-kpi) ────────────────────────────

const CSR_EXCLUDED = [
  "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
  "Supplier/Vendor Product Offer", "Internal Whistle Blower",
  "Threats/Extortion/Intimidation", "Prank Call",
];

async function calcCsrMetrics(
  referenceid: string,
  fromISO: string,
  toISO: string
): Promise<{
  avgResponseTime: number;
  avgQuotationHT: number;
  avgNonQuotationHT: number;
  avgSpfHT: number;
}> {
  try {
    const db  = await connectToDatabase();
    const col = db.collection("activity");

    const rows = await col
      .find({ $or: [{ referenceid }, { agent: referenceid }] })
      .toArray();

    const fromTs = new Date(fromISO).getTime();
    const toTs   = new Date(toISO).getTime();

    let rtTotal = 0, rtCount = 0;
    let nqTotal = 0, nqCount = 0;
    let qTotal  = 0, qCount  = 0;
    let spfTotal = 0, spfCount = 0;

    for (const row of rows) {
      if (row.status !== "Closed" && row.status !== "Converted into Sales") continue;
      const created = new Date(row.date_created).getTime();
      if (isNaN(created) || created < fromTs || created > toTs) continue;
      if (CSR_EXCLUDED.includes(row.wrap_up)) continue;

      const tsaAck   = new Date(row.tsa_acknowledge_date).getTime();
      const endorsed = new Date(row.ticket_endorsed).getTime();
      if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
        rtTotal += (tsaAck - endorsed) / 3600000;
        rtCount++;
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
        qTotal += baseHT; qCount++;
      } else if (remarks.includes("SPF")) {
        spfTotal += baseHT; spfCount++;
      } else {
        nqTotal += baseHT; nqCount++;
      }
    }

    return {
      avgResponseTime:   rtCount  ? rtTotal  / rtCount  : 0,
      avgQuotationHT:    qCount   ? qTotal   / qCount   : 0,
      avgNonQuotationHT: nqCount  ? nqTotal  / nqCount  : 0,
      avgSpfHT:          spfCount ? spfTotal / spfCount : 0,
    };
  } catch (err) {
    console.error("tsa-kpi CSR metrics error:", err);
    return { avgResponseTime: 0, avgQuotationHT: 0, avgNonQuotationHT: 0, avgSpfHT: 0 };
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from        = url.searchParams.get("from"); // YYYY-MM-DD
    const to          = url.searchParams.get("to");   // YYYY-MM-DD

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing referenceid" },
        { status: 400 }
      );
    }

    // ── Date scoping (all times in Asia/Manila = UTC+8) ───────────────────────
    const now      = new Date();
    const year     = from
      ? new Date(`${from}T00:00:00+08:00`).getFullYear().toString()
      : now.getFullYear().toString();

    // Derive current month bounds in Manila time
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(new Date(Number(mYear), Number(mMonth), 0).getDate()).padStart(2, "0")}`;

    // All actuals use +08:00 offset
    const rangeStart = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const rangeEnd   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    // New account dev: use selected month or current month
    const naRefStr  = from ?? manilaToday;
    const [naYear, naMonth] = naRefStr.split("-");
    const naDays    = new Date(Number(naYear), Number(naMonth), 0).getDate();
    const naFrom    = from ?? `${naYear}-${naMonth}-01`;
    const naTo      = to   ?? `${naYear}-${naMonth}-${String(naDays).padStart(2, "0")}`;

    // ── Parallel fetches ──────────────────────────────────────────────────────
    const [
      salesQuotaRes,
      historySiRes,
      historySoRes,
      historyOutboundRes,
      salesObRes,
      historyQuotationsRes,
      salesQuotationRes,
      historyCallsToQuotesRes,
      historyQuoteToSORes,
      historySoToSiRes,
      fetchTasklogRes,
      newAccCountRes,
      newAccTargetRes,
      csrMetrics,
    ] = await Promise.all([
      // 1. Sales
      fetch(`${url.origin}/api/sales-quota?referenceid=${encodeURIComponent(referenceid)}&year=${year}`),
      fetch(`${url.origin}/api/history?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/history-so?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 2. OB
      fetch(`${url.origin}/api/history-outbound?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/sales-ob?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}`),
      // 3. Quotes
      fetch(`${url.origin}/api/history-quotations?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/sales-quotation?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}`),      // 4. Conversion
      fetch(`${url.origin}/api/history-calls-to-quotes?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/history-quote-to-so?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/history-so-to-si?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 5. Client Visits
      fetch(`${url.origin}/api/fetch-tasklog-supabase?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 7. New Account Dev
      fetch(`${url.origin}/api/account-development-plan/count?referenceid=${encodeURIComponent(referenceid)}&from=${naFrom}&to=${naTo}`),
      fetch(`${url.origin}/api/sales-account-development?referenceid=${encodeURIComponent(referenceid)}&from=${naFrom}`),
      // 6. CSR Metrics — computed from MongoDB activity collection
      calcCsrMetrics(referenceid, rangeStart, rangeEnd),
    ]);

    const [
      salesQuotaData,
      historySiData,
      historySoData,
      historyOutboundData,
      salesObData,
      historyQuotationsData,
      salesQuotationData,
      historyCallsToQuotesData,
      historyQuoteToSOData,
      historySoToSiData,
      fetchTasklogData,
      newAccCountData,
      newAccTargetData,
    ] = await Promise.all([
      salesQuotaRes.json(),
      historySiRes.json(),
      historySoRes.json(),
      historyOutboundRes.json(),
      salesObRes.json(),
      historyQuotationsRes.json(),
      salesQuotationRes.json(),
      historyCallsToQuotesRes.json(),
      historyQuoteToSORes.json(),
      historySoToSiRes.json(),
      fetchTasklogRes.json(),
      newAccCountRes.json(),
      newAccTargetRes.json(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        // 1. Sales Performance
        runningTarget:            Number(salesQuotaData.total)                        || 0,
        totalActualSales:         Number(historySiData.total)                         || 0,
        totalSoAmount:            Number(historySoData.total)                         || 0,
        totalSoRegular:           Number(historySoData.totalRegular)                  || 0,
        totalSoSPF:               Number(historySoData.totalSPF)                      || 0,
        // 2. OB Calls
        obCallsCount:             Number(historyOutboundData.count)                   || 0,
        obCallsTarget:            Number(salesObData.target)                          || 0,
        // 3. Quotes Generated
        quotesCount:              Number(historyQuotationsData.count)                 || 0,
        quotesTarget:             Number(salesQuotationData.quoteTarget)              || 120,
        quotationAmountActual:    Number(historyQuotationsData.totalAmount)           || 0,
        quotationAmountTarget:    Number(salesQuotationData.quotationAmountTarget)    || 0,
        // 4. Conversion Metrics
        callsToQuotesCount:       Number(historyCallsToQuotesData.count)              || 0,
        quoteToSOSalesOrderCount: Number(historyQuoteToSOData.quoteToSOSalesOrderCount) || 0,
        quoteToSOQuotationCount:  Number(historyQuoteToSOData.quoteToSOQuotationCount)  || 0,
        soToSIDeliveredCount:     Number(historySoToSiData.soToSIDeliveredCount)      || 0,
        soToSISalesOrderCount:    Number(historySoToSiData.soToSISalesOrderCount)     || 0,
        // 5. Client Visits
        clientVisitsCount:        Number(fetchTasklogData.count)                      || 0,
        clientVisitsTarget:       80,
        // 6. CSR Metrics — live from MongoDB
        avgResponseTime:          csrMetrics.avgResponseTime,
        avgQuotationHT:           csrMetrics.avgQuotationHT,
        avgNonQuotationHT:        csrMetrics.avgNonQuotationHT,
        avgSpfHT:                 csrMetrics.avgSpfHT,
        // 7. New Account Development
        newAccountCount:          Number(newAccCountData.count)                       || 0,
        newAccountTarget:         Number(newAccTargetData.target)                     || 2,
      },
    }, { status: 200 });
  } catch (err: any) {
    console.error("Error in tsa-kpi API:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch KPI data" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
