"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** Format a Date to YYYY-MM-DD for API params (Asia/Manila timezone) */
function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiWeightedScoresProps {
  referenceid: string;
  dateCreatedFilterRange?: { from?: Date; to?: Date };
  name?: string;

  // Optional fallback props for backward compatibility
  loading?: boolean;
  runningTarget?: number;
  totalActualSales?: number;
  obCallsCount?: number;
  obCallsTarget?: number;
  quotesCount?: number;
  quotesTarget?: number;
  callsToQuotesCount?: number;
  obCallsForRatio?: number;
  quoteToSOSalesOrderCount?: number;
  quoteToSOQuotationCount?: number;
  soToSIDeliveredCount?: number;
  soToSISalesOrderCount?: number;
  clientVisits?: number;
  clientVisitsTarget?: number;
  avgResponseTime?: number;
  avgQuotationHT?: number;
  avgNonQuotationHT?: number;
  avgSpfHT?: number;
  newAccountCount?: number;
  newAccountTarget?: number;
}

// ─── Rating helpers ───────────────────────────────────────────────────────────

/** Standard: ≥91%→5 | 81-90%→4 | 61-80%→3 | 50-60%→2 | <50%→1 */
function standardRating(pct: number): number {
  if (pct >= 91) return 5;
  if (pct >= 81) return 4;
  if (pct >= 61) return 3;
  if (pct >= 50) return 2;
  return 1;
}

/** Calls→Quote: raw % vs 20% target */
function callsToQuoteRating(pct: number): number {
  if (pct >= 20) return 5;
  if (pct >= 14.01) return 4;
  if (pct >= 12.01) return 3;
  if (pct >= 10.01) return 2;
  return 1;
}

/** Quote→SO: raw % vs 30% target */
function quoteToSORating(pct: number): number {
  if (pct >= 30) return 5;
  if (pct >= 25.01) return 4;
  if (pct >= 20.01) return 3;
  if (pct >= 15.01) return 2;
  return 1;
}

/** SO→SI: raw % vs 70% target */
function soToSIRating(pct: number): number {
  if (pct >= 70) return 5;
  if (pct >= 60.01) return 4;
  if (pct >= 50.01) return 3;
  if (pct >= 40.01) return 2;
  return 1;
}

/**
 * Response Time rating — value in hours, target ≤10 min (0.1667 hrs)
 * No data (0) → 1
 * ≤10min→5 | 11-20min→4 | 21-30min→3 | 31-40min→2 | 41min+→1
 */
function responseTimeRating(hours: number): number {
  if (hours <= 0) return 1; // no data
  const mins = hours * 60;
  if (mins <= 10) return 5;
  if (mins <= 20) return 4;
  if (mins <= 30) return 3;
  if (mins <= 40) return 2;
  return 1;
}

/**
 * Quotation HT rating — value in hours, target ≤8 hrs
 * No data (0) → 1
 * ≤8hrs→5 | 8.01-9→4 | 9.01-10→3 | 10.01-11→2 | 11+→1
 */
function quotationHTRating(hours: number): number {
  if (hours <= 0) return 1; // no data
  if (hours <= 8) return 5;
  if (hours <= 9) return 4;
  if (hours <= 10) return 3;
  if (hours <= 11) return 2;
  return 1;
}

/**
 * Non-Quotation HT rating — value in hours, target ≤24 hrs
 * No data (0) → 1
 * ≤24hrs→5 | 25-30→4 | 31-35→3 | 36-40→2 | 41+→1
 */
function nonQuotationHTRating(hours: number): number {
  if (hours <= 0) return 1; // no data
  if (hours <= 24) return 5;
  if (hours <= 30) return 4;
  if (hours <= 35) return 3;
  if (hours <= 40) return 2;
  return 1;
}

// ─── Score label ──────────────────────────────────────────────────────────────

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 5)
    return { label: "Always Demonstrated", color: "text-yellow-600" };
  if (score >= 4.5)
    return { label: "Often Demonstrated", color: "text-green-600" };
  if (score >= 3.5)
    return { label: "Regularly Demonstrated", color: "text-emerald-500" };
  if (score >= 2.5)
    return { label: "Occasionaly Demonstrated", color: "text-blue-500" };
  if (score >= 1.5)
    return { label: "Seldom Demonstrated", color: "text-amber-500" };
  return { label: "Seldom Demonstrated", color: "text-red-500" };
}

function barColor(score: number): string {
  if (score >= 4.5) return "#16a34a";
  if (score >= 3.5) return "#10b981";
  if (score >= 2.5) return "#3b82f6";
  if (score >= 1.5) return "#f59e0b";
  return "#ef4444";
}

function getStripedBackground(color: string): string {
  // Lighten the color by mixing with white
  const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x00ff) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  };
  const lightColor = lightenColor(color, 30);
  return `repeating-linear-gradient(45deg, ${color}20, ${color}20 10px, ${lightColor}20 10px, ${lightColor}20 20px)`;
}

// ─── KPI row type ─────────────────────────────────────────────────────────────

interface KpiRow {
  label: string;
  weight: number;
  achievementPct: number;
  rating: number;
  weightedScore: number;
}

// ─── Row component ────────────────────────────────────────────────────────────

const KpiRowItem: React.FC<{ row: KpiRow }> = ({ row }) => {
  const weightedMax = row.weight * 5;
  const fillPct = weightedMax > 0 ? (row.weightedScore / weightedMax) * 100 : 0;
  const ratingColor =
    row.rating >= 4
      ? "text-green-600"
      : row.rating >= 3
        ? "text-blue-500"
        : row.rating >= 2
          ? "text-amber-500"
          : "text-red-500";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 truncate">
            {row.label}
          </span>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">
            {Math.round(row.weight * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-gray-100 h-1 rounded-full">
            <div
              className="h-1 rounded-full transition-all"
              style={{
                width: `${Math.min(fillPct, 100)}%`,
                backgroundColor: barColor(row.rating),
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 shrink-0">
            {row.achievementPct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="text-center w-8 shrink-0">
        <span className={`text-sm font-extrabold ${ratingColor}`}>
          {row.rating}
        </span>
        <p className="text-[9px] text-gray-400 leading-none">rating</p>
      </div>
      <div className="text-right w-14 shrink-0">
        <span className="text-sm font-extrabold text-gray-800">
          {row.weightedScore.toFixed(2)}
        </span>
        <p className="text-[9px] text-gray-400 leading-none">
          of {weightedMax.toFixed(2)}
        </p>
      </div>
    </div>
  );
};

// ─── Main card ────────────────────────────────────────────────────────────────

export const KpiWeightedScores: React.FC<KpiWeightedScoresProps> = ({
  referenceid,
  dateCreatedFilterRange,
  name: propName = "—",
  loading: propLoading = false,
  runningTarget: propRunningTarget,
  totalActualSales: propTotalActualSales,
  obCallsCount: propObCallsCount,
  obCallsTarget: propObCallsTarget,
  quotesCount: propQuotesCount,
  quotesTarget: propQuotesTarget,
  callsToQuotesCount: propCallsToQuotesCount,
  obCallsForRatio: _propObCallsForRatio,  // kept for API compat, unused internally
  quoteToSOSalesOrderCount: propQuoteToSOSalesOrderCount,
  quoteToSOQuotationCount: propQuoteToSOQuotationCount,
  soToSIDeliveredCount: propSoToSIDeliveredCount,
  soToSISalesOrderCount: propSoToSISalesOrderCount,
  clientVisits: propClientVisits,
  clientVisitsTarget: propClientVisitsTarget,
  avgResponseTime: propAvgResponseTime,
  avgQuotationHT: propAvgQuotationHT,
  avgNonQuotationHT: propAvgNonQuotationHT,
  newAccountCount: propNewAccountCount,
  newAccountTarget: propNewAccountTarget,
}) => {
  // --- State ---
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(propName);
  const [kpiData, setKpiData] = useState<any>(null);
  const [siteVisitTarget, setSiteVisitTarget] = useState<number>(0);
  const [clientVisitsCount, setClientVisitsCount] = useState<number>(0);
  const [obCallsTarget, setObCallsTarget] = useState<number>(0);
  const [quotesTarget, setQuotesTarget] = useState<number>(0);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // CSR Metrics state (self-fetched like single agent view)
  const [csrMetrics, setCsrMetrics] = useState({
    avgResponseTime: propAvgResponseTime || 0,
    avgQuotationHT: propAvgQuotationHT || 0,
    avgNonQuotationHT: propAvgNonQuotationHT || 0,
    avgSpfHT: 0, // Add SPF handling duration
  });
  const [loadingCsr, setLoadingCsr] = useState(false);

  // Keep name in sync with the prop — it's already resolved by the parent dashboard
  useEffect(() => {
    if (propName) setName(propName);
  }, [propName]);

  // --- Fetch KPI data from our NEW API ---
  const fetchKpiData = useCallback(async () => {
    if (!referenceid) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({ referenceid });
      if (dateCreatedFilterRange?.from) {
        params.append("from", toDateStr(dateCreatedFilterRange.from));
      }
      if (dateCreatedFilterRange?.to) {
        params.append("to", toDateStr(dateCreatedFilterRange.to));
      }

      const res = await fetch(`/api/tsa-kpi?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch KPI data");
      const data = await res.json();
      if (data.success) {
        setKpiData(data.data);
      }
    } catch (err) {
      console.error("Error fetching KPI data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch KPI data");
    }
  }, [referenceid, dateCreatedFilterRange]);

  // --- Fetch Site Visit Target ---
  const fetchSiteVisitTarget = async () => {
    if (!referenceid) return;
    
    try {
      const now = new Date();
      const year = now.getFullYear().toString();
      const monthNames = ["January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"];
      const month = monthNames[now.getMonth()];
      const targetUrl = `/api/site-visit-target?referenceid=${encodeURIComponent(referenceid)}&year=${year}&month=${month}`;
      
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error("Failed to fetch site visit target");
      const data = await res.json();
      const parsedTarget = parseInt(data.target?.target ?? "0") || 10; // Default to 10
      setSiteVisitTarget(parsedTarget);
    } catch (err) {
      console.error("Error fetching site visit target:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch site visit target");
    }
  };

  // --- Fetch Client Visits Count ---
  const fetchClientVisitsCount = async () => {
    if (!referenceid) return;
    
    try {
      const visitsUrl = new URL("/api/fetch-tasklog-supabase", window.location.origin);
      visitsUrl.searchParams.append("referenceid", referenceid);
      
      if (dateCreatedFilterRange?.from) {
        visitsUrl.searchParams.append("from", toDateStr(dateCreatedFilterRange.from));
      }
      if (dateCreatedFilterRange?.to) {
        visitsUrl.searchParams.append("to", toDateStr(dateCreatedFilterRange.to));
      }
      
      const res = await fetch(visitsUrl.toString());
      if (!res.ok) throw new Error("Failed to fetch client visits");
      const data = await res.json();
      const logins = (data.siteVisits || []).filter((v: any) => v.Status === "Login").length;
      setClientVisitsCount(logins);
    } catch (err) {
      console.error("Error fetching client visits count:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch client visits");
    }
  };
  
  // --- Fetch OB Calls Target ---
  // --- Fetch OB Calls Target ---
  // Pass only "from" — targets are monthly commitments and must NOT be prorated
  const fetchObCallsTarget = async () => {
    if (!referenceid) return;
    try {
      const params = new URLSearchParams({ referenceid });
      if (dateCreatedFilterRange?.from) params.append("from", toDateStr(dateCreatedFilterRange.from));
      // Intentionally omit "to" to get the full monthly target, not a prorated fraction
      const res = await fetch(`/api/sales-ob?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch OB target");
      const data = await res.json();
      setObCallsTarget(Number(data.target) || 0);
    } catch (err) {
      console.error("Error fetching OB calls target:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch OB target");
    }
  };
  
  // --- Fetch Quotes Target ---
  // Pass only "from" — targets are monthly commitments and must NOT be prorated
  const fetchQuotesTarget = async () => {
    if (!referenceid) return;
    try {
      const params = new URLSearchParams({ referenceid });
      if (dateCreatedFilterRange?.from) params.append("from", toDateStr(dateCreatedFilterRange.from));
      // Intentionally omit "to" to get the full monthly target, not a prorated fraction
      const res = await fetch(`/api/sales-quotation?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch quotes target");
      const data = await res.json();
      setQuotesTarget(Number(data.quoteTarget) || 0);
    } catch (err) {
      console.error("Error fetching quotes target:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch quotes target");
    }
  };
  
  // --- Fetch CSR Metrics (like single agent view) ---
  const fetchCsrMetrics = useCallback(async () => {
    if (!referenceid) {
      setCsrMetrics({
        avgResponseTime: propAvgResponseTime || 0,
        avgQuotationHT: propAvgQuotationHT || 0,
        avgNonQuotationHT: propAvgNonQuotationHT || 0,
        avgSpfHT: 0,
      });
      return;
    }
    setLoadingCsr(true);
    try {
      const res = await fetch(`/api/act-fetch-activity-v2?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch CSR metrics");
      const result = await res.json();
      const data: any[] = result.data || [];

      const excluded = [
        "Customer Feedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const now = new Date();
      const fromStr = dateCreatedFilterRange?.from ? toDateStr(dateCreatedFilterRange.from) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const toStr   = dateCreatedFilterRange?.to   ? toDateStr(dateCreatedFilterRange.to)   : now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

      const fromTs = new Date(`${fromStr}T00:00:00+08:00`).getTime();
      const toDateObj = new Date(`${toStr}T23:59:59+08:00`);
      const toTs = toDateObj.getTime();

      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0; // Add SPF

      data.forEach((row) => {
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
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT; spfCount++;
        } else {
          nqTotal += baseHT; nqCount++;
        }
      });

      setCsrMetrics({
        avgResponseTime: rtCount ? rtTotal / rtCount : 0,
        avgQuotationHT: qCount ? qTotal / qCount : 0,
        avgNonQuotationHT: nqCount ? nqTotal / nqCount : 0,
        avgSpfHT: spfCount ? spfTotal / spfCount : 0,
      });
    } catch (err) {
      console.error("KpiWeightedScores: error fetching CSR metrics", err);
      setCsrMetrics({
        avgResponseTime: propAvgResponseTime || 0,
        avgQuotationHT: propAvgQuotationHT || 0,
        avgNonQuotationHT: propAvgNonQuotationHT || 0,
        avgSpfHT: 0,
      });
    } finally {
      setLoadingCsr(false);
    }
  }, [referenceid, dateCreatedFilterRange, propAvgResponseTime, propAvgQuotationHT, propAvgNonQuotationHT]);

  // --- Fetch all data ---
  const fetchAllData = useCallback(async () => {
    if (!referenceid) return;
    setLoading(true);
    setHasFetched(true);
    setError(null);
    try {
      await Promise.all([
        fetchKpiData(),
        fetchSiteVisitTarget(),
        fetchClientVisitsCount(),
        fetchObCallsTarget(),
        fetchQuotesTarget(),
        fetchCsrMetrics()
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [referenceid, fetchKpiData, fetchCsrMetrics]);

  // --- Use fallback props if provided, otherwise use API data ---
  const finalClientVisitsTarget = propClientVisitsTarget ?? (siteVisitTarget || 10);
  const finalObCallsTarget = propObCallsTarget ?? (obCallsTarget || 0);
  const finalQuotesTarget = propQuotesTarget ?? (quotesTarget || 0);
  
  const data = propRunningTarget !== undefined
    ? {
        runningTarget: propRunningTarget,
        totalActualSales: propTotalActualSales || 0,
        totalSoAmount: 0,
        totalSoRegular: 0,
        totalSoSPF: 0,
        obCallsCount: propObCallsCount || 0,
        obCallsTarget: finalObCallsTarget,
        quotesCount: propQuotesCount || 0,
        quotesTarget: finalQuotesTarget,
        callsToQuotesCount: propCallsToQuotesCount || 0,        quoteToSOSalesOrderCount: propQuoteToSOSalesOrderCount || 0,
        quoteToSOQuotationCount: propQuoteToSOQuotationCount || 0,
        soToSIDeliveredCount: propSoToSIDeliveredCount || 0,
        soToSISalesOrderCount: propSoToSISalesOrderCount || 0,
        clientVisitsCount: propClientVisits || clientVisitsCount,
        clientVisitsTarget: finalClientVisitsTarget,
        avgResponseTime: csrMetrics.avgResponseTime,
        avgQuotationHT: csrMetrics.avgQuotationHT,
        avgNonQuotationHT: csrMetrics.avgNonQuotationHT,
        newAccountCount: propNewAccountCount || 0,
        newAccountTarget: propNewAccountTarget || 3,
      }
    : {
        ...(kpiData || {}),
        obCallsTarget: finalObCallsTarget,
        quotesTarget: finalQuotesTarget,
        clientVisitsCount,
        clientVisitsTarget: finalClientVisitsTarget,
        avgResponseTime: csrMetrics.avgResponseTime,
        avgQuotationHT: csrMetrics.avgQuotationHT,
        avgNonQuotationHT: csrMetrics.avgNonQuotationHT,
      };

  const finalName = propName !== "—" ? propName : name;
  const finalLoading = propLoading || loading;

  // --- Calculate all the KPI scores ---
  // 1. Sales SO/SI — 50%
  const salesPct = Math.min(
    100,
    data.runningTarget > 0 ? (data.totalActualSales / data.runningTarget) * 100 : 0
  );
  const salesRating = standardRating(salesPct);
  const salesW = 0.5 * salesRating;

  // 2. OB Calls — 10%
  const obPct = Math.min(
    100,
    data.obCallsTarget > 0 ? (data.obCallsCount / data.obCallsTarget) * 100 : 0
  );
  const obRating = standardRating(obPct);
  const obW = 0.1 * obRating;

  // 3a. Quotes Generated (No. of Quotation) — 5%
  const quotesPct = Math.min(
    100,
    data.quotesTarget > 0 ? (data.quotesCount / data.quotesTarget) * 100 : 0
  );
  const quotesRating = standardRating(quotesPct);
  const quotesW = 0.05 * quotesRating;

  // 3b. Amount of Quotation — 5%
  const quotationAmountActual = data.quotationAmountActual ?? 0;
  const quotationAmountTarget = data.quotationAmountTarget ?? 0;
  const quotationAmtPct = Math.min(
    100,
    quotationAmountTarget > 0 ? (quotationAmountActual / quotationAmountTarget) * 100 : 0
  );
  const quotationAmtRating = standardRating(quotationAmtPct);
  const quotationAmtW = 0.05 * quotationAmtRating;

  // 4. Conversion Metrics — combined 5%
  // Raw conversion %s (used for rating — can exceed target)
  const c2qRawPct =
    data.obCallsCount > 0
      ? (data.callsToQuotesCount / data.obCallsCount) * 100
      : 0;
  const c2qRating = callsToQuoteRating(c2qRawPct);
  // Achievement % capped at 100 — how close to the target (20%), max 100%
  const c2qAchievePct = Math.min(100, (c2qRawPct / 20) * 100);

  const q2soPct =
    data.quoteToSOQuotationCount > 0
      ? (data.quoteToSOSalesOrderCount / data.quoteToSOQuotationCount) * 100
      : 0;
  const q2soRating = quoteToSORating(q2soPct);
  // Achievement % capped at 100 — how close to the target (30%), max 100%
  const q2soAchievePct = Math.min(100, (q2soPct / 30) * 100);

  const s2siPct =
    data.soToSISalesOrderCount > 0
      ? (data.soToSIDeliveredCount / data.soToSISalesOrderCount) * 100
      : 0;
  const s2siRating = soToSIRating(s2siPct);
  // Achievement % capped at 100 — how close to the target (70%), max 100%
  const s2siAchievePct = Math.min(100, (s2siPct / 70) * 100);

  const convRating = Math.round((c2qRating + q2soRating + s2siRating) / 3);
  // Average of the three capped achievement %s — also capped at 100%
  const convAchievePct = Math.min(
    100,
    (c2qAchievePct + q2soAchievePct + s2siAchievePct) / 3
  );
  const convW = 0.05 * convRating;

  // 5. Client Visits — 10%
  const cvPct = Math.min(
    100,
    data.clientVisitsTarget > 0 ? (data.clientVisitsCount / data.clientVisitsTarget) * 100 : 0
  );
  const cvRating = standardRating(cvPct);
  const cvW = 0.1 * cvRating;

  // 6. CSR Metrics — combined 5%
  const rtRating = responseTimeRating(data.avgResponseTime);
  const rtAchievePct =
    data.avgResponseTime > 0
      ? Math.min(((10 / 60) / data.avgResponseTime) * 100, 100)
      : 0;

  const qhtRating = quotationHTRating(data.avgQuotationHT);
  const qhtAchievePct =
    data.avgQuotationHT > 0
      ? Math.min((8 / data.avgQuotationHT) * 100, 100)
      : 0;

  const nqhtRating = nonQuotationHTRating(data.avgNonQuotationHT);
  const nqhtAchievePct =
    data.avgNonQuotationHT > 0
      ? Math.min((24 / data.avgNonQuotationHT) * 100, 100)
      : 0;

  const csrRating = Math.round((rtRating + qhtRating + nqhtRating) / 3);
  const csrAchievePct = (rtAchievePct + qhtAchievePct + nqhtAchievePct) / 3;
  const csrW = 0.05 * csrRating;

  // 7. New Account Development — 10%, target 2/month
  const naPct = Math.min(
    100,
    data.newAccountTarget > 0 ? (data.newAccountCount / data.newAccountTarget) * 100 : 0
  );
  const naRating = standardRating(naPct);
  const naW = 0.1 * naRating;

  // Total
  const totalScore =
    salesW + obW + quotesW + quotationAmtW + convW + cvW + csrW + naW;
  const { label: statusLabel, color: statusColor } = scoreLabel(totalScore);
  const totalFillPct = (totalScore / 5) * 100;

  const rows: KpiRow[] = [
    {
      label: "Sales Performance",
      weight: 0.5,
      achievementPct: salesPct,
      rating: salesRating,
      weightedScore: salesW,
    },
    {
      label: "OB Calls (Successful)",
      weight: 0.1,
      achievementPct: obPct,
      rating: obRating,
      weightedScore: obW,
    },
    {
      label: "Quotes Generated (No. of Quotation)",
      weight: 0.05,
      achievementPct: quotesPct,
      rating: quotesRating,
      weightedScore: quotesW,
    },
    {
      label: `Amount of Quotation (target: ₱${quotationAmountTarget > 0 ? quotationAmountTarget.toLocaleString() : "—"})`,
      weight: 0.05,
      achievementPct: quotationAmtPct,
      rating: quotationAmtRating,
      weightedScore: quotationAmtW,
    },
    {
      label: "Conversion Metrics (Calls→Quote · Quote→SO · SO→SI)",
      weight: 0.05,
      achievementPct: convAchievePct,
      rating: convRating,
      weightedScore: convW,
    },
    {
      label: `Client Visits (target: ${data.clientVisitsTarget})`,
      weight: 0.1,
      achievementPct: cvPct,
      rating: cvRating,
      weightedScore: cvW,
    },
    {
      label: "CSR Metrics (Response Time · Quotation HT · Non-Quotation HT)",
      weight: 0.05,
      achievementPct: csrAchievePct,
      rating: csrRating,
      weightedScore: csrW,
    },
    {
      label: `New Account Development (target: ${data.newAccountTarget}/mo)`,
      weight: 0.1,
      achievementPct: naPct,
      rating: naRating,
      weightedScore: naW,
    },
  ];

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col p-6 gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            KPI weighted scores (out of 5.0)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllData}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors"
            >
              Generate Data
            </button>
            {finalLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Spinner className="w-3.5 h-3.5" />
                <span>Loading...</span>
              </div>
            ) : null}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Empty state if not fetched yet */}
        {!hasFetched && !error ? (
          <p className="text-xs text-gray-400 text-center py-8">
            Click "Fetch Data" to load KPI scores.
          </p>
        ) : null}

        {/* KPI content (blurred if loading) */}
        {hasFetched && (
          <div className={`transition-all duration-300 relative ${finalLoading ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
            {/* Loading overlay while fetching */}
            {finalLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Spinner className="w-5 h-5" />
                  <span>Calculating scores...</span>
                </div>
              </div>
            )}

            {/* KPI display */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* Score summary */}
              <div
                className="rounded-xl p-5 flex flex-col gap-3 min-w-[200px] md:w-56 shrink-0"
                style={{
                  backgroundImage: getStripedBackground(barColor(totalScore)),
                  backgroundSize: "20px 20px",
                }}
              >
                <p className="text-sm font-semibold text-gray-800">{finalName}</p>
                <p className={`text-5xl font-extrabold leading-none ${statusColor}`}>
                  {totalScore.toFixed(2)}
                </p>
                <div className="w-full bg-gray-200 h-2 rounded-full">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(totalFillPct, 100)}%`,
                      backgroundColor: barColor(totalScore),
                    }}
                  />
                </div>
                <p className={`text-xs font-medium ${statusColor}`}>{statusLabel}</p>
              </div>

              {/* KPI breakdown */}
              <div className="flex-1 flex flex-col justify-center divide-y divide-gray-50">
                {rows.map((row) => (
                  <KpiRowItem key={row.label} row={row} />
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};