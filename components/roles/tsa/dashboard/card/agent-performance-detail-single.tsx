"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, User } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateRange {
  from?: Date;
  to?: Date;
}

interface AgentPerformanceDetailSingleProps {
  /** ReferenceID of the TSA — used to self-fetch site visits */
  referenceid?: string;
  /** Date range filter forwarded to the site-visits API */
  dateRange?: DateRange;

  name?: string;
  plan: number;
  siActual: number;
  soActual: number;
  siPercentage: number;
  obCalls: number;
  /** Optional fallback — used only if referenceid is not provided */
  siteVisits?: number;
  siteVisitTarget: any;
  accountDevelopment: number;
  timeSpentMs: number;
  quotationAmount: number;
  tsaResponseTime: number;
  nonQuotationHT: number;
  quotationHT: number;
  spfHandlingDuration: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function formatTimeSpent(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatHoursToHMS(hours: number): string {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatCurrency(amount: number): string {
  if (!amount) return "—";
  return `₱${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AgentPerformanceDetailSingle: React.FC<AgentPerformanceDetailSingleProps> = ({
  referenceid,
  dateRange,
  name = "—",
  plan = 0,
  siActual = 0,
  soActual = 0,
  siPercentage = 0,
  obCalls = 0,
  siteVisits: siteVisitsProp = 0,
  siteVisitTarget,
  accountDevelopment = 0,
  timeSpentMs = 0,
  quotationAmount = 0,
  tsaResponseTime = 0,
  nonQuotationHT = 0,
  quotationHT = 0,
  spfHandlingDuration = 0,
}) => {
  const target = siteVisitTarget?.target ? parseInt(siteVisitTarget.target) : 0;

  // ── Self-fetch site visits from /api/fetch-tasklog-supabase ───────────────
  const [siteVisitsCount, setSiteVisitsCount] = useState<number>(siteVisitsProp);
  const [loadingSiteVisits, setLoadingSiteVisits] = useState(false);

  // ── Self-fetch CSR metrics from /api/act-fetch-activity-v2 ────────────────
  const [csrMetrics, setCsrMetrics] = useState({
    avgResponseTime: tsaResponseTime,
    avgQuotationHT: quotationHT,
    avgNonQuotationHT: nonQuotationHT,
    avgSpfHT: spfHandlingDuration,
  });
  const [loadingCsr, setLoadingCsr] = useState(false);

  const fetchSiteVisits = useCallback(async () => {
    if (!referenceid) {
      // Fall back to the prop value if no referenceid
      setSiteVisitsCount(siteVisitsProp);
      return;
    }
    setLoadingSiteVisits(true);
    try {
      const url = new URL("/api/fetch-tasklog-supabase", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      if (dateRange?.from) url.searchParams.append("from", toDateStr(dateRange.from));
      if (dateRange?.to)   url.searchParams.append("to",   toDateStr(dateRange.to));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch site visits");
      const data = await res.json();

      // Count only Login status entries — same logic as the parent dashboard
      const count = (data.siteVisits ?? []).filter((v: any) => v.Status === "Login").length;
      setSiteVisitsCount(count);
    } catch (err) {
      console.error("AgentPerformanceDetailSingle: error fetching site visits", err);
      setSiteVisitsCount(siteVisitsProp);
    } finally {
      setLoadingSiteVisits(false);
    }
  }, [referenceid, dateRange, siteVisitsProp]);

  const fetchCsrMetrics = useCallback(async () => {
    if (!referenceid) {
      setCsrMetrics({
        avgResponseTime: tsaResponseTime,
        avgQuotationHT: quotationHT,
        avgNonQuotationHT: nonQuotationHT,
        avgSpfHT: spfHandlingDuration,
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
        "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const now = new Date();
      const fromStr = dateRange?.from ? toDateStr(dateRange.from) : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const toStr   = dateRange?.to   ? toDateStr(dateRange.to)   : now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

      const fromTs = new Date(`${fromStr}T00:00:00+08:00`).getTime();
      const toDateObj = new Date(`${toStr}T23:59:59+08:00`);
      const toTs = toDateObj.getTime();

      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0;

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
      console.error("AgentPerformanceDetailSingle: error fetching CSR metrics", err);
      setCsrMetrics({
        avgResponseTime: tsaResponseTime,
        avgQuotationHT: quotationHT,
        avgNonQuotationHT: nonQuotationHT,
        avgSpfHT: spfHandlingDuration,
      });
    } finally {
      setLoadingCsr(false);
    }
  }, [referenceid, dateRange, tsaResponseTime, quotationHT, nonQuotationHT, spfHandlingDuration]);

  // Fetch on mount and whenever referenceid / dateRange changes
  useEffect(() => {
    fetchSiteVisits();
    fetchCsrMetrics();
  }, [fetchSiteVisits, fetchCsrMetrics]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
          Agent performance detail
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-1 font-medium text-gray-500">Agent</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">Plan</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">SI Actual</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">SO Actual</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">SI %</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">OB Calls</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">Quotation Amount</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">Site Visits</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">Account Dev</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">Time Spent</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">TSA Response Time</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">Non-Quotation HT</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">Quotation HT</th>
                <th className="text-right py-2 px-1 font-medium text-gray-500">SPF Handling Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-1">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="font-medium text-gray-800">{name}</span>
                  </div>
                </td>
                <td className="text-right py-3 px-1 font-mono">₱{plan.toLocaleString()}</td>
                <td className="text-right py-3 px-1 font-mono text-green-600">₱{siActual.toLocaleString()}</td>
                <td className="text-right py-3 px-1 font-mono">₱{soActual.toLocaleString()}</td>
                <td className="text-right py-3 px-1 font-mono font-medium">
                  <span className={siPercentage >= 100 ? "text-green-600" : siPercentage >= 70 ? "text-yellow-600" : "text-red-600"}>
                    {siPercentage}%
                  </span>
                </td>
                <td className="text-right py-3 px-1 font-mono">{obCalls.toLocaleString()}</td>
                <td className="text-right py-3 px-1 font-mono">{formatCurrency(quotationAmount)}</td>
                <td className="text-right py-3 px-1 font-mono">
                  {loadingSiteVisits ? (
                    <span className="text-gray-400 animate-pulse">…</span>
                  ) : (
                    <span>{siteVisitsCount}</span>
                  )}
                </td>
                <td className="text-right py-3 px-1 font-mono">{accountDevelopment.toLocaleString()}</td>
                <td className="text-right py-3 px-1 font-mono">{formatTimeSpent(timeSpentMs)}</td>
                <td className="text-right py-3 px-1 font-mono">
                  {loadingCsr ? (
                    <span className="text-gray-400 animate-pulse">…</span>
                  ) : (
                    formatHoursToHMS(csrMetrics.avgResponseTime)
                  )}
                </td>
                <td className="text-right py-3 px-1 font-mono">
                  {loadingCsr ? (
                    <span className="text-gray-400 animate-pulse">…</span>
                  ) : (
                    formatHoursToHMS(csrMetrics.avgNonQuotationHT)
                  )}
                </td>
                <td className="text-right py-3 px-1 font-mono">
                  {loadingCsr ? (
                    <span className="text-gray-400 animate-pulse">…</span>
                  ) : (
                    formatHoursToHMS(csrMetrics.avgQuotationHT)
                  )}
                </td>
                <td className="text-right py-3 px-1 font-mono">
                  {loadingCsr ? (
                    <span className="text-gray-400 animate-pulse">…</span>
                  ) : (
                    formatHoursToHMS(csrMetrics.avgSpfHT)
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
