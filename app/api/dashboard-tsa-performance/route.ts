import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing reference ID." },
        { status: 400 }
      );
    }

    const now          = new Date();
    const currentYear  = now.getFullYear().toString();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    // Running SI/SO use the range start (or year start if no range)
    const yearStart  = from ? `${from}T00:00:00Z` : `${currentYear}-01-01T00:00:00Z`;
    // Pipeline / monthly metrics always use current month start — not affected by date filter
    const monthStart = `${currentYear}-${currentMonth}-01T00:00:00Z`;
    const rangeEnd   = to   ? `${to}T23:59:59Z`   : null;

    // ── All queries run in parallel — no internal API calls ──────────────────
    // ── Build date-aware queries ──────────────────────────────────────────────
    const siQuery = (() => {
      let q = supabase.from("history").select("actual_sales")
        .eq("referenceid", referenceid).eq("type_activity", "Delivered / Closed Transaction").gte("date_created", yearStart);
      if (rangeEnd) q = q.lte("date_created", rangeEnd);
      return q;
    })();
    const soQuery = (() => {
      let q = supabase.from("history").select("so_amount")
        .eq("referenceid", referenceid).eq("status", "SO-Done").gte("date_created", yearStart);
      if (rangeEnd) q = q.lte("date_created", rangeEnd);
      return q;
    })();
    const obQuery = (() => {
      const q = supabase.from("history").select("id", { count: "exact", head: true })
        .eq("referenceid", referenceid).eq("source", "Outbound - Touchbase").gte("date_created", monthStart);
      return q;
    })();
    const quotationsQuery = (() => {
      const q = supabase.from("history").select("quotation_number", { count: "exact" })
        .eq("referenceid", referenceid).eq("type_activity", "Quotation Preparation")
        .or("tsm_approved_status.eq.Approved By Sales Head,tsm_approved_status.eq.Approved")
        .gte("date_created", monthStart);
      return q;
    })();
    const pipelineQuery = (() => {
      const q = supabase.from("history").select("activity_reference_number, source, type_activity")
        .eq("referenceid", referenceid).gte("date_created", monthStart);
      return q;
    })();

    // ── Client visits via Supabase tasklog ────────────────────────────────────
    const clientVisitsQuery = (() => {
      const q = supabase
        .from("tasklog")
        .select("id", { count: "exact", head: true })
        .eq("ReferenceID", referenceid)
        .eq("Status", "Login")
        .gte("date_created", monthStart);
      return q;
    })();

    const [
      userRes,
      quotaRes,
      siRes,
      soRes,
      outboundRes,
      quotationsRes,
      pipelineRes,
      clientVisitsRes,
    ] = await Promise.all([

      // 1. User name
      supabase.from("users").select("Firstname, Lastname").eq("ReferenceID", referenceid).single(),

      // 2. Running target — sum of YTD sales_quota amounts
      supabase.from("sales_quota").select("amount").eq("referenceid", referenceid).eq("year", currentYear),

      // 3. Running SI
      siQuery,

      // 4. Running SO
      soQuery,

      // 5. OB Calls count
      obQuery,

      // 6. Approved quotations count
      quotationsQuery,

      // 7. Pipeline records
      pipelineQuery,

      // 8. Client visits — Supabase tasklog Login count
      clientVisitsQuery,
    ]);

    // ── Running Target ────────────────────────────────────────────────────────
    if (quotaRes.error) throw quotaRes.error;
    const runningTarget = (quotaRes.data ?? []).reduce(
      (sum, r) => sum + (Number(r.amount) || 0), 0
    );

    // ── Running SI ────────────────────────────────────────────────────────────
    if (siRes.error) throw siRes.error;
    const runningSI = (siRes.data ?? []).reduce(
      (sum, r) => sum + (Number(r.actual_sales) || 0), 0
    );

    // ── Running SO ────────────────────────────────────────────────────────────
    if (soRes.error) throw soRes.error;
    const runningSO = (soRes.data ?? []).reduce(
      (sum, r) => sum + (Number(r.so_amount) || 0), 0
    );

    // ── OB Calls ──────────────────────────────────────────────────────────────
    if (outboundRes.error) throw outboundRes.error;
    const obCalls = outboundRes.count ?? 0;

    // ── Quotations ────────────────────────────────────────────────────────────
    if (quotationsRes.error) throw quotationsRes.error;
    const quotationsCount = quotationsRes.count ?? 0;

    // ── SI % and SO % — activity grouping ────────────────────────────────────
    if (pipelineRes.error) throw pipelineRes.error;

    const groups = new Map<
      string,
      { hasOutbound: boolean; hasQuotation: boolean; hasSalesOrder: boolean; hasDelivered: boolean }
    >();

    for (const rec of pipelineRes.data ?? []) {
      if (!rec.activity_reference_number) continue;
      if (!groups.has(rec.activity_reference_number)) {
        groups.set(rec.activity_reference_number, {
          hasOutbound: false,
          hasQuotation: false,
          hasSalesOrder: false,
          hasDelivered: false,
        });
      }
      const g = groups.get(rec.activity_reference_number)!;
      if (rec.source === "Outbound - Touchbase")                          g.hasOutbound   = true;
      if (rec.type_activity === "Quotation Preparation")                  g.hasQuotation  = true;
      if (rec.type_activity === "Sales Order Preparation")                g.hasSalesOrder = true;
      if (rec.type_activity === "Delivered / Closed Transaction")         g.hasDelivered  = true;
    }

    let quoteToSOQuotationCount  = 0;
    let quoteToSOSalesOrderCount = 0;
    let soToSISalesOrderCount    = 0;
    let soToSIDeliveredCount     = 0;

    groups.forEach((g) => {
      if (g.hasOutbound && g.hasQuotation)                                         quoteToSOQuotationCount++;
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)                      quoteToSOSalesOrderCount++;
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder)                      soToSISalesOrderCount++;
      if (g.hasOutbound && g.hasQuotation && g.hasSalesOrder && g.hasDelivered)    soToSIDeliveredCount++;
    });

    const soPercentage = quoteToSOQuotationCount > 0
      ? Math.round((quoteToSOSalesOrderCount / quoteToSOQuotationCount) * 100)
      : 0;

    const siPercentage = soToSISalesOrderCount > 0
      ? Math.round((soToSIDeliveredCount / soToSISalesOrderCount) * 100)
      : 0;

    // ── User name ─────────────────────────────────────────────────────────────
    const userName = userRes.data
      ? `${userRes.data.Firstname ?? ""} ${userRes.data.Lastname ?? ""}`.trim()
      : referenceid;

    // ── Status — based on SI% vs 70% target ──────────────────────────────────
    const siTarget = 70;
    const status: "On track" | "At risk" | "Below target" =
      siPercentage >= siTarget            ? "On track"     :
      siPercentage >= siTarget * 0.7      ? "At risk"      :
                                            "Below target";

    return NextResponse.json(
      {
        success: true,
        name: userName,
        referenceid,
        runningTarget,
        runningSI,
        runningSO,
        siPercentage,
        soPercentage,
        obCalls,
        quotationsCount,
        clientVisits: clientVisitsRes.count ?? 0,
        status,
        // Conversion pipeline counts (used by KpiWeightedScores & SalesPipelineCard)
        quoteToSOQuotationCount,
        quoteToSOSalesOrderCount,
        soToSISalesOrderCount,
        soToSIDeliveredCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error fetching TSA performance detail:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch TSA performance detail." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
