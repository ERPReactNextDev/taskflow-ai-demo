"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { User } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateRange { from?: Date; to?: Date; }

interface ManagerAgentPerformanceDetailProps {
  manager: string;
  dateRange?: DateRange;
}

interface AgentRow {
  referenceid: string;
  name: string;
  plan: number;
  siActual: number;
  soActual: number;
  siPercentage: number;
  obCalls: number;
  obCallsTarget: number;
  callsToQuote: number;
  quoteToSOQuotation: number;
  quoteToSOSalesOrder: number;
  soToSISalesOrder: number;
  soToSIDelivered: number;
  quotationAmountTarget: number;
  quotationAmount: number;
  siteVisits: number;
  siteVisitTarget: number;
  accountDevelopment: number;
  accountDevelopmentTarget: number;
  dbCoverageCovered: number;
  dbCoverageTotal: number;
  timeSpentMs: number;
  avgResponseTime: number;
  avgNonQuotationHT: number;
  avgQuotationHT: number;
  avgSpfHT: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function fmtPeso(n: number): string {
  if (!n) return "—";
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTimeMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

function fmtHoursHMS(hours: number): string {
  const totalSec = Math.round(hours * 3600);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function dbCoverageBarColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#3b82f6";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ManagerAgentPerformanceDetail: React.FC<ManagerAgentPerformanceDetailProps> = ({
  manager,
  dateRange,
}) => {
  const [agents,     setAgents]     = useState<AgentRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const getCacheKey = useCallback(() => {
    const fromStr = dateRange?.from ? toDateStr(dateRange.from) : "default";
    const toStr   = dateRange?.to   ? toDateStr(dateRange.to)   : "default";
    return `manager-agent-performance-${manager}-${fromStr}-${toStr}-v2`; // v2 = cache bust for YTD→monthly change
  }, [manager, dateRange]);

  useEffect(() => {
    const cacheKey = getCacheKey();
    const cached   = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAgents(parsed.agents);
        setHasFetched(true);
      } catch {
        localStorage.removeItem(cacheKey);
      }
    }
  }, [getCacheKey]);

  const fetchData = useCallback(async () => {
    if (!manager) return;
    const cacheKey = getCacheKey();
    localStorage.removeItem(cacheKey);
    setLoading(true);
    setError(null);
    setHasFetched(true);
    try {
      const params = new URLSearchParams({ manager });
      if (dateRange?.from) params.append("from", toDateStr(dateRange.from));
      if (dateRange?.to)   params.append("to",   toDateStr(dateRange.to));

      const res  = await fetch(`/api/manager-agent-performance?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Unknown error");
      const newAgents = data.agents ?? [];
      setAgents(newAgents);
      localStorage.setItem(cacheKey, JSON.stringify({ agents: newAgents }));
    } catch (err: any) {
      setError(err.message ?? "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [manager, dateRange, getCacheKey]);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = agents.reduce(
    (acc, a) => ({
      plan:                     acc.plan + a.plan,
      siActual:                 acc.siActual + a.siActual,
      soActual:                 acc.soActual + a.soActual,
      obCalls:                  acc.obCalls + a.obCalls,
      obCallsTarget:            acc.obCallsTarget + a.obCallsTarget,
      callsToQuote:             acc.callsToQuote + a.callsToQuote,
      quoteToSOQuotation:       acc.quoteToSOQuotation + a.quoteToSOQuotation,
      quoteToSOSalesOrder:      acc.quoteToSOSalesOrder + a.quoteToSOSalesOrder,
      soToSISalesOrder:         acc.soToSISalesOrder + a.soToSISalesOrder,
      soToSIDelivered:          acc.soToSIDelivered + a.soToSIDelivered,
      quotationAmountTarget:    acc.quotationAmountTarget + a.quotationAmountTarget,
      quotationAmount:          acc.quotationAmount + a.quotationAmount,
      siteVisits:               acc.siteVisits + a.siteVisits,
      siteVisitTarget:          acc.siteVisitTarget + a.siteVisitTarget,
      accountDevelopment:       acc.accountDevelopment + a.accountDevelopment,
      accountDevelopmentTarget: acc.accountDevelopmentTarget + a.accountDevelopmentTarget,
      timeSpentMs:              acc.timeSpentMs + a.timeSpentMs,
    }),
    { plan:0, siActual:0, soActual:0, obCalls:0, obCallsTarget:0, callsToQuote:0, quoteToSOQuotation:0, quoteToSOSalesOrder:0, soToSISalesOrder:0, soToSIDelivered:0, quotationAmountTarget:0, quotationAmount:0, siteVisits:0, siteVisitTarget:0, accountDevelopment:0, accountDevelopmentTarget:0, timeSpentMs:0 }
  );

  const thCls = "text-right py-2 px-1 font-bold text-gray-500 whitespace-nowrap";
  const tdCls = "text-right py-2.5 px-1 font-mono";

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Agent Performance Detail — Team View
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors"
            >
              Generate Data
            </button>
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Spinner className="w-3.5 h-3.5" /><span>Loading…</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 mb-2">{error}</div>
        )}

        {!hasFetched && !error && (
          <p className="text-xs text-gray-400 text-center py-8">
            Click "Generate Data" to load agent performance data.
          </p>
        )}

        {hasFetched && (
          <div className={`overflow-x-auto transition-all duration-300 relative ${loading ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Spinner className="w-5 h-5" /><span>Loading data…</span>
                </div>
              </div>
            )}

            {!loading && !error && agents.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">No active agents found under your team.</p>
            )}

            {agents.length > 0 && (
              <table className="min-w-full text-xs relative">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-1 font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-white z-10 min-w-[140px]">Agent</th>
                    <th className={thCls}>Plan</th>
                    <th className={thCls}>SI Actual</th>
                    <th className={thCls}>SO Actual</th>
                    <th className={thCls}>OB Calls</th>
                    <th className={thCls}>Calls → Quote</th>
                    <th className={thCls}>Quote → SO</th>
                    <th className={thCls}>SO → SI</th>
                    <th className={thCls}>Quotation Target</th>
                    <th className={thCls}>Quotation Amount</th>
                    <th className={thCls}>Site Visits</th>
                    <th className={thCls}>Account Dev</th>
                    <th className={thCls}>DB Coverage</th>
                    <th className={thCls}>Time Spent</th>
                    <th className={thCls}>TSA Response Time</th>
                    <th className={thCls}>Non-Quotation HT</th>
                    <th className={thCls}>Quotation HT</th>
                    <th className={thCls}>SPF Handling Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.referenceid} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors whitespace-nowrap">
                      <td className="py-2.5 px-1">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-800 whitespace-nowrap uppercase">{agent.name}</span>
                        </div>
                      </td>
                      <td className={tdCls}>{fmtPeso(agent.plan)}</td>
                      <td className={`${tdCls} text-green-600`}>{fmtPeso(agent.siActual)}</td>
                      <td className={tdCls}>{fmtPeso(agent.soActual)}</td>
                      <td className={tdCls}>{agent.obCalls}{agent.obCallsTarget > 0 ? `/${agent.obCallsTarget}` : ""}</td>
                      <td className={tdCls}>
                        {agent.callsToQuote > 0 || agent.obCalls > 0
                          ? `${agent.callsToQuote} (${agent.obCalls > 0 ? Math.round((agent.callsToQuote / agent.obCalls) * 100) : 0}%)`
                          : "—"}
                      </td>
                      <td className={tdCls}>
                        {agent.quoteToSOQuotation > 0
                          ? `${agent.quoteToSOSalesOrder}/${agent.quoteToSOQuotation} (${Math.round((agent.quoteToSOSalesOrder / agent.quoteToSOQuotation) * 100)}%)`
                          : "—"}
                      </td>
                      <td className={tdCls}>
                        {agent.soToSISalesOrder > 0
                          ? `${agent.soToSIDelivered}/${agent.soToSISalesOrder} (${Math.round((agent.soToSIDelivered / agent.soToSISalesOrder) * 100)}%)`
                          : "—"}
                      </td>
                      <td className={tdCls}>{fmtPeso(agent.quotationAmountTarget)}</td>
                      <td className={tdCls}>{fmtPeso(agent.quotationAmount)}</td>
                      <td className={tdCls}>{agent.siteVisits}{agent.siteVisitTarget > 0 ? `/${agent.siteVisitTarget}` : ""}</td>
                      <td className={tdCls}>{agent.accountDevelopment}{agent.accountDevelopmentTarget > 0 ? `/${agent.accountDevelopmentTarget}` : ""}</td>
                      <td className={tdCls}>
                        <span style={{ color: dbCoverageBarColor(agent.dbCoverageTotal > 0 ? Math.round((agent.dbCoverageCovered / agent.dbCoverageTotal) * 100) : 0) }} className="font-medium">
                          {agent.dbCoverageCovered}/{agent.dbCoverageTotal}
                        </span>
                      </td>
                      <td className={tdCls}>{fmtTimeMs(agent.timeSpentMs)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgResponseTime)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgNonQuotationHT)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgQuotationHT)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgSpfHT)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold whitespace-nowrap">
                    <td className="py-2.5 px-1 text-xs font-black uppercase tracking-widest text-gray-600">Team Total</td>
                    <td className={tdCls}>{fmtPeso(totals.plan)}</td>
                    <td className={`${tdCls} text-green-700`}>{fmtPeso(totals.siActual)}</td>
                    <td className={tdCls}>{fmtPeso(totals.soActual)}</td>
                    <td className={tdCls}>{totals.obCalls}{totals.obCallsTarget > 0 ? `/${totals.obCallsTarget}` : ""}</td>
                    <td className={tdCls}>
                      {totals.callsToQuote > 0 || totals.obCalls > 0
                        ? `${totals.callsToQuote} (${totals.obCalls > 0 ? Math.round((totals.callsToQuote / totals.obCalls) * 100) : 0}%)`
                        : "—"}
                    </td>
                    <td className={tdCls}>
                      {totals.quoteToSOQuotation > 0
                        ? `${totals.quoteToSOSalesOrder}/${totals.quoteToSOQuotation} (${Math.round((totals.quoteToSOSalesOrder / totals.quoteToSOQuotation) * 100)}%)`
                        : "—"}
                    </td>
                    <td className={tdCls}>
                      {totals.soToSISalesOrder > 0
                        ? `${totals.soToSIDelivered}/${totals.soToSISalesOrder} (${Math.round((totals.soToSIDelivered / totals.soToSISalesOrder) * 100)}%)`
                        : "—"}
                    </td>
                    <td className={tdCls}>{fmtPeso(totals.quotationAmountTarget)}</td>
                    <td className={tdCls}>{fmtPeso(totals.quotationAmount)}</td>
                    <td className={tdCls}>{totals.siteVisits}{totals.siteVisitTarget > 0 ? `/${totals.siteVisitTarget}` : ""}</td>
                    <td className={tdCls}>{totals.accountDevelopment}{totals.accountDevelopmentTarget > 0 ? `/${totals.accountDevelopmentTarget}` : ""}</td>
                    <td className={tdCls}>—</td>
                    <td className={tdCls}>{fmtTimeMs(totals.timeSpentMs)}</td>
                    <td className={tdCls}>—</td>
                    <td className={tdCls}>—</td>
                    <td className={tdCls}>—</td>
                    <td className={tdCls}>—</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
