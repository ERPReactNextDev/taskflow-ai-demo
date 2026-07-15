"use client";

import { useState, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Info, X } from "lucide-react";
import { useEffect } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPeso(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtHours(h: number): string {
  if (h <= 0) return "—";
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateRange { from?: Date; to?: Date; }

interface ManagerKpiWeightedScoresProps {
  manager: string;
  dateRange?: DateRange;
}

interface AgentKpiData {
  referenceid: string;
  name: string;
  runningTarget: number;
  totalActualSales: number;
  obCallsCount: number;
  obCallsTarget: number;
  quotesCount: number;
  quotesTarget: number;
  callsToQuotesCount: number;
  quoteToSOQuotationCount: number;
  quoteToSOSalesOrderCount: number;
  soToSISalesOrderCount: number;
  soToSIDeliveredCount: number;
  newAccountCount: number;
  newAccountTarget: number;
  clientVisitsCount: number;
  clientVisitsTarget: number;
  avgResponseTime: number;
  avgQuotationHT: number;
  avgNonQuotationHT: number;
  avgSpfHT: number;
}

interface KpiRow {
  label: string;
  weight: number;
  achievementPct: number;
  rating: number;
  weightedScore: number;
  detail?: string;
}

// ── Rating helpers ────────────────────────────────────────────────────────────

function standardRating(pct: number): number {
  if (pct >= 91) return 5; if (pct >= 81) return 4;
  if (pct >= 61) return 3; if (pct >= 50) return 2; return 1;
}
function callsToQuoteRating(pct: number): number {
  if (pct >= 20) return 5; if (pct >= 14.01) return 4;
  if (pct >= 12.01) return 3; if (pct >= 10.01) return 2; return 1;
}
function quoteToSORating(pct: number): number {
  if (pct >= 30) return 5; if (pct >= 25.01) return 4;
  if (pct >= 20.01) return 3; if (pct >= 15.01) return 2; return 1;
}
function soToSIRating(pct: number): number {
  if (pct >= 70) return 5; if (pct >= 60.01) return 4;
  if (pct >= 50.01) return 3; if (pct >= 40.01) return 2; return 1;
}
function responseTimeRating(hours: number): number {
  if (hours <= 0) return 1;
  const mins = hours * 60;
  if (mins <= 10) return 5; if (mins <= 20) return 4;
  if (mins <= 30) return 3; if (mins <= 40) return 2; return 1;
}
function quotationHTRating(hours: number): number {
  if (hours <= 0) return 1;
  if (hours <= 8) return 5; if (hours <= 9) return 4;
  if (hours <= 10) return 3; if (hours <= 11) return 2; return 1;
}
function nonQuotationHTRating(hours: number): number {
  if (hours <= 0) return 1;
  if (hours <= 24) return 5; if (hours <= 30) return 4;
  if (hours <= 35) return 3; if (hours <= 40) return 2; return 1;
}

function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 5)   return { label: "Always Demonstrated",      color: "text-yellow-700", bg: "bg-yellow-50"  };
  if (score >= 4.5) return { label: "Often Demonstrated",       color: "text-green-700",  bg: "bg-green-50"   };
  if (score >= 3.5) return { label: "Regularly Demonstrated",   color: "text-emerald-700",bg: "bg-emerald-50" };
  if (score >= 2.5) return { label: "Occasionally Demonstrated",color: "text-blue-700",   bg: "bg-blue-50"    };
  if (score >= 1.5) return { label: "Seldom Demonstrated",      color: "text-amber-700",  bg: "bg-amber-50"   };
  return                    { label: "Seldom Demonstrated",      color: "text-red-700",    bg: "bg-red-50"     };
}

function barColor(score: number): string {
  if (score >= 4.5) return "#16a34a"; if (score >= 3.5) return "#10b981";
  if (score >= 2.5) return "#3b82f6"; if (score >= 1.5) return "#f59e0b";
  return "#ef4444";
}

function ratingColor(r: number): string {
  return r >= 4 ? "text-green-600" : r >= 3 ? "text-blue-500" : r >= 2 ? "text-amber-500" : "text-red-500";
}

// ── KPI computation ───────────────────────────────────────────────────────────

function computeKpi(d: AgentKpiData): { rows: KpiRow[]; totalScore: number } {
  const salesPct  = Math.min(100, d.runningTarget > 0   ? (d.totalActualSales / d.runningTarget) * 100 : 0);
  const salesR    = standardRating(salesPct);
  const obPct     = Math.min(100, d.obCallsTarget > 0   ? (d.obCallsCount / d.obCallsTarget) * 100 : 0);
  const obR       = standardRating(obPct);
  const qPct      = Math.min(100, d.quotesTarget > 0    ? (d.quotesCount / d.quotesTarget) * 100 : 0);
  const qR        = standardRating(qPct);
  const c2qRaw    = d.obCallsCount > 0                  ? (d.callsToQuotesCount / d.obCallsCount) * 100 : 0;
  const q2soPct   = d.quoteToSOQuotationCount > 0       ? (d.quoteToSOSalesOrderCount / d.quoteToSOQuotationCount) * 100 : 0;
  const s2siPct   = d.soToSISalesOrderCount > 0         ? (d.soToSIDeliveredCount / d.soToSISalesOrderCount) * 100 : 0;
  const convR     = Math.round((callsToQuoteRating(c2qRaw) + quoteToSORating(q2soPct) + soToSIRating(s2siPct)) / 3);
  const convAchieve = (Math.min(100,(c2qRaw/20)*100) + Math.min(100,(q2soPct/30)*100) + Math.min(100,(s2siPct/70)*100)) / 3;
  const cvPct     = Math.min(100, d.clientVisitsTarget > 0 ? (d.clientVisitsCount / d.clientVisitsTarget) * 100 : 0);
  const cvR       = standardRating(cvPct);
  const naPct     = Math.min(100, d.newAccountTarget > 0 ? (d.newAccountCount / d.newAccountTarget) * 100 : 0);
  const naR       = standardRating(naPct);
  const rtRating  = responseTimeRating(d.avgResponseTime);
  const rtAchieve = d.avgResponseTime > 0 ? Math.min(((10 / 60) / d.avgResponseTime) * 100, 100) : 0;
  const qhtRating = quotationHTRating(d.avgQuotationHT);
  const qhtAchieve= d.avgQuotationHT > 0 ? Math.min((8 / d.avgQuotationHT) * 100, 100) : 0;
  const nqhtRating= nonQuotationHTRating(d.avgNonQuotationHT);
  const nqhtAchieve = d.avgNonQuotationHT > 0 ? Math.min((24 / d.avgNonQuotationHT) * 100, 100) : 0;
  const csrRating = Math.round((rtRating + qhtRating + nqhtRating) / 3);
  const csrAchieve = (rtAchieve + qhtAchieve + nqhtAchieve) / 3;

  const rows: KpiRow[] = [
    { label:"Sales Performance (SO/SI)", weight:0.5,  achievementPct:salesPct,    rating:salesR, weightedScore:0.5*salesR,
      detail:`Actual: ${fmtPeso(d.totalActualSales)} / Target: ${fmtPeso(d.runningTarget)}` },
    { label:"OB Calls",                  weight:0.1,  achievementPct:obPct,        rating:obR,    weightedScore:0.1*obR,
      detail:`${d.obCallsCount} calls / Target: ${d.obCallsTarget > 0 ? d.obCallsTarget : "—"}` },
    { label:"Quotes Generated",          weight:0.1,  achievementPct:qPct,         rating:qR,     weightedScore:0.1*qR,
      detail:`${d.quotesCount} quotes / Target: ${d.quotesTarget > 0 ? d.quotesTarget : "—"}` },
    { label:"Conversion Metrics",        weight:0.05, achievementPct:convAchieve,  rating:convR,  weightedScore:0.05*convR,
      detail:`Calls→Quote: ${fmt(c2qRaw,0)}% (tgt 20%) · Quote→SO: ${fmt(q2soPct,0)}% (tgt 30%) · SO→SI: ${fmt(s2siPct,0)}% (tgt 70%)` },
    { label:"Client Visits",             weight:0.1,  achievementPct:cvPct,        rating:cvR,    weightedScore:0.1*cvR,
      detail:`${d.clientVisitsCount} visits / Target: ${d.clientVisitsTarget > 0 ? `${d.clientVisitsTarget}/mo` : "—"}` },
    { label:"CSR Metrics",               weight:0.05, achievementPct:csrAchieve,   rating:csrRating, weightedScore:0.05*csrRating,
      detail:`Resp. Time: ${fmtHours(d.avgResponseTime)} · Quotation HT: ${fmtHours(d.avgQuotationHT)} · Non-Quotation HT: ${fmtHours(d.avgNonQuotationHT)}` },
    { label:"New Account Development",   weight:0.1,  achievementPct:naPct,        rating:naR,    weightedScore:0.1*naR,
      detail:`${d.newAccountCount} accounts / Target: ${d.newAccountTarget > 0 ? `${d.newAccountTarget}/mo` : "—"}` },
  ];

  const totalScore = rows.reduce((s, r) => s + r.weightedScore, 0);
  return { rows, totalScore };
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

const DetailModal: React.FC<{ agent: AgentKpiData; onClose: () => void }> = ({ agent, onClose }) => {
  const { rows, totalScore } = computeKpi(agent);
  const { label: statusLabel } = scoreLabel(totalScore);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-900 text-white shrink-0">
          <div>
            <p className="font-black text-base tracking-tight">{agent.name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-widest">KPI Weighted Score Detail</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-3xl font-extrabold leading-none" style={{ color: barColor(totalScore) }}>
                {totalScore.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold mt-0.5" style={{ color: barColor(totalScore) }}>{statusLabel}</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pt-3 pb-1 shrink-0">
          <div className="w-full bg-gray-100 h-2 rounded-full">
            <div className="h-2 rounded-full transition-all duration-700"
              style={{ width: `${Math.min((totalScore / 5) * 100, 100)}%`, backgroundColor: barColor(totalScore) }} />
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>0.00</span><span>2.50</span><span>5.00</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {rows.map((row) => {
            const max     = row.weight * 5;
            const fillPct = max > 0 ? (row.weightedScore / max) * 100 : 0;
            return (
              <div key={row.label} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-800">{row.label}</span>
                      <span className="text-[9px] font-bold text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
                        {Math.round(row.weight * 100)}%
                      </span>
                    </div>
                    {row.detail && <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{row.detail}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 bg-gray-200 h-1.5 rounded-full">
                        <div className="h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(fillPct, 100)}%`, backgroundColor: barColor(row.rating) }} />
                      </div>
                      <span className="text-[9px] font-mono text-gray-400 shrink-0 w-8 text-right">
                        {row.achievementPct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <div className="text-right">
                      <span className={`text-lg font-extrabold leading-none ${ratingColor(row.rating)}`}>{row.rating}</span>
                      <p className="text-[8px] text-gray-400 leading-none">/ 5 rating</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-gray-800">{row.weightedScore.toFixed(2)}</span>
                      <p className="text-[8px] text-gray-400 leading-none">of {max.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 shrink-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Raw Metrics</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Sales Actual",   value: fmtPeso(agent.totalActualSales) },
              { label: "Sales Target",   value: fmtPeso(agent.runningTarget) },
              { label: "OB Calls",       value: `${agent.obCallsCount} / ${agent.obCallsTarget > 0 ? agent.obCallsTarget : "—"}` },
              { label: "Quotes",         value: `${agent.quotesCount} / ${agent.quotesTarget > 0 ? agent.quotesTarget : "—"}` },
              { label: "Calls→Quote",    value: `${agent.callsToQuotesCount}` },
              { label: "Quote→SO",       value: `${agent.quoteToSOSalesOrderCount} / ${agent.quoteToSOQuotationCount}` },
              { label: "SO→SI",          value: `${agent.soToSIDeliveredCount} / ${agent.soToSISalesOrderCount}` },
              { label: "New Accounts",   value: `${agent.newAccountCount} / ${agent.newAccountTarget}` },
              { label: "Client Visits",  value: `${agent.clientVisitsCount} / ${agent.clientVisitsTarget}` },
              { label: "Resp. Time",     value: fmtHours(agent.avgResponseTime) },
              { label: "Quotation HT",   value: fmtHours(agent.avgQuotationHT) },
              { label: "Non-Quot. HT",   value: fmtHours(agent.avgNonQuotationHT) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-lg px-3 py-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-xs font-black text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Compact summary card ──────────────────────────────────────────────────────

const AgentSummaryCard: React.FC<{ agent: AgentKpiData }> = ({ agent }) => {
  const [showDetail, setShowDetail] = useState(false);
  const { totalScore } = computeKpi(agent);
  const { label: statusLabel, color: statusColor } = scoreLabel(totalScore);
  const color   = barColor(totalScore);
  const fillPct = (totalScore / 5) * 100;

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 flex flex-col gap-2 hover:shadow-md hover:border-gray-200 transition-all">
        <p className="text-[11px] uppercase font-bold text-gray-900 truncate leading-tight" title={agent.name}>
          {agent.name}
        </p>
        <div className="flex items-end justify-between gap-1">
          <span className="text-2xl font-extrabold leading-none" style={{ color }}>
            {totalScore.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-500 transition-colors text-[9px] font-black uppercase tracking-wider"
          >
            <Info className="w-3 h-3" />
            Info
          </button>
        </div>
        <div className="w-full bg-gray-100 h-1 rounded-full">
          <div className="h-1 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(fillPct, 100)}%`, backgroundColor: color }} />
        </div>
        <p className={`text-[9px] font-bold truncate ${statusColor}`}>{statusLabel}</p>
      </div>
      {showDetail && <DetailModal agent={agent} onClose={() => setShowDetail(false)} />}
    </>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const ManagerKpiWeightedScores: React.FC<ManagerKpiWeightedScoresProps> = ({ manager, dateRange }) => {
  const [loading,    setLoading]    = useState(false);
  const [agents,     setAgents]     = useState<AgentKpiData[]>([]);
  const [error,      setError]      = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const getCacheKey = useCallback(() => {
    const fromStr = dateRange?.from ? toDateStr(dateRange.from) : "default";
    const toStr   = dateRange?.to   ? toDateStr(dateRange.to)   : "default";
    return `manager-kpi-${manager}-${fromStr}-${toStr}`;
  }, [manager, dateRange]);

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

      const res = await fetch(`/api/manager-kpi?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Unknown error");
      const newAgents = data.agents ?? [];
      setAgents(newAgents);
      localStorage.setItem(cacheKey, JSON.stringify({ agents: newAgents }));
    } catch (err: any) {
      console.error("ManagerKpiWeightedScores fetch error:", err);
      setError(err.message ?? "Failed to load KPI data.");
    } finally {
      setLoading(false);
    }
  }, [manager, dateRange, getCacheKey]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
          KPI Weighted Scores — Team View (out of 5.0)
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
              <Spinner className="w-3.5 h-3.5" />
              <span>Loading…</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>
      )}

      {!hasFetched && !error && (
        <p className="text-xs text-gray-400 text-center py-8">
          Click "Generate Data" to load KPI data.
        </p>
      )}

      {hasFetched && (
        <div className={`transition-all duration-300 relative ${loading ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Spinner className="w-5 h-5" />
                <span>Loading data…</span>
              </div>
            </div>
          )}
          {!loading && !error && agents.length === 0 && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-8 text-center text-xs text-gray-400">
              No active agents found under your team.
            </div>
          )}
          {agents.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {agents.map((agent) => (
                <AgentSummaryCard key={agent.referenceid} agent={agent} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
