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
  siteVisits: number;
  accountDevelopment: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }

function fmtPeso(n: number): string {
  if (!n) return "—";
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // Totals row
  const totals = agents.reduce(
    (acc, a) => ({
      plan:               acc.plan               + a.plan,
      siActual:           acc.siActual           + a.siActual,
      soActual:           acc.soActual           + a.soActual,
      obCalls:            acc.obCalls            + a.obCalls,
      siteVisits:         acc.siteVisits         + a.siteVisits,
      accountDevelopment: acc.accountDevelopment + a.accountDevelopment,
    }),
    { plan: 0, siActual: 0, soActual: 0, obCalls: 0, siteVisits: 0, accountDevelopment: 0 }
  );
  const totalSiPct = totals.plan > 0 ? Math.round((totals.siActual / totals.plan) * 100) : 0;

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
                  <th className="text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap">Plan</th>
                  <th className="text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap">SI Actual</th>
                  <th className="text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap">SO Actual</th>
                  <th className="text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap">SI %</th>
                  <th className="text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap">OB Calls</th>
                  <th className="text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap">Site Visits</th>
                  <th className="text-right py-2 px-1 font-medium text-gray-500 whitespace-nowrap">Account Dev</th>
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
                    <td className="text-right py-2.5 px-1 font-mono">{fmtPeso(agent.plan)}</td>
                    <td className="text-right py-2.5 px-1 font-mono text-green-600">{fmtPeso(agent.siActual)}</td>
                    <td className="text-right py-2.5 px-1 font-mono">{fmtPeso(agent.soActual)}</td>
                    <td className="text-right py-2.5 px-1 font-mono font-medium">
                      <span className={
                        agent.siPercentage >= 100 ? "text-green-600"
                        : agent.siPercentage >= 70 ? "text-yellow-600"
                        : "text-red-600"
                      }>
                        {agent.siPercentage}%
                      </span>
                    </td>
                    <td className="text-right py-2.5 px-1 font-mono">{agent.obCalls}</td>
                    <td className="text-right py-2.5 px-1 font-mono">{agent.siteVisits}</td>
                    <td className="text-right py-2.5 px-1 font-mono">{agent.accountDevelopment}</td>
                  </tr>
                ))}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td className="py-2.5 px-1 text-xs font-black uppercase tracking-widest text-gray-600">Team Total</td>
                  <td className="text-right py-2.5 px-1 font-mono">{fmtPeso(totals.plan)}</td>
                  <td className="text-right py-2.5 px-1 font-mono text-green-700">{fmtPeso(totals.siActual)}</td>
                  <td className="text-right py-2.5 px-1 font-mono">{fmtPeso(totals.soActual)}</td>
                  <td className="text-right py-2.5 px-1 font-mono font-medium">
                    <span className={
                      totalSiPct >= 100 ? "text-green-600"
                      : totalSiPct >= 70 ? "text-yellow-600"
                      : "text-red-600"
                    }>
                      {totalSiPct}%
                    </span>
                  </td>
                  <td className="text-right py-2.5 px-1 font-mono">{totals.obCalls}</td>
                  <td className="text-right py-2.5 px-1 font-mono">{totals.siteVisits}</td>
                  <td className="text-right py-2.5 px-1 font-mono">{totals.accountDevelopment}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
