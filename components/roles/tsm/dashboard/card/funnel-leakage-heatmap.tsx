"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentInput {
  referenceid: string;
  name: string;
  obCalls: number;
  callsToQuote: number;
  quoteToSOSalesOrder: number;
  soToSIDelivered: number;
}

interface FunnelLeakageHeatmapProps {
  tsm: string;
  dateRange?: { from?: Date; to?: Date };
}

type HeatLevel = "green" | "amber" | "red" | "na";
type SortKey   = "score" | "c2q" | "q2so" | "so2si" | "name";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtPct     = (n: number, dec = 1) => `${n.toFixed(dec)}%`;
const fmtScore   = (n: number)          => n.toFixed(1);
const toDateStr  = (d: Date)            => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

function divide(num: number, den: number): number | null {
  return den > 0 ? (num / den) * 100 : null;
}

function heatLevel(rate: number | null, avg: number): HeatLevel {
  if (rate === null)      return "na";
  if (rate >= avg)        return "green";
  if (rate >= avg * 0.8)  return "amber";
  return "red";
}

function computeScore(
  c2q: number | null, q2so: number | null, so2si: number | null,
  aC2Q: number, aQ2SO: number, aSO2SI: number
): number {
  const sub = (r: number | null, a: number) =>
    r === null || a <= 0 ? 0 : Math.min((r / a) * 50, 50);
  return sub(c2q, aC2Q) + sub(q2so, aQ2SO) + sub(so2si, aSO2SI);
}

function scoreBadgeCls(score: number): string {
  if (score >= 100) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 85)  return "bg-gray-100 text-gray-600 border-gray-200";
  if (score >= 70)  return "bg-amber-50 text-amber-700 border-amber-200";
  return                   "bg-red-50 text-red-700 border-red-200";
}

function scoreLabel(score: number): string {
  if (score >= 100) return "Excellent";
  if (score >= 85)  return "Average";
  if (score >= 70)  return "Below Avg";
  return                   "Critical";
}

function coachingFocus(c2q: HeatLevel, q2so: HeatLevel, so2si: HeatLevel): string {
  const reds = [c2q, q2so, so2si].filter((l) => l === "red").length;
  if (reds >= 2)        return "Full funnel coaching, priority sa pinakamababang stage";
  if (c2q   === "red")  return "Coaching: Objection handling sa calls / paano mag-invite ng quote";
  if (q2so  === "red")  return "Coaching: Follow-up ng quotes / pricing negotiation / presentation";
  if (so2si === "red")  return "Coaching: Documentation / collection process / client onboarding";
  if ([c2q, q2so, so2si].some((l) => l === "amber"))
    return "Monitor & slight coaching on weaker stage";
  return "Maintain performance — pwede mag-mentor ng ibang agent";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeatCell({ rate, level }: { rate: number | null; level: HeatLevel }) {
  const bg = level === "green" ? "bg-emerald-500 text-white"
           : level === "amber" ? "bg-amber-400 text-white"
           : level === "red"   ? "bg-red-500 text-white"
           :                     "bg-gray-50 text-gray-400";
  return (
    <td className={`text-center py-2 px-2 text-xs font-bold tabular-nums ${bg}`}>
      {rate === null ? "N/A" : fmtPct(rate)}
    </td>
  );
}

function BenchmarkCard({ label, pct, sublabel }: { label: string; pct: number; sublabel: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{fmtPct(pct)}</p>
      <p className="text-[9px] text-gray-400">{sublabel}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const FunnelLeakageHeatmap: React.FC<FunnelLeakageHeatmapProps> = ({ tsm, dateRange }) => {
  const [agents,     setAgents]     = useState<AgentInput[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [sortKey,    setSortKey]    = useState<SortKey>("score");
  const [sortAsc,    setSortAsc]    = useState(true);

  const getCacheKey = useCallback(() => {
    const f = dateRange?.from ? toDateStr(dateRange.from) : "default";
    const t = dateRange?.to   ? toDateStr(dateRange.to)   : "default";
    return `tsm-agent-performance-${tsm}-${f}-${t}-v2`;
  }, [tsm, dateRange]);

  // Load from cache (shared with AgentPerformanceDetail)
  useEffect(() => {
    const cached = localStorage.getItem(getCacheKey());
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      const raw: any[] = parsed.agents ?? [];
      setAgents(raw.map((a) => ({
        referenceid:         a.referenceid,
        name:                a.name,
        obCalls:             a.obCalls             ?? 0,
        callsToQuote:        a.callsToQuote         ?? 0,
        quoteToSOSalesOrder: a.quoteToSOSalesOrder  ?? 0,
        soToSIDelivered:     a.soToSIDelivered      ?? 0,
      })));
      setHasFetched(true);
    } catch { localStorage.removeItem(getCacheKey()); }
  }, [getCacheKey]);

  const fetchData = useCallback(async () => {
    if (!tsm) return;
    setLoading(true);
    setHasFetched(true);
    try {
      const params = new URLSearchParams({ tsm });
      if (dateRange?.from) params.append("from", toDateStr(dateRange.from));
      if (dateRange?.to)   params.append("to",   toDateStr(dateRange.to));
      const res  = await fetch(`/api/tsm-agent-performance?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const raw: any[] = data.agents ?? [];
      const mapped = raw.map((a) => ({
        referenceid:         a.referenceid,
        name:                a.name,
        obCalls:             a.obCalls             ?? 0,
        callsToQuote:        a.callsToQuote         ?? 0,
        quoteToSOSalesOrder: a.quoteToSOSalesOrder  ?? 0,
        soToSIDelivered:     a.soToSIDelivered      ?? 0,
      }));
      setAgents(mapped);
      localStorage.setItem(getCacheKey(), JSON.stringify({ agents: data.agents }));
    } catch (err) {
      console.error("FunnelLeakageHeatmap fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tsm, dateRange, getCacheKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(key === "name"); }
  };

  const { teamC2Q, teamQ2SO, teamSO2SI, rows } = useMemo(() => {
    const totOB    = agents.reduce((s, a) => s + a.obCalls,             0);
    const totC2Q   = agents.reduce((s, a) => s + a.callsToQuote,        0);
    const totQ2SO  = agents.reduce((s, a) => s + a.quoteToSOSalesOrder, 0);
    const totSO2SI = agents.reduce((s, a) => s + a.soToSIDelivered,     0);

    const teamC2Q   = totOB   > 0 ? (totC2Q   / totOB)   * 100 : 0;
    const teamQ2SO  = totC2Q  > 0 ? (totQ2SO  / totC2Q)  * 100 : 0;
    const teamSO2SI = totQ2SO > 0 ? (totSO2SI / totQ2SO) * 100 : 0;

    const rows = agents.map((a) => {
      const c2q    = divide(a.callsToQuote,        a.obCalls);
      const q2so   = divide(a.quoteToSOSalesOrder, a.callsToQuote);
      const so2si  = divide(a.soToSIDelivered,     a.quoteToSOSalesOrder);
      const c2qL   = heatLevel(c2q,   teamC2Q);
      const q2soL  = heatLevel(q2so,  teamQ2SO);
      const so2siL = heatLevel(so2si, teamSO2SI);
      const score  = computeScore(c2q, q2so, so2si, teamC2Q, teamQ2SO, teamSO2SI);
      return { ...a, c2q, q2so, so2si, c2qL, q2soL, so2siL, score,
        coaching: coachingFocus(c2qL, q2soL, so2siL) };
    });

    return { teamC2Q, teamQ2SO, teamSO2SI, rows };
  }, [agents]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let d = 0;
      if      (sortKey === "score") d = a.score  - b.score;
      else if (sortKey === "c2q")   d = (a.c2q   ?? -1) - (b.c2q   ?? -1);
      else if (sortKey === "q2so")  d = (a.q2so  ?? -1) - (b.q2so  ?? -1);
      else if (sortKey === "so2si") d = (a.so2si ?? -1) - (b.so2si ?? -1);
      else d = a.name.localeCompare(b.name);
      return sortAsc ? d : -d;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  const SortTh = ({ col, label }: { col: SortKey; label: string }) => (
    <th className="text-center py-2 px-2 font-bold text-gray-500 whitespace-nowrap cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(col)}>
      {label}{sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <Card className="rounded-xl border border-gray-100 shadow-sm bg-white">
      <CardContent className="p-5 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Sales Funnel Diagnostics</p>
            <p className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">Per-Agent Leakage Heatmap</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? "Loading…" : hasFetched ? "Refresh" : "Generate Data"}
          </button>
        </div>

        {/* Team Baseline */}
        {hasFetched && agents.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <BenchmarkCard label="Calls → Quote" pct={teamC2Q}   sublabel="Benchmark: 1 quote bawat 4 calls" />
            <BenchmarkCard label="Quote → SO"    pct={teamQ2SO}  sublabel="Benchmark: 1 SO bawat 4 quotes" />
            <BenchmarkCard label="SO → SI"       pct={teamSO2SI} sublabel="Benchmark: 7 out of 10 SO nagiging pera" />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10"><Spinner className="w-6 h-6" /></div>
        ) : !hasFetched ? (
          <p className="text-xs text-gray-400 text-center py-8">Click "Generate Data" to load the heatmap.</p>
        ) : agents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">No agent data found.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-center py-2 px-2 font-bold text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px] cursor-pointer hover:text-gray-700 select-none"
                      onClick={() => handleSort("name")}>
                      Agent{sortKey === "name" ? (sortAsc ? " ↑" : " ↓") : ""}
                    </th>
                    <SortTh col="score"  label="Score" />
                    <SortTh col="c2q"    label="Calls→Quote" />
                    <SortTh col="q2so"   label="Quote→SO" />
                    <SortTh col="so2si"  label="SO→SI" />
                    <th className="text-left py-2 px-3 font-bold text-gray-500 whitespace-nowrap min-w-[240px]">Coaching Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((a, idx) => (
                    <tr key={a.referenceid} className="hover:bg-gray-50/50 transition-colors">
                      <td className="text-center py-2.5 px-2 text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                        <p className="font-bold text-gray-800 uppercase text-[11px]">{a.name}</p>
                        <p className="text-[9px] text-gray-400 font-mono">{a.referenceid}</p>
                      </td>
                      <td className="text-center py-2.5 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tabular-nums ${scoreBadgeCls(a.score)}`}>
                          {fmtScore(a.score)} · {scoreLabel(a.score)}
                        </span>
                      </td>
                      <HeatCell rate={a.c2q}   level={a.c2qL}   />
                      <HeatCell rate={a.q2so}  level={a.q2soL}  />
                      <HeatCell rate={a.so2si} level={a.so2siL} />
                      <td className="py-2.5 px-3 text-[10px] text-gray-600 leading-relaxed">{a.coaching}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Above Avg (≥ team)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> At Risk (80–99%)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Critical (&lt;80%)</span>
              <span className="flex items-center gap-1.5 text-gray-400"><span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 inline-block" /> N/A</span>
              <span className="ml-auto text-gray-400">Sorted worst first · Click headers to re-sort</span>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
};
