"use client";

import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentInput {
  referenceid: string;
  name: string;
  siActual: number;
  newSI?: number;        // optional — present only in full state
  newAccountCount?: number;
}

interface NewVsExistingRevenueProps {
  /** Team total SI actual */
  totalSI: number;
  /** Team total SO actual */
  totalSO: number;
  /** New account count actual (from Sales Pipeline — defaults 0) */
  newAccountCount?: number;
  /** New account target (from Sales Pipeline — defaults 1) */
  newAccountTarget?: number;
  /** Per-agent data — siActual always present; newSI/newAccountCount present if tagged */
  agents?: AgentInput[];
  loading?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₱${(n / 1_000).toFixed(1)}K`;
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

const fmtFull = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({
  title, value, subtitle, accent, badge,
}: { title: string; value: React.ReactNode; subtitle: string; accent: string; badge?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1.5 ${accent}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{title}</p>
      <div className="text-2xl font-extrabold tabular-nums text-gray-900 leading-none">{value}</div>
      <p className="text-[10px] text-gray-400 leading-tight">{subtitle}</p>
      {badge}
    </div>
  );
}

// ── Donut center label ────────────────────────────────────────────────────────

function DonutLabel({ cx, cy, totalSI, newShare }: { cx: number; cy: number; totalSI: number; newShare: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-8" fontSize={11} fill="#6b7280">Total SI</tspan>
      <tspan x={cx} dy="18" fontSize={14} fontWeight="bold" fill="#111827">{fmt(totalSI)}</tspan>
      <tspan x={cx} dy="16" fontSize={11} fill={newShare > 0 ? "#10b981" : "#ef4444"}>
        {fmtPct(newShare)} New
      </tspan>
    </text>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const NEW_REVENUE_TARGET_PCT = 0.15; // 15% of team target

export const NewVsExistingRevenue: React.FC<NewVsExistingRevenueProps> = ({
  totalSI,
  totalSO,
  newAccountCount = 0,
  newAccountTarget = 1,
  agents = [],
  loading = false,
}) => {
  // Detect full vs fallback state
  const hasTaggedData = agents.some((a) => (a.newSI ?? 0) > 0 || (a.newAccountCount ?? 0) > 0);

  const {
    totalNewSI, totalExistingSI, newSIShare, existingSIShare,
    newAccAtt, newRevTarget, newRevAtt,
    sortedAgents,
  } = useMemo(() => {
    const totalNewSI      = hasTaggedData ? agents.reduce((s, a) => s + (a.newSI ?? 0), 0) : 0;
    const totalExistingSI = Math.max(0, totalSI - totalNewSI);
    const newSIShare      = totalSI > 0 ? (totalNewSI / totalSI) * 100 : 0;
    const existingSIShare = 100 - newSIShare;
    const newAccAtt       = newAccountTarget > 0 ? (newAccountCount / newAccountTarget) * 100 : 0;
    const newRevTarget    = 13_100_000 * NEW_REVENUE_TARGET_PCT;
    const newRevAtt       = newRevTarget > 0 ? (totalNewSI / newRevTarget) * 100 : 0;

    const sortedAgents = agents
      .slice()
      .sort((a, b) => (b.newSI ?? 0) - (a.newSI ?? 0));

    return { totalNewSI, totalExistingSI, newSIShare, existingSIShare, newAccAtt, newRevTarget, newRevAtt, sortedAgents };
  }, [agents, totalSI, newAccountCount, newAccountTarget, hasTaggedData]);

  const donutData = [
    { name: "Existing", value: Math.max(totalExistingSI, 1), color: "#3b82f6" },
    { name: "New",      value: hasTaggedData ? Math.max(totalNewSI, 0.01) : 0.001, color: newSIShare > 0 ? "#10b981" : "#ef4444" },
  ];

  return (
    <Card className="rounded-xl border border-gray-100 shadow-sm bg-white">
      <CardContent className="p-5 flex flex-col gap-4">

        {/* Header */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Revenue Source Analysis</p>
          <p className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">New vs Existing Account Revenue</p>
          {!hasTaggedData && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-700">
              ⚠️ Fallback Mode — Tag SI/SO entries as NEW or EXISTING to enable full breakdown
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-xs text-gray-400">Loading…</span>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                title="Existing Account SI"
                value={fmt(totalExistingSI)}
                subtitle={`${fmtPct(existingSIShare)} of Total SI`}
                accent="bg-blue-50 border-blue-100"
              />
              <SummaryCard
                title="New Account SI"
                value={fmt(totalNewSI)}
                subtitle={`${fmtPct(newSIShare)} of Total SI · Target ${fmt(newRevTarget)}`}
                accent={hasTaggedData && totalNewSI > 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}
                badge={
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border mt-1 ${
                    newRevAtt >= 100 ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {fmtPct(newRevAtt)} of revenue target
                  </span>
                }
              />
              <SummaryCard
                title="New Account Count"
                value={`${newAccountCount} / ${newAccountTarget}`}
                subtitle={`${fmtPct(newAccAtt)} of target`}
                accent={newAccAtt >= 100 ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"}
                badge={
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border mt-1 ${
                    newAccountCount >= newAccountTarget ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {newAccountCount >= newAccountTarget ? "✅ Target met" : "🔴 Below target"}
                  </span>
                }
              />
              <SummaryCard
                title="Account Dependency"
                value={fmtPct(existingSIShare)}
                subtitle="revenue from existing accounts"
                accent="bg-amber-50 border-amber-100"
                badge={
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border mt-1 ${
                    existingSIShare > 90 ? "bg-red-50 text-red-700 border-red-200"
                    : existingSIShare > 70 ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-green-50 text-green-700 border-green-200"
                  }`}>
                    {existingSIShare > 90 ? "🔴 High dependency" : existingSIShare > 70 ? "⚠️ Moderate" : "✅ Balanced"}
                  </span>
                }
              />
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Donut (left) */}
              <div className="md:col-span-2 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-xl border border-gray-100 p-4">
                {hasTaggedData ? (
                  <>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Revenue Share</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={false}
                        >
                          {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, n: string) => [fmt(v), n]}
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Existing {fmtPct(existingSIShare)}</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> New {fmtPct(newSIShare)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-20 h-20 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                    <p className="text-xs font-bold text-gray-600">No Tags Yet</p>
                    <p className="text-[9px] text-gray-400">Tag SI/SO entries as NEW or EXISTING account to enable donut chart</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[9px] font-bold text-red-700">
                      🔴 0% New Account Achievement
                    </span>
                  </div>
                )}
              </div>

              {/* Per-agent table (right) */}
              <div className="md:col-span-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10">#</th>
                      <th className="text-left py-2 px-2 font-bold text-gray-500 whitespace-nowrap min-w-[130px]">Agent</th>
                      <th className="text-right py-2 px-2 font-bold text-blue-500 whitespace-nowrap">Existing SI</th>
                      <th className="text-right py-2 px-2 font-bold text-green-600 whitespace-nowrap">New SI</th>
                      <th className="text-right py-2 px-2 font-bold text-gray-500 whitespace-nowrap">New %</th>
                      <th className="text-center py-2 px-2 font-bold text-gray-500 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedAgents.map((agent, idx) => {
                      const newSI      = agent.newSI ?? 0;
                      const existSI    = Math.max(0, agent.siActual - newSI);
                      const newShare   = agent.siActual > 0 ? (newSI / agent.siActual) * 100 : 0;
                      const hasNew     = newSI > 0 || (agent.newAccountCount ?? 0) > 0;
                      return (
                        <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-2 px-2 text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="py-2 px-2 font-bold text-gray-800 uppercase text-[11px]">{agent.name}</td>
                          <td className="py-2 px-2 text-right font-mono text-blue-600 tabular-nums">{fmtFull(existSI)}</td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">
                            <span className={newSI > 0 ? "text-green-600 font-bold" : "text-gray-300"}>
                              {newSI > 0 ? fmtFull(newSI) : "—"}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">
                            <span className={newShare > 0 ? "text-green-600 font-bold" : "text-gray-300"}>
                              {newShare > 0 ? fmtPct(newShare) : "0%"}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold border ${
                              hasNew ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                            }`}>
                              {hasNew ? "🟢 New" : "🔴 None"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="py-2 px-2 text-[10px] font-black uppercase tracking-widest text-gray-600" colSpan={2}>Team Total</td>
                      <td className="py-2 px-2 text-right font-mono text-blue-700 tabular-nums">{fmtFull(totalExistingSI)}</td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">
                        <span className={totalNewSI > 0 ? "text-green-700" : "text-gray-300"}>
                          {totalNewSI > 0 ? fmtFull(totalNewSI) : "—"}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        <span className={newSIShare > 0 ? "text-green-700" : "text-gray-400"}>{fmtPct(newSIShare)}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold border ${
                          newSIShare > 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {fmtPct(newSIShare)} New
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
};
