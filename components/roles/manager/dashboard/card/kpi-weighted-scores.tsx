"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Info, X, Settings, ChevronLeft, BarChart2 } from "lucide-react";
import { TsmDrilldown } from "@/components/roles/manager/dashboard/drilldown/tsm-drilldown";

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

type KpiViewMode = "team" | "tsm" | "agent";

interface DateRange { from?: Date; to?: Date; }

interface ManagerKpiWeightedScoresProps {
  manager: string;
  dateRange?: DateRange;
  tsm?: string;
  referenceid?: string;
  mode?: KpiViewMode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  hideGenerate?: boolean;
  autoFetch?: boolean;
  onDataLoaded?: (agents: AgentKpiData[]) => void;
  onAgentClick?: (agent: AgentKpiData) => void;
}

export interface AgentKpiData {
  referenceid: string;
  name: string;
  tsm: string;
  tsm_code: string;
  tsm_full_name: string;
  manager: string;
  runningTarget: number;
  totalActualSales: number;
  obCallsCount: number;
  obCallsTarget: number;
  quotesCount: number;
  quotesTarget: number;
  quotationAmountActual: number;
  quotationAmountTarget: number;
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

export function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 5)   return { label: "Always Demonstrated",      color: "text-yellow-700", bg: "bg-yellow-50"  };
  if (score >= 4.5) return { label: "Often Demonstrated",       color: "text-green-700",  bg: "bg-green-50"   };
  if (score >= 3.5) return { label: "Regularly Demonstrated",   color: "text-emerald-700",bg: "bg-emerald-50" };
  if (score >= 2.5) return { label: "Occasionally Demonstrated",color: "text-blue-700",   bg: "bg-blue-50"    };
  if (score >= 1.5) return { label: "Seldom Demonstrated",      color: "text-amber-700",  bg: "bg-amber-50"   };
  return                    { label: "Seldom Demonstrated",      color: "text-red-700",    bg: "bg-red-50"     };
}

export function barColor(score: number): string {
  if (score >= 4.5) return "#16a34a"; if (score >= 3.5) return "#10b981";
  if (score >= 2.5) return "#3b82f6"; if (score >= 1.5) return "#f59e0b";
  return "#ef4444";
}

function ratingColor(r: number): string {
  return r >= 4 ? "text-green-600" : r >= 3 ? "text-blue-500" : r >= 2 ? "text-amber-500" : "text-red-500";
}

// ── KPI computation ───────────────────────────────────────────────────────────

export function computeKpi(d: AgentKpiData): { rows: KpiRow[]; totalScore: number } {
  const salesPct  = Math.min(100, d.runningTarget > 0   ? (d.totalActualSales / d.runningTarget) * 100 : 0);
  const salesR    = standardRating(salesPct);
  const obPct     = Math.min(100, d.obCallsTarget > 0   ? (d.obCallsCount / d.obCallsTarget) * 100 : 0);
  const obR       = standardRating(obPct);
  const qPct      = Math.min(100, d.quotesTarget > 0    ? (d.quotesCount / d.quotesTarget) * 100 : 0);
  const qR        = standardRating(qPct);

  const quotationAmtPct = Math.min(100, d.quotationAmountTarget > 0 ? (d.quotationAmountActual / d.quotationAmountTarget) * 100 : 0);
  const quotationAmtR   = standardRating(quotationAmtPct);

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
    { label:"Sales Performance", weight:0.5,  achievementPct:salesPct,    rating:salesR, weightedScore:0.5*salesR,
      detail:`Actual: ${fmtPeso(d.totalActualSales)} / Target: ${fmtPeso(d.runningTarget)}` },
    { label:"OB Calls (Successful)",                  weight:0.1,  achievementPct:obPct,        rating:obR,    weightedScore:0.1*obR,
      detail:`${d.obCallsCount} calls / Target: ${d.obCallsTarget > 0 ? d.obCallsTarget : "—"}` },
    { label:"Quotes Generated (No. of Quotation)", weight:0.05,  achievementPct:qPct,         rating:qR,          weightedScore:0.05*qR,
      detail:`${d.quotesCount} quotes / Target: ${d.quotesTarget > 0 ? d.quotesTarget : "—"}` },
    { label:"Amount of Quotation",                 weight:0.05,  achievementPct:quotationAmtPct, rating:quotationAmtR, weightedScore:0.05*quotationAmtR,
      detail:`₱${d.quotationAmountActual.toLocaleString(undefined,{maximumFractionDigits:2})} / Target: ₱${d.quotationAmountTarget > 0 ? d.quotationAmountTarget.toLocaleString() : "—"}` },
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
            <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-widest">
              KPI Weighted Score Detail{agent.tsm ? ` · TSM: ${agent.tsm}` : ""}
            </p>
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
              { label: "OB Calls (Successful)",       value: `${agent.obCallsCount} / ${agent.obCallsTarget > 0 ? agent.obCallsTarget : "—"}` },
              { label: "Quotes",         value: `${agent.quotesCount} / ${agent.quotesTarget > 0 ? agent.quotesTarget : "—"}` },
              { label: "Quote Amount",   value: `${fmtPeso(agent.quotationAmountActual)} / ${agent.quotationAmountTarget > 0 ? fmtPeso(agent.quotationAmountTarget) : "—"}` },
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

const AgentSummaryCard: React.FC<{ agent: AgentKpiData; onHide: () => void; onAgentClick?: (a: AgentKpiData) => void }> = ({ agent, onHide, onAgentClick }) => {
  const [showDetail, setShowDetail] = useState(false);
  const { totalScore } = computeKpi(agent);
  const { label: statusLabel, color: statusColor } = scoreLabel(totalScore);
  const color   = barColor(totalScore);
  const fillPct = (totalScore / 5) * 100;

  return (
    <>
      <div
        className={`bg-white border border-gray-100 rounded-xl shadow-sm p-3 flex flex-col gap-2 hover:shadow-md hover:border-gray-200 transition-all group relative ${onAgentClick ? "cursor-pointer" : ""}`}
        onClick={onAgentClick ? () => onAgentClick(agent) : undefined}
      >
        {/* Hide button — top-right, visible on hover */}
        <button
          onClick={onHide}
          title="Hide this agent"
          className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-600"
        >
          <X className="w-3 h-3" />
        </button>
        <p className="text-[11px] uppercase font-bold text-gray-900 truncate leading-tight pr-4" title={agent.name}>
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

const HIDDEN_AGENTS_KEY = "manager-kpi-hidden-agents";

function loadHiddenAgents(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_AGENTS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch { return new Set(); }
}

function saveHiddenAgents(set: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_AGENTS_KEY, JSON.stringify([...set]));
    // Notify other components on the same page
    window.dispatchEvent(new Event("storage"));
  } catch {}
}

export const ManagerKpiWeightedScores: React.FC<ManagerKpiWeightedScoresProps> = ({
  manager, dateRange,
  tsm, referenceid, mode = "team", title,
  showBack, onBack, hideGenerate, autoFetch, onDataLoaded, onAgentClick,
}) => {
  const [loading,      setLoading]      = useState(false);
  const [agents,       setAgents]       = useState<AgentKpiData[]>([]);
  const [error,        setError]        = useState<string | null>(null);
  const [hasFetched,   setHasFetched]   = useState(false);
  const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Track which agents are still being fetched
  const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set());
  const fetchIdRef = useRef(0);
  const [showDrilldown, setShowDrilldown] = useState(false);

  // Load hidden agents from localStorage on mount
  useEffect(() => { setHiddenAgents(loadHiddenAgents()); }, []);

  const hideAgent = (referenceid: string) => {
    setHiddenAgents((prev) => {
      const next = new Set(prev);
      next.add(referenceid);
      saveHiddenAgents(next);
      return next;
    });
  };

  const toggleAgent = (referenceid: string) => {
    setHiddenAgents((prev) => {
      const next = new Set(prev);
      if (next.has(referenceid)) next.delete(referenceid);
      else next.add(referenceid);
      saveHiddenAgents(next);
      return next;
    });
  };

  const fetchData = useCallback(async () => {
    if (!manager) return;
    const fetchId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);
    setHasFetched(true);
    setAgents([]);
    setLoadingAgents(new Set());

    const baseParams = new URLSearchParams({ manager });
    if (dateRange?.from) baseParams.append("from", toDateStr(dateRange.from));
    if (dateRange?.to)   baseParams.append("to",   toDateStr(dateRange.to));
    if (tsm)         baseParams.append("tsm",         tsm);
    if (referenceid) baseParams.append("referenceid", referenceid);

    try {
      // Step 1: get the agent list only (fast — no KPI computation)
      const listParams = new URLSearchParams(baseParams);
      listParams.set("listOnly", "true");
      const listRes = await fetch(`/api/manager-kpi?${listParams}`);
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      const listData = await listRes.json();
      if (!listData.success) throw new Error(listData.error ?? "Unknown error");
      if (fetchId !== fetchIdRef.current) return;

      const agentStubs: { referenceid: string; name: string }[] = listData.agents ?? [];
      if (agentStubs.length === 0) {
        setLoading(false);
        return;
      }

      // Seed the loadingAgents set so the UI shows placeholders
      setLoadingAgents(new Set(agentStubs.map((a) => a.referenceid)));
      setLoading(false);

      // Step 2: fetch each agent's KPI one by one, append as they complete
      for (const stub of agentStubs) {
        if (fetchId !== fetchIdRef.current) return;

        const agentParams = new URLSearchParams(baseParams);
        agentParams.set("referenceid", stub.referenceid);
        try {
          const res = await fetch(`/api/manager-kpi?${agentParams}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.success || !data.agents?.length) continue;
          if (fetchId !== fetchIdRef.current) return;

          const agentData: AgentKpiData = data.agents[0];
          setAgents((prev) => {
            // Replace if already present (shouldn't be), otherwise append
            const exists = prev.findIndex((a) => a.referenceid === agentData.referenceid);
            if (exists >= 0) {
              const next = [...prev];
              next[exists] = agentData;
              return next;
            }
            return [...prev, agentData];
          });
        } catch { /* silent — agent stays as loading */ }

        setLoadingAgents((prev) => {
          const next = new Set(prev);
          next.delete(stub.referenceid);
          return next;
        });
      }
    } catch (err: any) {
      if (fetchId !== fetchIdRef.current) return;
      console.error("ManagerKpiWeightedScores fetch error:", err);
      setError(err.message ?? "Failed to load KPI data.");
      setLoading(false);
      setLoadingAgents(new Set());
    }
    // fire callback once all agents are done
    if (fetchId === fetchIdRef.current) {
      setAgents((current) => { onDataLoaded?.(current); return current; });
    }
  }, [manager, tsm, referenceid, dateRange, onDataLoaded]);

  // auto-fetch when mounted in drilldown mode
  useEffect(() => {
    if (autoFetch && manager) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, tsm, referenceid, dateRange, autoFetch]);

  const headerTitle = title
    ?? (mode === "tsm"   ? `KPI Weighted Scores — TSM: ${tsm ?? ""}`
      : mode === "agent" ? "KPI Weighted Scores — Agent View"
      :                    "KPI Weighted Scores — Team View (out of 5.0)");

  const avgScore = agents.length > 0
    ? agents.reduce((s, a) => s + computeKpi(a).totalScore, 0) / agents.length
    : 0;

  // Team mode: delegate entirely to TsmDrilldown
  if (mode === "team") {
    return <TsmDrilldown manager={manager} dateRange={dateRange} />;
  }

  return (
    <>
    <div className="flex flex-col gap-3 rounded-lg border px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && onBack && (
            <button onClick={onBack} className="p-1 rounded-md hover:bg-gray-100 transition-colors text-gray-500 shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-600 truncate">{headerTitle}</p>
            {mode !== "agent" && agents.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {agents.length} agent{agents.length !== 1 ? "s" : ""} ·{" "}
                <span className="font-bold" style={{ color: barColor(avgScore) }}>
                  Avg Score: {avgScore.toFixed(2)}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Settings — tsm mode only */}
          {mode === "tsm" && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              title="Show/hide agents"
              aria-label="Agent visibility settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          {!hideGenerate && (
            <button onClick={fetchData} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors">
              Generate Data
            </button>
          )}
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Spinner className="w-3.5 h-3.5" /><span>Loading…</span>
            </div>
          )}
          {!loading && loadingAgents.size > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Spinner className="w-3.5 h-3.5" />
              <span>{loadingAgents.size} agent{loadingAgents.size !== 1 ? "s" : ""} remaining…</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings panel — tsm mode only */}
      {mode === "tsm" && settingsOpen && agents.length > 0 && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSettingsOpen(false)} />
          <div className="relative w-72 h-full bg-white shadow-2xl flex flex-col z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-700">Agent Visibility</span>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Toggle to show / hide each agent</p>
              {agents.map((agent) => {
                const hidden = hiddenAgents.has(agent.referenceid);
                return (
                  <div key={agent.referenceid} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className={`text-xs flex-1 pr-2 truncate ${hidden ? "text-gray-400 line-through" : "text-gray-700"}`}>{agent.name}</span>
                    <button onClick={() => toggleAgent(agent.referenceid)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${hidden ? "bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-600" : "bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500"}`}>
                      {hidden ? "Show" : "Hide"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 border-t">
              <button onClick={() => { setHiddenAgents(new Set()); saveHiddenAgents(new Set()); }}
                className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                Show all agents
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

      {!hasFetched && !error && !autoFetch && (
        <p className="text-xs text-gray-400 text-center py-8">Click "Generate Data" to load KPI data.</p>
      )}

      {hasFetched && (
        <div className="transition-all duration-300 relative">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Spinner className="w-5 h-5" /><span>Loading data…</span>
              </div>
            </div>
          )}
          {!loading && !error && agents.length === 0 && loadingAgents.size === 0 && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-8 text-center text-xs text-gray-400">
              No active agents found.
            </div>
          )}
          {(agents.length > 0 || loadingAgents.size > 0) && (
            <div className={mode === "agent"
              ? "flex flex-col gap-3 max-w-sm"
              : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3"}>
              {agents.map((agent) => (
                <AgentSummaryCard
                  key={agent.referenceid}
                  agent={agent}
                  onHide={() => hideAgent(agent.referenceid)}
                  onAgentClick={onAgentClick}
                />
              ))}
              {[...loadingAgents].map((ref) => (
                <div key={ref} className="rounded-xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-2 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-6 bg-gray-200 rounded w-1/2 mt-1" />
                  <div className="space-y-1.5 mt-2">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-2 bg-gray-200 rounded w-full" />)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {mode === "tsm" && hiddenAgents.size > 0 && agents.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-2 text-right">
              {hiddenAgents.size} agent{hiddenAgents.size !== 1 ? "s" : ""} hidden —{" "}
              <button onClick={() => { setHiddenAgents(new Set()); saveHiddenAgents(new Set()); }} className="underline hover:text-gray-600">show all</button>
            </p>
          )}
        </div>
      )}
    </div>
    </>
  );
};