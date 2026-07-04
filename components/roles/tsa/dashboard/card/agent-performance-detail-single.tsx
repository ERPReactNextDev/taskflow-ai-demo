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
  return d.toISOString().slice(0, 10);
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

  // Fetch on mount and whenever referenceid / dateRange changes
  useEffect(() => {
    fetchSiteVisits();
  }, [fetchSiteVisits]);

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
                <td className="text-right py-3 px-1 font-mono">{formatHoursToHMS(tsaResponseTime)}</td>
                <td className="text-right py-3 px-1 font-mono">{formatHoursToHMS(nonQuotationHT)}</td>
                <td className="text-right py-3 px-1 font-mono">{formatHoursToHMS(quotationHT)}</td>
                <td className="text-right py-3 px-1 font-mono">{formatHoursToHMS(spfHandlingDuration)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
