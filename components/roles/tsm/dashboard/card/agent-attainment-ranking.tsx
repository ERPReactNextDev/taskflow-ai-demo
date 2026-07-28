"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentAttainmentRankingProps {
  tsm: string;
  dateRange?: { from?: Date; to?: Date };
}

interface AgentRaw {
  referenceid: string;
  name: string;
  plan: number;
  siActual: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

function getManilaDateInfo(): { daysInMonth: number; daysElapsed: number; monthLabel: string } {
  const now    = new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const y = manila.getFullYear(), mo = manila.getMonth(), d = manila.getDate();
  return {
    daysInMonth: new Date(y, mo + 1, 0).getDate(),
    daysElapsed: d,
    monthLabel: manila.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" }),
  };
}

const fmt = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtCompact = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₱${abs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function attColor(pct: number): string {
  if (pct >= 100) return "text-green-600";
  if (pct >= 80)  return "text-amber-600";
  return "text-red-500";
}

function barColor(pct: number): string {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 80)  return "bg-amber-400";
  return "bg-red-500";
}

function statusText(pct: number): string {
  if (pct >= 100) return "On track to exceed quota";
  if (pct >= 80)  return "At risk";
  return "Off track";
}

type StatusLevel = "exceeding" | "on_track" | "at_risk" | "off_track";

function statusLevel(pct: number): StatusLevel {
  if (pct >= 100) return "exceeding";
  if (pct >= 80)  return "at_risk";
  return "off_track";
}

// ── Rank Badge ────────────────────────────────────────────────────────────────

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 1) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-400 text-white text-[10px] font-black shadow-sm">🥇</span>
  );
  if (rank === 2) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300 text-gray-800 text-[10px] font-black shadow-sm">🥈</span>
  );
  if (rank === 3) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white text-[10px] font-black shadow-sm">🥉</span>
  );
  if (rank >= total - 2) return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[9px] font-black">
      🚩 #{rank}
    </span>
  );
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">
      {rank}
    </span>
  );
}

// ── Agent Card ────────────────────────────────────────────────────────────────

interface AgentCardData {
  referenceid: string;
  name: string;
  plan: number;
  siActual: number;
  currentPct: number;
  remainingGap: number;
  runRate: number;
  projectedSI: number;
  projectedPct: number;
  catchUpDaily: number;
  rank: number;
  total: number;
}

function AgentCard({ agent, onHide }: { agent: AgentCardData; onHide: () => void }) {
  const level      = statusLevel(agent.projectedPct);
  const barWidth   = Math.min(agent.currentPct, 100);
  const exceeded   = agent.currentPct > 100;
  const exceptional = agent.projectedPct > 150;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 flex flex-col gap-2 hover:shadow-md hover:border-gray-200 transition-all group relative">
      {/* Hide button */}
      <button onClick={onHide} title="Hide agent"
        className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-600">
        <X className="w-3 h-3" />
      </button>

      {/* Rank + Name */}
      <div className="flex items-center gap-2 pr-4">
        <RankBadge rank={agent.rank} total={agent.total} />
        <p className="text-[11px] font-black text-gray-900 uppercase leading-tight truncate" title={agent.name}>
          {agent.name}
        </p>
      </div>

      {/* Main attainment % */}
      <div>
        <span className={`text-2xl font-extrabold leading-none tabular-nums ${attColor(agent.currentPct)}`}>
          {fmtPct(agent.currentPct)}
        </span>
        <p className="text-[9px] text-gray-400 mt-0.5">of {fmtCompact(agent.plan)} plan</p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-100 h-1.5 rounded-full relative overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor(agent.currentPct)}`}
          style={{ width: `${barWidth}%` }} />
        {exceeded && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[8px] font-bold text-green-700 pr-0.5">
            EXCEEDED
          </span>
        )}
      </div>

      {/* Projected + Gap */}
      <div className="grid grid-cols-2 gap-1 text-[10px]">
        <div>
          <span className="text-gray-400">Projected: </span>
          <span className={`font-bold tabular-nums ${attColor(agent.projectedPct)}`}>
            {fmtPct(agent.projectedPct)}{exceptional ? " ⭐" : ""}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Gap: </span>
          <span className={`font-bold tabular-nums ${agent.remainingGap <= 0 ? "text-green-600" : "text-red-500"}`}>
            {agent.remainingGap <= 0 ? `+${fmtCompact(Math.abs(agent.remainingGap))}` : fmtCompact(agent.remainingGap)}
          </span>
        </div>
      </div>

      {/* Status footer */}
      {level === "exceeding" || agent.currentPct >= 100 ? (
        <div className="text-[9px] font-bold text-green-700 bg-green-50 rounded-lg px-2 py-1">
          ✅ On track to exceed quota
        </div>
      ) : level === "at_risk" ? (
        <div className="text-[9px] font-bold text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
          ⚠️ Need {fmtCompact(agent.catchUpDaily)}/day catch-up
        </div>
      ) : (
        <div className="text-[9px] font-bold text-red-700 bg-red-50 rounded-lg px-2 py-1">
          🔴 Need {fmtCompact(agent.catchUpDaily)}/day (Critical)
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const HIDDEN_KEY = "tsm-attainment-hidden-agents";

export const AgentAttainmentRanking: React.FC<AgentAttainmentRankingProps> = ({ tsm, dateRange }) => {
  const [agents,     setAgents]     = useState<AgentRaw[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [hidden,     setHidden]     = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]")); } catch { return new Set(); }
  });

  const getCacheKey = useCallback(() => {
    const f = dateRange?.from ? toDateStr(dateRange.from) : "default";
    const t = dateRange?.to   ? toDateStr(dateRange.to)   : "default";
    return `tsm-agent-performance-${tsm}-${f}-${t}-v2`;
  }, [tsm, dateRange]);

  // Load from shared cache
  useEffect(() => {
    const cached = localStorage.getItem(getCacheKey());
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      const raw: any[] = parsed.agents ?? [];
      setAgents(raw.map((a) => ({ referenceid: a.referenceid, name: a.name, plan: a.plan ?? 0, siActual: a.siActual ?? 0 })));
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
      setAgents(raw.map((a) => ({ referenceid: a.referenceid, name: a.name, plan: a.plan ?? 0, siActual: a.siActual ?? 0 })));
      localStorage.setItem(getCacheKey(), JSON.stringify({ agents: data.agents }));
    } catch (err) { console.error("AgentAttainmentRanking fetch error:", err); }
    finally { setLoading(false); }
  }, [tsm, dateRange, getCacheKey]);

  const hideAgent = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev); next.add(id);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); return next;
    });
  };

  const showAll = () => { setHidden(new Set()); localStorage.removeItem(HIDDEN_KEY); };

  const { daysInMonth, daysElapsed, monthLabel } = useMemo(() => getManilaDateInfo(), []);
  const remainingDays = daysInMonth - daysElapsed;

  const ranked: AgentCardData[] = useMemo(() => {
    const computed = agents.map((a) => {
      const currentPct   = a.plan > 0 ? (a.siActual / a.plan) * 100 : 0;
      const remainingGap = a.plan - a.siActual;
      const runRate      = daysElapsed > 0 ? a.siActual / daysElapsed : 0;
      const projectedSI  = a.siActual + runRate * remainingDays;
      const projectedPct = a.plan > 0 ? (projectedSI / a.plan) * 100 : 0;
      const catchUpDaily = remainingGap > 0 && remainingDays > 0 ? remainingGap / remainingDays : 0;
      return { ...a, currentPct, remainingGap, runRate, projectedSI, projectedPct, catchUpDaily };
    });

    // Sort by currentPct desc
    computed.sort((a, b) => b.currentPct - a.currentPct);
    const total = computed.length;
    return computed.map((a, i) => ({ ...a, rank: i + 1, total }));
  }, [agents, daysElapsed, remainingDays]);

  const visible = ranked.filter((a) => !hidden.has(a.referenceid));

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            {monthLabel} Quota Performance
          </p>
          <p className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">
            Agent Attainment Ranking Board
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Day {daysElapsed}/{daysInMonth} · {remainingDays} days remaining
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hidden.size > 0 && (
            <button onClick={showAll}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
              Show all ({hidden.size} hidden)
            </button>
          )}
          <button onClick={fetchData} disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors disabled:opacity-50">
            {loading ? "Loading…" : hasFetched ? "Refresh" : "Generate Data"}
          </button>
          {loading && <Spinner className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </div>

      {/* Content */}
      {!hasFetched && !loading ? (
        <p className="text-xs text-gray-400 text-center py-8">
          Click "Generate Data" to load the attainment ranking board.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="w-6 h-6" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">
          No agents to display. {hidden.size > 0 && <button onClick={showAll} className="underline">Show hidden agents</button>}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {visible.map((agent) => (
            <AgentCard key={agent.referenceid} agent={agent} onHide={() => hideAgent(agent.referenceid)} />
          ))}
        </div>
      )}
    </div>
  );
};
