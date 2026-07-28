"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeeklyAgentTrendProps {
  tsm: string;
}

interface AgentOption { referenceid: string; name: string; plan: number; siActual: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

function getManilaDateInfo(): { year: number; month: number; daysInMonth: number; daysElapsed: number } {
  const now    = new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const y = manila.getFullYear(), mo = manila.getMonth(), d = manila.getDate();
  return { year: y, month: mo, daysInMonth: new Date(y, mo + 1, 0).getDate(), daysElapsed: d };
}

// July 2026 week definitions (generalise to any month)
function getWeekRanges(year: number, month: number, daysInMonth: number): { label: string; start: number; end: number; days: number }[] {
  const weeks = [];
  let day = 1;
  let wk  = 1;
  while (day <= daysInMonth) {
    const start = day;
    const end   = Math.min(day + 6, daysInMonth);
    weeks.push({ label: `W${wk}`, start, end, days: end - start + 1 });
    day = end + 1;
    wk++;
  }
  return weeks;
}

const fmt = (n: number) => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₱${(n / 1_000).toFixed(1)}K`;
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
};

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const actual  = payload.find((p: any) => p.dataKey === "actual");
  const target  = payload.find((p: any) => p.dataKey === "target");
  const att     = actual && target && target.value > 0
    ? ((actual.value / target.value) * 100).toFixed(1) + "%"
    : "—";
  return (
    <div className="bg-gray-900 text-white text-[10px] rounded-lg px-3 py-2 shadow-xl">
      <p className="font-black mb-1">{label}</p>
      {actual  && <p>Actual: <strong>{fmt(actual.value)}</strong></p>}
      {target  && <p>Target: <strong>{fmt(target.value)}</strong></p>}
      <p>Attainment: <strong className={Number(att) >= 100 ? "text-green-400" : "text-red-400"}>{att}</strong></p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const WeeklyAgentTrend: React.FC<WeeklyAgentTrendProps> = ({ tsm }) => {
  const [agents,     setAgents]     = useState<AgentOption[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selected,   setSelected]   = useState<string>("__team__");

  const getCacheKey = useCallback(() => {
    return `tsm-agent-performance-${tsm}-default-default-v2`;
  }, [tsm]);

  useEffect(() => {
    const cached = localStorage.getItem(getCacheKey());
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      setAgents((parsed.agents ?? []).map((a: any) => ({
        referenceid: a.referenceid, name: a.name,
        plan: a.plan ?? 0, siActual: a.siActual ?? 0,
      })));
      setHasFetched(true);
    } catch {}
  }, [getCacheKey]);

  const fetchData = useCallback(async () => {
    if (!tsm) return;
    setLoading(true); setHasFetched(true);
    try {
      const res  = await fetch(`/api/tsm-agent-performance?tsm=${encodeURIComponent(tsm)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (!data.success) throw new Error();
      const mapped = (data.agents ?? []).map((a: any) => ({
        referenceid: a.referenceid, name: a.name,
        plan: a.plan ?? 0, siActual: a.siActual ?? 0,
      }));
      setAgents(mapped);
      localStorage.setItem(getCacheKey(), JSON.stringify({ agents: data.agents }));
    } catch (err) { console.error("WeeklyAgentTrend fetch error:", err); }
    finally { setLoading(false); }
  }, [tsm, getCacheKey]);

  const { year, month, daysInMonth, daysElapsed } = useMemo(() => getManilaDateInfo(), []);
  const weeks = useMemo(() => getWeekRanges(year, month, daysInMonth), [year, month, daysInMonth]);

  // Selected entity
  const isTeam   = selected === "__team__";
  const entity   = isTeam
    ? { name: "Team Total", plan: agents.reduce((s, a) => s + a.plan, 0), siActual: agents.reduce((s, a) => s + a.siActual, 0) }
    : agents.find((a) => a.referenceid === selected) ?? { name: "—", plan: 0, siActual: 0 };

  // Weekly data using proxy formula
  const chartData = useMemo(() => {
    return weeks.map((w) => {
      const wTarget  = entity.plan > 0 ? (entity.plan / daysInMonth) * w.days : 0;
      // Proxy: distribute actual proportionally by days
      const isPast   = w.end <= daysElapsed;
      const isCurrent = w.start <= daysElapsed && w.end >= daysElapsed;
      const daysIntoWeek = isCurrent ? daysElapsed - w.start + 1 : w.days;
      const wActual  = isPast || isCurrent
        ? daysElapsed > 0 ? (entity.siActual / daysElapsed) * daysIntoWeek : 0
        : null;

      return {
        label:  w.label,
        target: Math.round(wTarget),
        actual: wActual !== null ? Math.round(wActual) : null,
        isCurrent,
        isPast,
      };
    });
  }, [weeks, entity, daysInMonth, daysElapsed]);

  // Best / worst / trend
  const { bestWeek, worstWeek, overallTrend } = useMemo(() => {
    const past = chartData.filter((w) => w.actual !== null);
    if (past.length === 0) return { bestWeek: null, worstWeek: null, overallTrend: "stagnant" };
    const best  = past.reduce((a, b) => (b.actual! > a.actual! ? b : a));
    const worst = past.reduce((a, b) => (b.actual! < a.actual! ? b : a));
    const first = past[0].actual!, last = past[past.length - 1].actual!;
    const trend = last > first * 1.05 ? "improving" : last < first * 0.95 ? "declining" : "stagnant";
    return { bestWeek: best, worstWeek: worst, overallTrend: trend };
  }, [chartData]);

  const currentAtt = entity.plan > 0 ? (entity.siActual / entity.plan) * 100 : 0;

  return (
    <Card className="rounded-xl border border-gray-100 shadow-sm bg-white">
      <CardContent className="p-5 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Weekly Trend</p>
            <p className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">SI Performance by Week</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Agent dropdown */}
            {agents.length > 0 && (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="h-7 text-xs border border-gray-200 rounded px-2 bg-white"
              >
                <option value="__team__">Team Total</option>
                {agents
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((a) => (
                    <option key={a.referenceid} value={a.referenceid}>{a.name}</option>
                  ))}
              </select>
            )}
            <button onClick={fetchData} disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors disabled:opacity-50">
              {loading ? "Loading…" : hasFetched ? "Refresh" : "Load Data"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner className="w-6 h-6" /></div>
        ) : !hasFetched ? (
          <p className="text-xs text-gray-400 text-center py-8">Click "Load Data" to show weekly trend.</p>
        ) : (
          <>
            {/* Chart */}
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} width={54} />
                <Tooltip content={<CustomTooltip />} />
                {/* Target line (gray) */}
                <Line type="monotone" dataKey="target" stroke="#d1d5db" strokeWidth={2}
                  strokeDasharray="5 3" dot={false} name="Target" />
                {/* Actual line (green) — only for weeks with data */}
                <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2.5}
                  connectNulls={false}
                  dot={(props: any) => {
                    const { cx, cy, value } = props;
                    if (value === null) return <></>;
                    return <Dot cx={cx} cy={cy} r={4} fill="#10b981" stroke="#fff" strokeWidth={1.5} />;
                  }}
                  name="SI Actual" />
              </LineChart>
            </ResponsiveContainer>

            {/* Summary panel */}
            <div className="grid grid-cols-3 gap-3 text-xs pt-2 border-t border-gray-100">
              <div>
                <p className="font-black text-gray-900 truncate">{entity.name}</p>
                <p className="text-gray-400">Plan: {fmt(entity.plan)}</p>
                <p className="text-green-600 font-bold tabular-nums">Actual: {fmt(entity.siActual)}</p>
                <p className={`font-bold tabular-nums ${currentAtt >= 100 ? "text-green-600" : currentAtt >= 80 ? "text-amber-600" : "text-red-500"}`}>
                  {fmtPct(currentAtt)} attained
                </p>
              </div>
              <div>
                {bestWeek  && <p className="text-gray-400">Best: <span className="font-bold text-green-600">{bestWeek.label} ({fmt(bestWeek.actual!)})</span></p>}
                {worstWeek && <p className="text-gray-400">Worst: <span className="font-bold text-red-500">{worstWeek.label} ({fmt(worstWeek.actual!)})</span></p>}
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-[9px] uppercase font-bold tracking-wider mb-1">Overall Trend</p>
                <p className={`text-sm font-extrabold ${
                  overallTrend === "improving" ? "text-green-600"
                  : overallTrend === "declining" ? "text-red-500"
                  : "text-gray-500"}`}>
                  {overallTrend === "improving" ? "🟢 Improving"
                   : overallTrend === "declining" ? "🔴 Declining"
                   : "⚪ Stagnant"}
                </p>
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
};
