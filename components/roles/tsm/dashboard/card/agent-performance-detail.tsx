"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { User } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateRange { from?: Date; to?: Date; }

interface AgentPerformanceDetailProps {
  /** TSM ReferenceID — used as ?tsm= param */
  tsm: string;
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
  quotationAmount: number;
  siteVisits: number;
  accountDevelopment: number;
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

// ── Component ─────────────────────────────────────────────────────────────────

export const AgentPerformanceDetail: React.FC<AgentPerformanceDetailProps> = ({
  tsm,
  dateRange,
}) => {
  const [agents,  setAgents]  = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tsm) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tsm });
      if (dateRange?.from) params.append("from", toDateStr(dateRange.from));
      if (dateRange?.to)   params.append("to",   toDateStr(dateRange.to));

      const res = await fetch(`/api/tsm-agent-performance?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Unknown error");
      setAgents(data.agents ?? []);
    } catch (err: any) {
      console.error("AgentPerformanceDetail fetch error:", err);
      setError(err.message ?? "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [tsm, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Totals row ────────────────────────────────────────────────────────────
  const totals = agents.reduce(
    (acc, a) => ({
      plan:               acc.plan               + a.plan,
      siActual:           acc.siActual           + a.siActual,
      soActual:           acc.soActual           + a.soActual,
      obCalls:            acc.obCalls            + a.obCalls,
      quotationAmount:    acc.quotationAmount    + a.quotationAmount,
      siteVisits:         acc.siteVisits         + a.siteVisits,
      accountDevelopment: acc.accountDevelopment + a.accountDevelopment,
      timeSpentMs:        acc.timeSpentMs        + a.timeSpentMs,
    }),
    { plan: 0, siActual: 0, soActual: 0, obCalls: 0, quotationAmount: 0, siteVisits: 0, accountDevelopment: 0, timeSpentMs: 0 }
  );
  const totalSiPct = totals.plan > 0 ? Math.round((totals.siActual / totals.plan) * 100) : 0;

  const thCls = "text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap";
  const tdCls = "text-right py-2.5 px-1 font-mono";

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Agent Performance Detail — Team View
          </p>
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Spinner className="w-3.5 h-3.5" />
              <span>Loading…</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 mb-2">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && agents.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            No active agents found under your team.
          </p>
        )}

        {/* Table */}
        {agents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-1 font-medium text-gray-500 whitespace-nowrap">Agent</th>
                  <th className={thCls}>Plan</th>
                  <th className={thCls}>SI Actual</th>
                  <th className={thCls}>SO Actual</th>
                  <th className={thCls}>SI %</th>
                  <th className={thCls}>OB Calls</th>
                  <th className={thCls}>Quotation Amount</th>
                  <th className={thCls}>Site Visits</th>
                  <th className={thCls}>Account Dev</th>
                  <th className={thCls}>Time Spent</th>
                  <th className={thCls}>TSA Response Time</th>
                  <th className={thCls}>Non-Quotation HT</th>
                  <th className={thCls}>Quotation HT</th>
                  <th className={thCls}>SPF Handling Duration</th>
                </tr>
              </thead>

              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.referenceid} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-2.5 px-1">
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800 whitespace-nowrap uppercase">{agent.name}</span>
                      </div>
                    </td>
                    <td className={tdCls}>{fmtPeso(agent.plan)}</td>
                    <td className={`${tdCls} text-green-600`}>{fmtPeso(agent.siActual)}</td>
                    <td className={tdCls}>{fmtPeso(agent.soActual)}</td>
                    <td className={`${tdCls} font-medium`}>
                      <span className={
                        agent.siPercentage >= 100 ? "text-green-600"
                        : agent.siPercentage >= 70 ? "text-yellow-600"
                        : "text-red-600"
                      }>
                        {agent.siPercentage}%
                      </span>
                    </td>
                    <td className={tdCls}>{agent.obCalls}</td>
                    <td className={tdCls}>{fmtPeso(agent.quotationAmount)}</td>
                    <td className={tdCls}>{agent.siteVisits}</td>
                    <td className={tdCls}>{agent.accountDevelopment}</td>
                    <td className={tdCls}>{fmtTimeMs(agent.timeSpentMs)}</td>
                    <td className={tdCls}>{fmtHoursHMS(agent.avgResponseTime)}</td>
                    <td className={tdCls}>{fmtHoursHMS(agent.avgNonQuotationHT)}</td>
                    <td className={tdCls}>{fmtHoursHMS(agent.avgQuotationHT)}</td>
                    <td className={tdCls}>{fmtHoursHMS(agent.avgSpfHT)}</td>
                  </tr>
                ))}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="py-2.5 px-1 text-xs font-black uppercase tracking-widest text-gray-600">Team Total</td>
                  <td className={tdCls}>{fmtPeso(totals.plan)}</td>
                  <td className={`${tdCls} text-green-700`}>{fmtPeso(totals.siActual)}</td>
                  <td className={tdCls}>{fmtPeso(totals.soActual)}</td>
                  <td className={`${tdCls} font-medium`}>
                    <span className={
                      totalSiPct >= 100 ? "text-green-600"
                      : totalSiPct >= 70 ? "text-yellow-600"
                      : "text-red-600"
                    }>
                      {totalSiPct}%
                    </span>
                  </td>
                  <td className={tdCls}>{totals.obCalls}</td>
                  <td className={tdCls}>{fmtPeso(totals.quotationAmount)}</td>
                  <td className={tdCls}>{totals.siteVisits}</td>
                  <td className={tdCls}>{totals.accountDevelopment}</td>
                  <td className={tdCls}>{fmtTimeMs(totals.timeSpentMs)}</td>
                  {/* CSR metrics are averages — not meaningful to sum, show em dash */}
                  <td className={tdCls}>—</td>
                  <td className={tdCls}>—</td>
                  <td className={tdCls}>—</td>
                  <td className={tdCls}>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
