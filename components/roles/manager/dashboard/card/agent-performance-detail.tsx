"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { User } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DateRange { from?: Date; to?: Date; }

interface ManagerAgentPerformanceDetailProps {
  manager: string;
  dateRange?: DateRange;
  /** Fires with footer totals whenever agents update — used to sync ManagerSalesPipelineCard */
  onTotalsReady?: (totals: {
    obCalls: number; obCallsTarget: number;
    callsToQuote: number;
    quoteToSOQuotation: number; quoteToSOSalesOrder: number;
    soToSISalesOrder: number; soToSIDelivered: number;
    quotesCount: number; quotesTarget: number;
    accountDevelopment: number; accountDevelopmentTarget: number;
  }) => void;
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

// ── Time Spent Breakdown Dialog ───────────────────────────────────────────────

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return typeof window !== "undefined"
    ? require("react-dom").createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-900 text-white">
              <div>
                <p className="font-black text-sm tracking-tight">{agentName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">Time Spent Breakdown</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors ml-4" aria-label="Close">
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
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{activity}</span>
                      <span className="text-xs font-mono text-gray-900 shrink-0">{fmtTimeMs(ms)}</span>
                      <span className="text-[10px] text-gray-400 shrink-0 w-8 text-right">{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full">
                      <div className="h-1.5 rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">Total</span>
              <span className="text-sm font-extrabold text-gray-900 font-mono">{fmtTimeMs(totalMs)}</span>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}

function TimeSpentCell({ agentName, totalMs, breakdown }: { agentName: string; totalMs: number; breakdown: Record<string, number> }) {
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
      {open && <TimeSpentDialog agentName={agentName} totalMs={totalMs} breakdown={breakdown} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ManagerAgentPerformanceDetail: React.FC<ManagerAgentPerformanceDetailProps> = ({
  manager,
  dateRange,
  onTotalsReady,
}) => {
  const [agents,      setAgents]      = useState<AgentRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [hasFetched,  setHasFetched]  = useState(false);
  const [loadingCols, setLoadingCols] = useState<Set<string>>(new Set());
  const fetchIdRef = useRef(0);

  const COLUMN_GROUPS = [
    "si_so", "ob", "conversion", "quotation",
    "sitevisits", "accountdev", "dbcoverage", "timespent", "csr",
  ] as const;
  type ColGroup = typeof COLUMN_GROUPS[number];

  const fetchData = useCallback(async () => {
    if (!manager) return;
    const fetchId = ++fetchIdRef.current;

    setLoading(true);
    setError(null);
    setHasFetched(true);
    setAgents([]);
    setLoadingCols(new Set<string>(COLUMN_GROUPS));

    const params = new URLSearchParams({ manager });
    if (dateRange?.from) params.append("from", toDateStr(dateRange.from));
    if (dateRange?.to)   params.append("to",   toDateStr(dateRange.to));

    try {
      // Step 1: si_so — seed the table immediately
      const firstParams = new URLSearchParams(params);
      firstParams.set("fields", "si_so");
      const firstRes = await fetch(`/api/manager-agent-performance?${firstParams}`);
      if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
      const firstData = await firstRes.json();
      if (!firstData.success) throw new Error(firstData.error ?? "Unknown error");
      if (fetchId !== fetchIdRef.current) return;

      const agentList: AgentRow[] = firstData.agents ?? [];
      setAgents(agentList);
      setLoadingCols((prev) => { const s = new Set(prev); s.delete("si_so"); return s; });
      setLoading(false);

      // Step 2: remaining columns sequentially
      for (const col of COLUMN_GROUPS.slice(1) as ColGroup[]) {
        if (fetchId !== fetchIdRef.current) return;

        // dbcoverage: use /api/db-coverage per agent (same as database-coverage.tsx)
        if (col === "dbcoverage") {
          try {
            if (agentList.length > 0) {
              const refDate    = dateRange?.from ?? new Date();
              const refStr     = refDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
              const [fy, fm]   = refStr.split("-").map(Number);
              const monthStart = `${fy}-${String(fm).padStart(2, "0")}-01`;
              const monthEnd   = new Date(Date.UTC(fy, fm, 0)).toISOString().split("T")[0];

              const results = await Promise.all(
                agentList.map((a) =>
                  fetch(`/api/db-coverage?referenceid=${encodeURIComponent(a.referenceid)}&from=${monthStart}&to=${monthEnd}`)
                    .then((r) => r.ok ? r.json() : { success: false })
                    .catch(() => ({ success: false }))
                )
              );
              if (fetchId !== fetchIdRef.current) return;

              const dbMap = new Map<string, { coveredCount: number; totalCount: number }>();
              agentList.forEach((a, i) => {
                const d = results[i];
                dbMap.set(a.referenceid, {
                  coveredCount: d.success ? (d.coveredCount ?? 0) : 0,
                  totalCount:   d.success ? (d.totalCount   ?? 0) : 0,
                });
              });
              setAgents((prev) => prev.map((agent) => {
                const db = dbMap.get(agent.referenceid);
                return db ? { ...agent, dbCoverageCovered: db.coveredCount, dbCoverageTotal: db.totalCount } : agent;
              }));
            }
          } catch { /* silent */ }
          setLoadingCols((prev) => { const s = new Set(prev); s.delete("dbcoverage"); return s; });
          continue;
        }

        const colParams = new URLSearchParams(params);
        colParams.set("fields", col);
        try {
          const res = await fetch(`/api/manager-agent-performance?${colParams}`);
          if (!res.ok) { setLoadingCols((prev) => { const s = new Set(prev); s.delete(col); return s; }); continue; }
          const data = await res.json();
          if (!data.success || !data.agents) { setLoadingCols((prev) => { const s = new Set(prev); s.delete(col); return s; }); continue; }
          if (fetchId !== fetchIdRef.current) return;

          setAgents((prev) => {
            const incoming = new Map<string, AgentRow>(data.agents.map((a: AgentRow) => [a.referenceid, a]));
            return prev.map((agent) => {
              const upd = incoming.get(agent.referenceid);
              if (!upd) return agent;
              const m = { ...agent };
              if (col === "ob")         { m.obCalls = upd.obCalls; m.obCallsTarget = upd.obCallsTarget; }
              if (col === "conversion") { m.callsToQuote = upd.callsToQuote; m.quoteToSOQuotation = upd.quoteToSOQuotation; m.quoteToSOSalesOrder = upd.quoteToSOSalesOrder; m.soToSISalesOrder = upd.soToSISalesOrder; m.soToSIDelivered = upd.soToSIDelivered; }
              if (col === "quotation")  { m.quotationAmount = upd.quotationAmount; m.quotationAmountTarget = upd.quotationAmountTarget; m.quotesCount = upd.quotesCount; m.quotesTarget = upd.quotesTarget; }
              if (col === "sitevisits") { m.siteVisits = upd.siteVisits; m.siteVisitTarget = upd.siteVisitTarget; }
              if (col === "accountdev") { m.accountDevelopment = upd.accountDevelopment; m.accountDevelopmentTarget = upd.accountDevelopmentTarget; }
              if (col === "timespent")  { m.timeSpentMs = upd.timeSpentMs; m.timeSpentBreakdown = upd.timeSpentBreakdown; }
              if (col === "csr")        { m.avgResponseTime = upd.avgResponseTime; m.avgNonQuotationHT = upd.avgNonQuotationHT; m.avgQuotationHT = upd.avgQuotationHT; m.avgSpfHT = upd.avgSpfHT; }
              return m;
            });
          });
        } catch { /* silent */ }
        setLoadingCols((prev) => { const s = new Set(prev); s.delete(col); return s; });
      }
    } catch (err: any) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err.message ?? "Failed to load data.");
      setLoading(false);
      setLoadingCols(new Set());
    }
  }, [manager, dateRange]);

  // ── Totals (memoized to avoid infinite loop in useEffect below) ──────────
  const totals = useMemo(() => agents.reduce(
    (acc, a) => ({
      plan:                     acc.plan + a.plan,
      siActual:                 acc.siActual + a.siActual,
      soActual:                 acc.soActual + a.soActual,
      obCalls:                  acc.obCalls + a.obCalls,
      obCallsTarget:            acc.obCallsTarget + a.obCallsTarget,
      callsToQuote:             acc.callsToQuote + a.callsToQuote,
      quoteToSOQuotation:       acc.quoteToSOQuotation + a.quoteToSOQuotation,
      quoteToSOSalesOrder:      acc.quoteToSOSalesOrder + a.quoteToSOSalesOrder,
      soToSISalesOrder:         acc.soToSISalesOrder + a.soToSISalesOrder,
      soToSIDelivered:          acc.soToSIDelivered + a.soToSIDelivered,
      quotationAmountTarget:    acc.quotationAmountTarget + a.quotationAmountTarget,
      quotationAmount:          acc.quotationAmount + a.quotationAmount,
      quotesCount:              acc.quotesCount + (a.quotesCount ?? 0),
      quotesTarget:             acc.quotesTarget + (a.quotesTarget ?? 0),
      siteVisits:               acc.siteVisits + a.siteVisits,
      siteVisitTarget:          acc.siteVisitTarget + a.siteVisitTarget,
      accountDevelopment:       acc.accountDevelopment + a.accountDevelopment,
      accountDevelopmentTarget: acc.accountDevelopmentTarget + a.accountDevelopmentTarget,
      timeSpentMs:              acc.timeSpentMs + a.timeSpentMs,
    }),
    { plan:0, siActual:0, soActual:0, obCalls:0, obCallsTarget:0, callsToQuote:0, quoteToSOQuotation:0, quoteToSOSalesOrder:0, soToSISalesOrder:0, soToSIDelivered:0, quotationAmountTarget:0, quotationAmount:0, quotesCount:0, quotesTarget:0, siteVisits:0, siteVisitTarget:0, accountDevelopment:0, accountDevelopmentTarget:0, timeSpentMs:0 }
  ), [agents]);

  // ── Notify parent on agents change (not on every render) ────────────────
  useEffect(() => {
    if (!onTotalsReady || agents.length === 0) return;
    onTotalsReady({
      obCalls:                  totals.obCalls,
      obCallsTarget:            totals.obCallsTarget,
      callsToQuote:             totals.callsToQuote,
      quoteToSOQuotation:       totals.quoteToSOQuotation,
      quoteToSOSalesOrder:      totals.quoteToSOSalesOrder,
      soToSISalesOrder:         totals.soToSISalesOrder,
      soToSIDelivered:          totals.soToSIDelivered,
      quotesCount:              totals.quotesCount,
      quotesTarget:             totals.quotesTarget,
      accountDevelopment:       totals.accountDevelopment,
      accountDevelopmentTarget: totals.accountDevelopmentTarget,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  // Aggregate breakdown for team total
  const totalBreakdown = agents.reduce<Record<string, number>>((bd, a) => {
    Object.entries(a.timeSpentBreakdown ?? {}).forEach(([k, v]) => {
      bd[k] = (bd[k] ?? 0) + v;
    });
    return bd;
  }, {});

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
              onClick={fetchData}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors"
            >
              Generate Data
            </button>
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Spinner className="w-3.5 h-3.5" /><span>Loading…</span>
              </div>
            )}
            {!loading && loadingCols.size > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Spinner className="w-3.5 h-3.5" />
                <span>Fetching {[...loadingCols].join(", ")}…</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 mb-2">{error}</div>
        )}

        {!hasFetched && !error && (
          <p className="text-xs text-gray-400 text-center py-8">
            Click "Generate Data" to load agent performance data.
          </p>
        )}

        {hasFetched && (
          <div className={`overflow-x-auto transition-all duration-300 relative ${loading ? "blur-sm opacity-50 pointer-events-none" : ""}`}>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Spinner className="w-5 h-5" /><span>Loading data…</span>
                </div>
              </div>
            )}

            {!loading && !error && agents.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">No active agents found under your team.</p>
            )}

            {agents.length > 0 && (
              <table className="min-w-full text-xs relative">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-1 font-medium text-gray-500 whitespace-nowrap sticky left-0 bg-white z-10 min-w-[140px]">Agent</th>
                    <th className={thCls}>Plan</th>
                    <th className={thCls}>SI Actual</th>
                    <th className={thCls}>SO Actual</th>
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
                        <span style={{ color: dbCoverageBarColor(agent.dbCoverageTotal > 0 ? Math.round((agent.dbCoverageCovered / agent.dbCoverageTotal) * 100) : 0) }} className="font-medium">
                          {agent.dbCoverageCovered}/{agent.dbCoverageTotal}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <TimeSpentCell agentName={agent.name} totalMs={agent.timeSpentMs} breakdown={agent.timeSpentBreakdown ?? {}} />
                      </td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgResponseTime)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgNonQuotationHT)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgQuotationHT)}</td>
                      <td className={tdCls}>{fmtHoursHMS(agent.avgSpfHT)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold whitespace-nowrap">
                    <td className="py-2.5 px-1 text-xs font-black uppercase tracking-widest text-gray-600">Team Total</td>
                    <td className={tdCls}>{fmtPeso(totals.plan)}</td>
                    <td className={`${tdCls} text-green-700`}>{fmtPeso(totals.siActual)}</td>
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
                    <td className={tdCls}>
                      <TimeSpentCell agentName="Team Total" totalMs={totals.timeSpentMs} breakdown={totalBreakdown} />
                    </td>
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
