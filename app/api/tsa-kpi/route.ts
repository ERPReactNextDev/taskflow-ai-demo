import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing referenceid" },
        { status: 400 }
      );
    }

    const now = new Date();
    const year = from
      ? new Date(from).getFullYear().toString()
      : new Date().getFullYear().toString();

    // Derive the month scope for New Account Dev:
    // Use the "from" date's month if provided, otherwise current month.
    // Always pass both from+to so the count API scopes to the correct month.
    const refDate = from ? new Date(from) : now;
    const naFrom  = from ?? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-01`;
    const naTo    = to   ?? `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

    // --- Fetch all data in parallel ---
    const [
      // 1. Sales Performance
      salesQuotaRes,
      historySiRes,
      historySoRes,
      // 2. OB Calls
      historyOutboundRes,
      salesObRes,
      // 3. Quotes
      historyQuotationsRes,
      salesQuotationRes,
      // 4. Conversion Metrics
      historyCallsToQuotesRes,
      historyQuoteToSORes,
      historySoToSiRes,
      // 5. Client Visits
      fetchTasklogRes,
      // 7. New Account Dev (monthly only)
      newAccCountRes,
      newAccTargetRes,
    ] = await Promise.all([
      // 1. Sales
      fetch(`${url.origin}/api/sales-quota?referenceid=${encodeURIComponent(referenceid)}&year=${year}`),
      fetch(`${url.origin}/api/history?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/history-so?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 2. OB
      fetch(`${url.origin}/api/history-outbound?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/sales-ob?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 3. Quotes
      fetch(`${url.origin}/api/history-quotations?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/sales-quotation?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 4. Conversion
      fetch(`${url.origin}/api/history-calls-to-quotes?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/history-quote-to-so?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      fetch(`${url.origin}/api/history-so-to-si?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 5. Client Visits
      fetch(`${url.origin}/api/fetch-tasklog-supabase?referenceid=${encodeURIComponent(referenceid)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`),
      // 7. New Account Dev — scoped to the selected month (or current month if no range)
      fetch(`${url.origin}/api/account-development-plan/count?referenceid=${encodeURIComponent(referenceid)}&from=${naFrom}&to=${naTo}`),
      fetch(`${url.origin}/api/sales-account-development?referenceid=${encodeURIComponent(referenceid)}&from=${naFrom}`),
    ]);

    // --- Parse all responses ---
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

    // --- Return compiled data ---
    return NextResponse.json({
      success: true,
      data: {
        // 1. Sales Performance
        runningTarget: Number(salesQuotaData.total) || 0,
        totalActualSales: Number(historySiData.total) || 0,
        totalSoAmount: Number(historySoData.total) || 0,
        totalSoRegular: Number(historySoData.totalRegular) || 0,
        totalSoSPF: Number(historySoData.totalSPF) || 0,
        // 2. OB Calls
        obCallsCount: Number(historyOutboundData.count) || 0,
        obCallsTarget: Number(salesObData.target) || 0,
        // 3. Quotes Generated
        quotesCount: Number(historyQuotationsData.count) || 0,
        quotesTarget: Number(salesQuotationData.target) || 120,
        // 4. Conversion Metrics
        callsToQuotesCount: Number(historyCallsToQuotesData.count) || 0,
        quoteToSOSalesOrderCount: Number(historyQuoteToSOData.quoteToSOSalesOrderCount) || 0,
        quoteToSOQuotationCount: Number(historyQuoteToSOData.quoteToSOQuotationCount) || 0,
        soToSIDeliveredCount: Number(historySoToSiData.soToSIDeliveredCount) || 0,
        soToSISalesOrderCount: Number(historySoToSiData.soToSISalesOrderCount) || 0,
        // 5. Client Visits
        clientVisitsCount: Number(fetchTasklogData.count) || 0,
        clientVisitsTarget: 80,
        // 6. CSR Metrics (keep as 0)
        avgResponseTime: 0,
        avgQuotationHT: 0,
        avgNonQuotationHT: 0,
        // 7. New Account Development
        newAccountCount: Number(newAccCountData.count) || 0,
        newAccountTarget: Number(newAccTargetData.target) || 2,
      }
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