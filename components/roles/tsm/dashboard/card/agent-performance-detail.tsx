"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  obCallsTarget: number;
  callsToQuote: number;
  quoteToSOQuotation: number;
  quoteToSOSalesOrder: number;
  soToSISalesOrder: number;
  soToSIDelivered: number;
  quotationAmountTarget: number;
  quotationAmount: number;
  quotesCount: number;
  quotesTarget: number;
  siteVisits: number;
  siteVisitTarget: number;
  accountDevelopment: number;
  accountDevelopmentTarget: number;
  dbCoverageCovered: number;
  dbCoverageTotal: number;
  timeSpentMs: number;
  timeSpentBreakdown: Record<string, number>;
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

// ── Forecast helpers ──────────────────────────────────────────────────────────

function getManilaDateInfo(ref?: Date): { daysInMonth: number; daysElapsed: number } {
  const now    = ref ?? new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const y = manila.getFullYear(), mo = manila.getMonth(), d = manila.getDate();
  return { daysInMonth: new Date(y, mo + 1, 0).getDate(), daysElapsed: d };
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n), sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₱${abs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtPct(n: number, dec = 1): string { return `${n.toFixed(dec)}%`; }

type ForecastStatus = "hit" | "risk" | "miss";

function forecastStatus(projPct: number): ForecastStatus {
  if (projPct >= 100) return "hit";
  if (projPct >= 80)  return "risk";
  return "miss";
}

function hitProb(projPct: number): number {
  if (projPct >= 100) return 95;
  if (projPct >= 90)  return 70;
  if (projPct >= 80)  return 40;
  if (projPct >= 70)  return 20;
  return 5;
}

const STATUS_CFG: Record<ForecastStatus, { label: string; cls: string; bg: string }> = {
  hit:  { label: "✅ WILL HIT",  cls: "text-green-700", bg: "bg-green-50 border-green-200 text-green-700" },
  risk: { label: "⚠️ AT RISK",  cls: "text-amber-700", bg: "bg-amber-50 border-amber-200 text-amber-700" },
  miss: { label: "❌ WILL MISS", cls: "text-red-700",   bg: "bg-red-50 border-red-200 text-red-700"     },
};

function ProbBar({ prob, status }: { prob: number; status: ForecastStatus }) {
  const barCls = status === "hit" ? "bg-green-500" : status === "risk" ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`text-[10px] font-bold tabular-nums ${STATUS_CFG[status].cls}`}>{prob}%</span>
      <div className="w-16 bg-gray-100 h-1 rounded-full">
        <div className={`h-1 rounded-full ${barCls}`} style={{ width: `${prob}%` }} />
      </div>
    </div>
  );
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

// ── Time Spent Breakdown Cell ─────────────────────────────────────────────────

interface TimeSpentDialogProps {
  agentName: string;
  totalMs: number;
  breakdown: Record<string, number>;
  onClose: () => void;
}

function TimeSpentDialog({ agentName, totalMs, breakdown, onClose }: TimeSpentDialogProps) {
  const entries = Object.entries(breakdown)
    .filter(([, ms]) => ms > 0)
    .sort(([, a], [, b]) => b - a);

  // Close on backdrop click or Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return typeof window !== "undefined"
    ? require("react-dom").createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-900 text-white">
              <div>
                <p className="font-black text-sm tracking-tight">{agentName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">
                  Time Spent Breakdown
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors ml-4"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {entries.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No time data available.</p>
              ) : entries.map(([activity, ms]) => {
                const pct = totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0;
                return (
                  <div key={activity}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                        {activity}
                      </span>
                      <span className="text-xs font-mono text-gray-900 shrink-0">
                        {fmtTimeMs(ms)}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0 w-8 text-right">
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer total */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                Total
              </span>
              <span className="text-sm font-extrabold text-gray-900 font-mono">
                {fmtTimeMs(totalMs)}
              </span>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}

function TimeSpentCell({
  agentName,
  totalMs,
  breakdown,
}: {
  agentName: string;
  totalMs: number;
  breakdown: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  if (totalMs <= 0) return <span className="text-gray-300">—</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-blue-600 hover:text-blue-800 underline decoration-dotted cursor-pointer transition-colors"
        title="Click to view breakdown"
      >
        {fmtTimeMs(totalMs)}
      </button>

      {open && (
        <TimeSpentDialog
          agentName={agentName}
          totalMs={totalMs}
          breakdown={breakdown}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AgentPerformanceDetail: React.FC<AgentPerformanceDetailProps> = ({
  tsm,
  dateRange,
}) => {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [showForecast, setShowForecast] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tsm) return;
    setLoading(true);
    setError(null);
    setHasFetched(true);
    try {
      const params = new URLSearchParams({ tsm });
      if (dateRange?.from) params.append("from", toDateStr(dateRange.from));
      if (dateRange?.to) params.append("to", toDateStr(dateRange.to));

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

  // ── Totals row ────────────────────────────────────────────────────────────
  const totals = agents.reduce(
    (acc, a) => ({
      plan: acc.plan + a.plan,
      siActual: acc.siActual + a.siActual,
      soActual: acc.soActual + a.soActual,
      obCalls: acc.obCalls + a.obCalls,
      obCallsTarget: acc.obCallsTarget + a.obCallsTarget,
      callsToQuote: acc.callsToQuote + a.callsToQuote,
      quoteToSOQuotation: acc.quoteToSOQuotation + a.quoteToSOQuotation,
      quoteToSOSalesOrder: acc.quoteToSOSalesOrder + a.quoteToSOSalesOrder,
      soToSISalesOrder: acc.soToSISalesOrder + a.soToSISalesOrder,
      soToSIDelivered: acc.soToSIDelivered + a.soToSIDelivered,
      quotationAmountTarget: acc.quotationAmountTarget + a.quotationAmountTarget,
      quotationAmount: acc.quotationAmount + a.quotationAmount,
      quotesCount: acc.quotesCount + (a.quotesCount ?? 0),
      siteVisits: acc.siteVisits + a.siteVisits,
      siteVisitTarget: acc.siteVisitTarget + a.siteVisitTarget,
      accountDevelopment: acc.accountDevelopment + a.accountDevelopment,
      accountDevelopmentTarget: acc.accountDevelopmentTarget + a.accountDevelopmentTarget,
      timeSpentMs: acc.timeSpentMs + a.timeSpentMs,
    }),
    { plan: 0, siActual: 0, soActual: 0, obCalls: 0, obCallsTarget: 0, callsToQuote: 0, quoteToSOQuotation: 0, quoteToSOSalesOrder: 0, soToSISalesOrder: 0, soToSIDelivered: 0, quotationAmountTarget: 0, quotationAmount: 0, quotesCount: 0, siteVisits: 0, siteVisitTarget: 0, accountDevelopment: 0, accountDevelopmentTarget: 0, timeSpentMs: 0 }
  );
  const totalSiPct = totals.plan > 0 ? Math.round((totals.siActual / totals.plan) * 100) : 0;

  // ── Forecast date info — ALWAYS based on today's Manila date, not the filter range ──
  const { daysInMonth, daysElapsed } = useMemo(() => {
    // Compute days elapsed from the 1st of the current month to today (Manila time)
    const now    = new Date();
    const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const y      = manila.getFullYear();
    const mo     = manila.getMonth();
    const firstOfMonth = new Date(y, mo, 1);
    const todayManila  = new Date(y, mo, manila.getDate());
    const elapsed = Math.floor((todayManila.getTime() - firstOfMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysInMonth  = new Date(y, mo + 1, 0).getDate();
    return { daysInMonth, daysElapsed: Math.min(elapsed, daysInMonth) };
  }, []); // no dependencies — recomputes on each render from live Date
  const remainingDays = daysInMonth - daysElapsed;
  const hasDateData   = daysElapsed > 0;

  const agentForecast = useMemo(() => (agent: AgentRow) => {
    if (!hasDateData || !agent.plan) return null;
    const runRate      = agent.siActual / daysElapsed;
    const projectedSI  = agent.siActual + runRate * remainingDays;
    const projPct      = (projectedSI / agent.plan) * 100;
    const status       = forecastStatus(projPct);
    const prob         = hitProb(projPct);
    const remGap       = Math.max(0, agent.plan - agent.siActual);
    const catchUp      = remGap > 0 && remainingDays > 0 ? remGap / remainingDays : 0;
    const paceGap      = catchUp - runRate;
    return { runRate, projectedSI, projPct, status, prob, remGap, catchUp, paceGap };
  }, [daysElapsed, remainingDays, hasDateData]);

  const teamForecast = useMemo(() => {
    if (!hasDateData || totals.plan <= 0) return null;
    const runRate     = totals.siActual / daysElapsed;
    const projSI      = totals.siActual + runRate * remainingDays;
    const projPct     = (projSI / totals.plan) * 100;
    const status      = forecastStatus(projPct);
    const prob        = hitProb(projPct);
    const remGap      = Math.max(0, totals.plan - totals.siActual);
    const catchUp     = remGap > 0 && remainingDays > 0 ? remGap / remainingDays : 0;
    const paceGap     = catchUp - runRate;
    return { runRate, projSI, projPct, status, prob, remGap, catchUp, paceGap };
  }, [totals, daysElapsed, remainingDays, hasDateData]);

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
              onClick={() => setShowForecast((v) => !v)}
              className={[
                "px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-colors border",
                showForecast
                  ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                  : "bg-white hover:bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400",
              ].join(" ")}
            >
              {showForecast ? "Hide Forecast" : "Show Forecast (Beta Test)"}
            </button>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors"
            >
              Generate Data
            </button>

            {loading ? (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Spinner className="w-3.5 h-3.5" />
                <span>Loading…</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 mb-2">
            {error}
          </div>
        )}

        {/* Empty state if not fetched yet */}
        {!hasFetched && !error && (
          <p className="text-xs text-gray-400 text-center py-8">
            Click "Fetch Data" to load agent performance data.
          </p>
        )}

        {/* Table (blurred if loading) */}
        {hasFetched && (
          <div className={`overflow-x-auto transition-all duration-300 relative ${loading ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
            {/* Loading overlay while fetching */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Spinner className="w-5 h-5" />
                  <span>Loading data…</span>
                </div>
              </div>
            )}

            {/* Empty state if no agents */}
            {!loading && !error && agents.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">
                No active agents found under your team.
              </p>
            )}

            {/* Table if agents exist */}
            {agents.length > 0 && (
              <table className="min-w-full text-xs relative">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-1 font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-white z-10 min-w-[140px]">Agent</th>
                    <th className={thCls}>Plan</th>
                    <th className={`${thCls} text-green-600`}>SI Actual</th>
                    <th className={`${thCls} text-green-600`}>SO Actual</th>
                    {showForecast && <th className={thCls} style={{ background: "#eef2ff" }}>Run Rate/Day</th>}
                    {showForecast && <th className={thCls} style={{ background: "#eef2ff" }}>Projected EOM SI</th>}
                    {showForecast && <th className={`${thCls} text-center`} style={{ background: "#eef2ff" }}>Proj. Att%</th>}
                    {showForecast && <th className={`${thCls} text-center`} style={{ background: "#eef2ff" }}>Forecast</th>}                    {showForecast && <th className={`${thCls} text-center`} style={{ background: "#eef2ff" }}>Hit Prob</th>}
                    {showForecast && <th className={thCls} style={{ background: "#eef2ff" }}>Rem. Gap</th>}
                    {showForecast && <th className={thCls} style={{ background: "#eef2ff" }}>Catch-Up/Day</th>}
                    {showForecast && <th className={thCls} style={{ background: "#eef2ff" }}>Pace Gap</th>}
                    <th className={thCls}>OB Calls</th>
                    <th className={thCls}>Calls → Quote</th>
                    <th className={thCls}>Quote → SO</th>
                    <th className={thCls}>SO → SI</th>
                    <th className={thCls}>Quotation Target</th>
                    <th className={thCls}>Quotation Amount</th>
                    <th className={thCls}>Quotes Qty</th>
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
                      {/* ── Forecast cells ── */}
                      {showForecast && (() => {
                        const fc = agentForecast(agent);
                        const fcBg = "bg-indigo-50/20";
                        if (!fc) return (
                          <>
                            {Array.from({ length: 8 }).map((_, i) => (
                              <td key={i} className={`${tdCls} ${fcBg} text-gray-300`}>N/A</td>
                            ))}
                          </>
                        );
                        const cfg = STATUS_CFG[fc.status];
                        return (
                          <>
                            <td className={`${tdCls} ${fcBg}`}>{fmtCompact(fc.runRate)}/d</td>
                            <td className={`${tdCls} ${fcBg} font-bold`}>{fmtPeso(fc.projectedSI)}</td>
                            <td className={`text-center py-2.5 px-1 ${fcBg}`}>
                              <span className={`text-xs font-bold tabular-nums ${fc.projPct >= 100 ? "text-green-600" : fc.projPct >= 80 ? "text-amber-600" : "text-red-500"}`}>
                                {fmtPct(fc.projPct)}
                              </span>
                            </td>
                            <td className={`text-center py-2.5 px-1 ${fcBg}`}>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className={`text-center py-2.5 px-1 ${fcBg}`}>
                              <ProbBar prob={fc.prob} status={fc.status} />
                            </td>
                            <td className={`${tdCls} ${fcBg} ${fc.remGap <= 0 ? "text-green-600" : "text-red-500"}`}>
                              {fc.remGap <= 0 ? "—" : fmtCompact(fc.remGap)}
                            </td>
                            <td className={`${tdCls} ${fcBg} ${fc.catchUp <= 0 ? "text-green-600" : fc.status === "risk" ? "text-amber-600" : "text-red-500"} font-bold`}>
                              {fc.catchUp <= 0 ? "₱0 ✅" : fmtCompact(fc.catchUp) + "/d"}
                            </td>
                            <td className={`${tdCls} ${fcBg} ${fc.paceGap <= 0 ? "text-green-600" : "text-red-500"}`}>
                              {fc.paceGap <= 0 ? "✅ OK" : `+${fmtCompact(fc.paceGap)}/d`}
                            </td>
                          </>
                        );
                      })()}
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
                      <td className={tdCls}>
                        {(agent.quotesCount ?? 0) > 0
                          ? `${agent.quotesCount}${(agent.quotesTarget ?? 0) > 0 ? `/${agent.quotesTarget}` : ""}`
                          : "—"}
                      </td>
                      <td className={tdCls}>{agent.siteVisits}{agent.siteVisitTarget > 0 ? `/${agent.siteVisitTarget}` : ""}</td>
                      <td className={tdCls}>{agent.accountDevelopment}{agent.accountDevelopmentTarget > 0 ? `/${agent.accountDevelopmentTarget}` : ""}</td>
                      <td className={tdCls}>
                        <div className="flex flex-col items-end gap-1">
                          <span style={{ color: dbCoverageBarColor(agent.dbCoverageTotal > 0 ? Math.round((agent.dbCoverageCovered / agent.dbCoverageTotal) * 100) : 0) }} className="font-medium">
                            {agent.dbCoverageCovered}/{agent.dbCoverageTotal}
                          </span>
                        </div>
                      </td>
                      <td className={tdCls}><TimeSpentCell agentName={agent.name} totalMs={agent.timeSpentMs} breakdown={agent.timeSpentBreakdown ?? {}} /></td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgResponseTime)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgNonQuotationHT)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgQuotationHT)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgSpfHT)}</td>
                    </tr>
                  ))}
                </tbody>

                {/* Totals footer */}
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold whitespace-nowrap">
                    <td className="py-2.5 px-1 text-xs font-black uppercase tracking-widest text-gray-600">Team Total</td>
                    <td className={tdCls}>{fmtPeso(totals.plan)}</td>
                    <td className={`${tdCls} text-green-700`}>{fmtPeso(totals.siActual)}</td>
                    {/* ── Team forecast cells ── */}
                    {showForecast && (() => {
                      const fcBg = "bg-indigo-50/20";
                      if (!teamForecast) return Array.from({ length: 8 }).map((_, i) => (
                        <td key={i} className={`${tdCls} ${fcBg} text-gray-300`}>N/A</td>
                      ));
                      const cfg = STATUS_CFG[teamForecast.status];
                      return (
                        <>
                          <td className={`${tdCls} ${fcBg}`}>{fmtCompact(teamForecast.runRate)}/d</td>
                          <td className={`${tdCls} ${fcBg} font-bold`}>{fmtPeso(teamForecast.projSI)}</td>
                          <td className={`text-center py-2.5 px-1 ${fcBg}`}>
                            <span className={`text-xs font-bold tabular-nums ${teamForecast.projPct >= 100 ? "text-green-700" : teamForecast.projPct >= 80 ? "text-amber-700" : "text-red-600"}`}>
                              {fmtPct(teamForecast.projPct)}
                            </span>
                          </td>
                          <td className={`text-center py-2.5 px-1 ${fcBg}`}>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className={`text-center py-2.5 px-1 ${fcBg}`}>
                            <ProbBar prob={teamForecast.prob} status={teamForecast.status} />
                          </td>
                          <td className={`${tdCls} ${fcBg} ${teamForecast.remGap <= 0 ? "text-green-700" : "text-red-600"}`}>
                            {teamForecast.remGap <= 0 ? "—" : fmtCompact(teamForecast.remGap)}
                          </td>
                          <td className={`${tdCls} ${fcBg} font-bold ${teamForecast.catchUp <= 0 ? "text-green-700" : "text-red-600"}`}>
                            {teamForecast.catchUp <= 0 ? "₱0 ✅" : fmtCompact(teamForecast.catchUp) + "/d"}
                          </td>
                          <td className={`${tdCls} ${fcBg} ${teamForecast.paceGap <= 0 ? "text-green-700" : "text-red-600"}`}>
                            {teamForecast.paceGap <= 0 ? "✅ OK" : `+${fmtCompact(teamForecast.paceGap)}/d`}
                          </td>
                        </>
                      );
                    })()}
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
                    <td className={tdCls}>{totals.quotesCount > 0 ? totals.quotesCount : "—"}</td>
                    <td className={tdCls}>{totals.siteVisits}{totals.siteVisitTarget > 0 ? `/${totals.siteVisitTarget}` : ""}</td>
                    <td className={tdCls}>{totals.accountDevelopment}{totals.accountDevelopmentTarget > 0 ? `/${totals.accountDevelopmentTarget}` : ""}</td>
                    <td className={tdCls}>—</td>
                    <td className={tdCls}><TimeSpentCell agentName="Team Total" totalMs={totals.timeSpentMs} breakdown={(() => {
                      const bd: Record<string, number> = {};
                      agents.forEach((a) => {
                        Object.entries(a.timeSpentBreakdown ?? {}).forEach(([k, v]) => {
                          bd[k] = (bd[k] ?? 0) + v;
                        });
                      });
                      return bd;
                    })()} /></td>
                    {/* CSR metrics are averages — not meaningful to sum, show em dash */}
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
