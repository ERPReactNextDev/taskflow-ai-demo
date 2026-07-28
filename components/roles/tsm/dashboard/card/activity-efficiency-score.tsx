"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentInput {
  referenceid: string;
  name: string;
  obCalls: number;
  callsToQuote: number;
  quoteToSOSalesOrder: number;
  soToSIDelivered: number;
}

interface ActivityEfficiencyScoreProps {
  tsm: string;
  dateRange?: { from?: Date; to?: Date };
  /** Team average rates — auto-computed from agents if not provided */
  teamC2Q?: number;
  teamQ2SO?: number;
  teamSO2SI?: number;
}

type ScoreTier = "elite" | "above" | "average" | "below" | "critical";
type QualityFlag = "high_quality" | "low_efficiency" | "balanced";

// ── Helpers ───────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const fmtPct    = (n: number) => `${n.toFixed(1)}%`;
const fmtScore  = (n: number) => n.toFixed(1);

function computeScore(
  c2qRate: number | null, q2soRate: number | null, so2siRate: number | null,
  teamC2Q: number, teamQ2SO: number, teamSO2SI: number
): number | null {
  if (c2qRate === null && q2soRate === null && so2siRate === null) return null;
  const c2qEff  = teamC2Q   > 0 ? ((c2qRate   ?? 0) / teamC2Q)   * 100 : 0;
  const q2soEff = teamQ2SO  > 0 ? ((q2soRate  ?? 0) / teamQ2SO)  * 100 : 0;
  const so2siEff = teamSO2SI > 0 ? ((so2siRate ?? 0) / teamSO2SI) * 100 : 0;
  return c2qEff * 0.30 + q2soEff * 0.35 + so2siEff * 0.35;
}

function scoreTier(score: number | null): ScoreTier {
  if (score === null) return "critical";
  if (score >= 120) return "elite";
  if (score >= 100) return "above";
  if (score >= 80)  return "average";
  if (score >= 60)  return "below";
  return "critical";
}

function qualityFlag(
  obCallsRank: number, efficiencyRank: number, total: number
): QualityFlag {
  const callsHigh = obCallsRank > total * 0.6;   // high call count
  const callsLow  = obCallsRank <= total * 0.4;  // low call count
  const effHigh   = efficiencyRank <= total * 0.4;
  const effLow    = efficiencyRank > total * 0.6;

  if (callsLow  && effHigh)  return "high_quality";
  if (callsHigh && effLow)   return "low_efficiency";
  return "balanced";
}

const TIER_CFG: Record<ScoreTier, { label: string; icon: string; textCls: string; bgCls: string; borderCls: string }> = {
  elite:    { label: "Elite",        icon: "⭐", textCls: "text-yellow-700", bgCls: "bg-yellow-50",  borderCls: "border-yellow-200" },
  above:    { label: "Above Avg",    icon: "✅", textCls: "text-green-700",  bgCls: "bg-green-50",   borderCls: "border-green-200"  },
  average:  { label: "Average",      icon: "⚠️", textCls: "text-amber-700", bgCls: "bg-amber-50",   borderCls: "border-amber-200"  },
  below:    { label: "Below Avg",    icon: "🔴", textCls: "text-red-700",   bgCls: "bg-red-50",     borderCls: "border-red-200"    },
  critical: { label: "Critical",     icon: "🚨", textCls: "text-red-700",   bgCls: "bg-red-50",     borderCls: "border-red-200"    },
};

const FLAG_CFG: Record<QualityFlag, { label: string }> = {
  high_quality:    { label: "💎 High Quality"   },
  low_efficiency:  { label: "📉 Low Efficiency" },
  balanced:        { label: "⚖️ Balanced"       },
};

function scoreBarColor(tier: ScoreTier): string {
  if (tier === "elite" || tier === "above") return "bg-green-500";
  if (tier === "average") return "bg-amber-400";
  return "bg-red-500";
}

// ── Agent Card ────────────────────────────────────────────────────────────────

interface AgentEffCard {
  referenceid: string;
  name: string;
  score: number | null;
  tier: ScoreTier;
  flag: QualityFlag;
  c2qEff: number | null;
  q2soEff: number | null;
  so2siEff: number | null;
}

function AgentCard({ agent, onHide }: { agent: AgentEffCard; onHide: () => void }) {
  const cfg      = TIER_CFG[agent.tier];
  const barWidth = agent.score !== null ? Math.min((agent.score / 120) * 100, 100) : 0;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 flex flex-col gap-2 hover:shadow-md hover:border-gray-200 transition-all group relative">
      <button onClick={onHide} title="Hide"
        className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-600">
        <X className="w-3 h-3" />
      </button>

      <p className="text-[11px] font-black text-gray-900 uppercase leading-tight truncate pr-4" title={agent.name}>
        {agent.name}
      </p>

      <div>
        <span className={`text-2xl font-extrabold leading-none tabular-nums ${cfg.textCls}`}>
          {agent.score !== null ? fmtScore(agent.score) : "N/A"}
        </span>
        <p className="text-[9px] text-gray-400 mt-0.5">/ 100 (team avg = 100)</p>
      </div>

      <div className="w-full bg-gray-100 h-1.5 rounded-full">
        <div className={`h-1.5 rounded-full transition-all duration-500 ${scoreBarColor(agent.tier)}`}
          style={{ width: `${barWidth}%` }} />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bgCls} ${cfg.borderCls} ${cfg.textCls}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <p className="text-[9px] text-gray-500">{FLAG_CFG[agent.flag].label}</p>

      <div className="grid grid-cols-3 gap-1 text-[9px] text-gray-400 pt-1 border-t border-gray-50">
        <div><span className="block text-[8px] font-bold uppercase">C→Q</span>{agent.c2qEff !== null ? fmtPct(agent.c2qEff) : "N/A"}</div>
        <div><span className="block text-[8px] font-bold uppercase">Q→SO</span>{agent.q2soEff !== null ? fmtPct(agent.q2soEff) : "N/A"}</div>
        <div><span className="block text-[8px] font-bold uppercase">SO→SI</span>{agent.so2siEff !== null ? fmtPct(agent.so2siEff) : "N/A"}</div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const HIDDEN_KEY = "tsm-efficiency-hidden-agents";

export const ActivityEfficiencyScore: React.FC<ActivityEfficiencyScoreProps> = ({
  tsm, dateRange, teamC2Q: propC2Q, teamQ2SO: propQ2SO, teamSO2SI: propSO2SI,
}) => {
  const [rawAgents,  setRawAgents]  = useState<AgentInput[]>([]);
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

  useEffect(() => {
    const cached = localStorage.getItem(getCacheKey());
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      const raw: any[] = parsed.agents ?? [];
      setRawAgents(raw.map((a) => ({
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
    setLoading(true); setHasFetched(true);
    try {
      const params = new URLSearchParams({ tsm });
      if (dateRange?.from) params.append("from", toDateStr(dateRange.from));
      if (dateRange?.to)   params.append("to",   toDateStr(dateRange.to));
      const res  = await fetch(`/api/tsm-agent-performance?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const raw: any[] = data.agents ?? [];
      setRawAgents(raw.map((a) => ({
        referenceid:         a.referenceid,
        name:                a.name,
        obCalls:             a.obCalls             ?? 0,
        callsToQuote:        a.callsToQuote         ?? 0,
        quoteToSOSalesOrder: a.quoteToSOSalesOrder  ?? 0,
        soToSIDelivered:     a.soToSIDelivered      ?? 0,
      })));
      localStorage.setItem(getCacheKey(), JSON.stringify({ agents: data.agents }));
    } catch (err) { console.error("ActivityEfficiencyScore fetch error:", err); }
    finally { setLoading(false); }
  }, [tsm, dateRange, getCacheKey]);

  const hideAgent = (id: string) => {
    setHidden((p) => { const n = new Set(p); n.add(id); localStorage.setItem(HIDDEN_KEY, JSON.stringify([...n])); return n; });
  };
  const showAll = () => { setHidden(new Set()); localStorage.removeItem(HIDDEN_KEY); };

  const { teamC2Q, teamQ2SO, teamSO2SI, cards } = useMemo(() => {
    const totOB    = rawAgents.reduce((s, a) => s + a.obCalls,             0);
    const totC2Q   = rawAgents.reduce((s, a) => s + a.callsToQuote,        0);
    const totQ2SO  = rawAgents.reduce((s, a) => s + a.quoteToSOSalesOrder, 0);
    const totSO2SI = rawAgents.reduce((s, a) => s + a.soToSIDelivered,     0);

    const teamC2Q   = propC2Q   ?? (totOB   > 0 ? (totC2Q   / totOB)   * 100 : 0);
    const teamQ2SO  = propQ2SO  ?? (totC2Q  > 0 ? (totQ2SO  / totC2Q)  * 100 : 0);
    const teamSO2SI = propSO2SI ?? (totQ2SO > 0 ? (totSO2SI / totQ2SO) * 100 : 0);

    const computed = rawAgents.map((a) => {
      const c2qR   = a.obCalls             > 0 ? (a.callsToQuote        / a.obCalls)             * 100 : null;
      const q2soR  = a.callsToQuote        > 0 ? (a.quoteToSOSalesOrder / a.callsToQuote)        * 100 : null;
      const so2siR = a.quoteToSOSalesOrder > 0 ? (a.soToSIDelivered     / a.quoteToSOSalesOrder) * 100 : null;

      const score = computeScore(c2qR, q2soR, so2siR, teamC2Q, teamQ2SO, teamSO2SI);
      const c2qEff  = teamC2Q   > 0 && c2qR   !== null ? (c2qR   / teamC2Q)   * 100 : null;
      const q2soEff = teamQ2SO  > 0 && q2soR  !== null ? (q2soR  / teamQ2SO)  * 100 : null;
      const so2siEff = teamSO2SI > 0 && so2siR !== null ? (so2siR / teamSO2SI) * 100 : null;

      return { referenceid: a.referenceid, name: a.name, obCalls: a.obCalls, score, c2qEff, q2soEff, so2siEff };
    });

    // Sort by score desc for ranking
    computed.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const total = computed.length;

    // Assign ranks
    const withRanks = computed.map((a, i) => {
      const obCallsRank = rawAgents.slice().sort((x, y) => x.obCalls - y.obCalls).findIndex((x) => x.referenceid === a.referenceid) + 1;
      const effRank     = i + 1;
      const flag        = qualityFlag(obCallsRank, effRank, total);
      const tier        = scoreTier(a.score);
      return { ...a, tier, flag } as AgentEffCard;
    });

    return { teamC2Q, teamQ2SO, teamSO2SI, cards: withRanks };
  }, [rawAgents, propC2Q, propQ2SO, propSO2SI]);

  const visible = cards.filter((c) => !hidden.has(c.referenceid));

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">Performance Quality Index</p>
          <p className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">Activity Efficiency Score (0–100+)</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Team Avg Rates — C→Q: {teamC2Q.toFixed(1)}% · Q→SO: {teamQ2SO.toFixed(1)}% · SO→SI: {teamSO2SI.toFixed(1)}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hidden.size > 0 && (
            <button onClick={showAll} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
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

      {!hasFetched ? (
        <p className="text-xs text-gray-400 text-center py-8">Click "Generate Data" to load efficiency scores.</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-10"><Spinner className="w-6 h-6" /></div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">
          No agents. {hidden.size > 0 && <button onClick={showAll} className="underline">Show hidden</button>}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {visible.map((agent) => (
            <AgentCard key={agent.referenceid} agent={agent} onHide={() => hideAgent(agent.referenceid)} />
          ))}
        </div>
      )}
    </div>
  );
};
