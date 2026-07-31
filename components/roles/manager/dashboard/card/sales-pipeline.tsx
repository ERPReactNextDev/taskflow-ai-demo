"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { HelpCircle, X, ChevronRight, Settings, RefreshCw } from "lucide-react";

interface ManagerSalesPipelineCardProps {
  manager?: string;
  dateRange?: { from?: Date; to?: Date };
  obCallsCount?: number;
  loadingObCalls?: boolean;
  loadingObCallsTarget?: boolean;
  quotesCount?: number;
  loadingQuotes?: boolean;
  callsToQuotesCount?: number;
  loadingCallsToQuotes?: boolean;
  quoteToSOQuotationCount?: number;
  quoteToSOSalesOrderCount?: number;
  loadingQuoteToSO?: boolean;
  soToSISalesOrderCount?: number;
  soToSIDeliveredCount?: number;
  newAccountCount?: number;
  newAccountTarget?: number;
  loadingNewAccount?: boolean;
}

function standardRating(pct: number) {
  if (pct >= 91) return 5; if (pct >= 81) return 4;
  if (pct >= 61) return 3; if (pct >= 50) return 2; return 1;
}

const RATING_TABLE = [
  { range: "â‰¥ 91%", rating: 5, color: "text-green-700 bg-green-50" },
  { range: "81 â€“ 90%", rating: 4, color: "text-blue-700 bg-blue-50" },
  { range: "61 â€“ 80%", rating: 3, color: "text-yellow-700 bg-yellow-50" },
  { range: "50 â€“ 60%", rating: 2, color: "text-orange-700 bg-orange-50" },
  { range: "< 50%", rating: 1, color: "text-red-700 bg-red-50" },
];
const CONV_RATING_TABLE = {
  callsToQuote: [
    { range: "â‰¥ 20%", rating: 5, color: "text-green-700 bg-green-50" },
    { range: "14.01 â€“ 19.99%", rating: 4, color: "text-blue-700 bg-blue-50" },
    { range: "12.01 â€“ 14%", rating: 3, color: "text-yellow-700 bg-yellow-50" },
    { range: "10.01 â€“ 12%", rating: 2, color: "text-orange-700 bg-orange-50" },
    { range: "< 10%", rating: 1, color: "text-red-700 bg-red-50" },
  ],
  quoteToSO: [
    { range: "â‰¥ 30%", rating: 5, color: "text-green-700 bg-green-50" },
    { range: "25.01 â€“ 29.99%", rating: 4, color: "text-blue-700 bg-blue-50" },
    { range: "20.01 â€“ 25%", rating: 3, color: "text-yellow-700 bg-yellow-50" },
    { range: "15.01 â€“ 20%", rating: 2, color: "text-orange-700 bg-orange-50" },
    { range: "< 15%", rating: 1, color: "text-red-700 bg-red-50" },
  ],
  soToSI: [
    { range: "â‰¥ 70%", rating: 5, color: "text-green-700 bg-green-50" },
    { range: "60.01 â€“ 69.99%", rating: 4, color: "text-blue-700 bg-blue-50" },
    { range: "50.01 â€“ 60%", rating: 3, color: "text-yellow-700 bg-yellow-50" },
    { range: "40.01 â€“ 50%", rating: 2, color: "text-orange-700 bg-orange-50" },
    { range: "< 40%", rating: 1, color: "text-red-700 bg-red-50" },
  ],
};

function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest ${color}`}>
      <span>{icon}</span><span>{title}</span>
    </div>
  );
}
function FormulaRow({ label, formula, result, highlight = false }: {
  label: string; formula: string; result: string | number; highlight?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[140px_1fr_80px] gap-2 items-center px-3 py-1.5 rounded text-[11px] ${highlight ? "bg-gray-900 text-white" : "bg-gray-50"}`}>
      <span className={`font-bold ${highlight ? "text-gray-300" : "text-gray-500"} uppercase tracking-wide`}>{label}</span>
      <span className={`font-mono ${highlight ? "text-yellow-300" : "text-gray-700"}`}>{formula}</span>
      <span className={`font-black text-right ${highlight ? "text-white" : "text-gray-900"}`}>{result}</span>
    </div>
  );
}
function RatingTable({ rows }: { rows: { range: string; rating: number; color: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 mt-1">
      {rows.map((r) => (
        <div key={r.rating} className={`flex items-center justify-between px-2 py-1 rounded text-[10px] font-bold ${r.color}`}>
          <span>{r.range}</span><span>Rating {r.rating}</span>
        </div>
      ))}
    </div>
  );
}

interface ExplainPanelProps {
  open: boolean; onClose: () => void;
  obCallsCount: number; obCallsTarget: number; obCallsPercentage: number; obCallsRating: number;
  quotesCount: number; quotesTarget: number; quotesPercentage: number; quotesRating: number;
  callsToQuotesCount: number; callsToQuotePercentage: number; callsToQuoteRating: number;
  quoteToSOQuotationCount: number; quoteToSOSalesOrderCount: number; quoteToSOPercentage: number; quoteToSORating: number;
  soToSISalesOrderCount: number; soToSIDeliveredCount: number; soToSIPercentage: number; soToSIRating: number;
  newAccountCount: number; newAccountTarget: number; newAccountPercentage: number; newAccountRating: number;
}

const ExplainPanel: React.FC<ExplainPanelProps> = ({
  open, onClose,
  obCallsCount, obCallsTarget, obCallsPercentage, obCallsRating,
  quotesCount, quotesTarget, quotesPercentage, quotesRating,
  callsToQuotesCount, callsToQuotePercentage, callsToQuoteRating,
  quoteToSOQuotationCount, quoteToSOSalesOrderCount, quoteToSOPercentage, quoteToSORating,
  soToSISalesOrderCount, soToSIDeliveredCount, soToSIPercentage, soToSIRating,
  newAccountCount, newAccountTarget, newAccountPercentage, newAccountRating,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("ob");
  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex justify-end" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-900 text-white shrink-0">
          <div>
            <p className="font-black text-sm uppercase tracking-widest">Computation Guide</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Step-by-step breakdown ng bawat metric</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* OB Calls */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggle("ob")} className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors">
              <SectionHeader icon="ðŸ“ž" title="OB Calls â€” Achievement" color="bg-transparent text-blue-800" />
              <ChevronRight className={`w-4 h-4 text-blue-500 transition-transform ${expandedSection === "ob" ? "rotate-90" : ""}`} />
            </button>
            {expandedSection === "ob" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Actual OB Calls" formula="Bilang ng Outbound - Touchbase" result={obCallsCount} />
                <FormulaRow label="Monthly Target" formula="Nakaset na target sa settings" result={obCallsTarget} />
                <FormulaRow label="Achievement %" formula={`(${obCallsCount} ÷ ${obCallsTarget}) Ã— 100`} result={`${obCallsPercentage}%`} />
                <FormulaRow label="Rating" formula="Batay sa achievement %" result={obCallsRating} highlight />
                <RatingTable rows={RATING_TABLE} />
              </div>
            )}
          </div>
          {/* Quotes */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggle("quotes")} className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors">
              <SectionHeader icon="ðŸ“„" title="Quotes Generated â€” Achievement" color="bg-transparent text-green-800" />
              <ChevronRight className={`w-4 h-4 text-green-500 transition-transform ${expandedSection === "quotes" ? "rotate-90" : ""}`} />
            </button>
            {expandedSection === "quotes" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Quotes Made" formula="Bilang ng Quotation Preparation" result={quotesCount} />
                <FormulaRow label="Monthly Target" formula="Nakaset na target sa settings" result={quotesTarget} />
                <FormulaRow label="Achievement %" formula={`(${quotesCount} ÷ ${quotesTarget}) Ã— 100`} result={`${quotesPercentage}%`} />
                <FormulaRow label="Rating" formula="Batay sa achievement %" result={quotesRating} highlight />
                <RatingTable rows={RATING_TABLE} />
              </div>
            )}
          </div>
          {/* Calls â†’ Quote */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggle("c2q")} className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 hover:bg-yellow-100 transition-colors">
              <SectionHeader icon="ðŸ”„" title="Calls â†’ Quote Conversion" color="bg-transparent text-yellow-800" />
              <ChevronRight className={`w-4 h-4 text-yellow-500 transition-transform ${expandedSection === "c2q" ? "rotate-90" : ""}`} />
            </button>
            {expandedSection === "c2q" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Activities w/ Quote" formula="Activity na may OB + Quotation" result={callsToQuotesCount} />
                <FormulaRow label="Total OB Calls" formula="Lahat ng OB calls" result={obCallsCount} />
                <FormulaRow label="Conversion %" formula={`(${callsToQuotesCount} ÷ ${obCallsCount}) Ã— 100`} result={`${callsToQuotePercentage}%`} />
                <FormulaRow label="Target" formula="Fixed: 20%" result="20%" />
                <FormulaRow label="Rating" formula="Batay sa conversion %" result={callsToQuoteRating} highlight />
                <RatingTable rows={CONV_RATING_TABLE.callsToQuote} />
              </div>
            )}
          </div>
          {/* Quote â†’ SO */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggle("q2so")} className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100 transition-colors">
              <SectionHeader icon="ðŸ“¦" title="Quote â†’ SO Conversion" color="bg-transparent text-orange-800" />
              <ChevronRight className={`w-4 h-4 text-orange-500 transition-transform ${expandedSection === "q2so" ? "rotate-90" : ""}`} />
            </button>
            {expandedSection === "q2so" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Activities w/ SO" formula="Activity na may Quote + SO" result={quoteToSOSalesOrderCount} />
                <FormulaRow label="Activities w/ Quote" formula="Activity na may OB + Quotation" result={quoteToSOQuotationCount} />
                <FormulaRow label="Conversion %" formula={`(${quoteToSOSalesOrderCount} ÷ ${quoteToSOQuotationCount}) Ã— 100`} result={`${quoteToSOPercentage}%`} />
                <FormulaRow label="Target" formula="Fixed: 30%" result="30%" />
                <FormulaRow label="Rating" formula="Batay sa conversion %" result={quoteToSORating} highlight />
                <RatingTable rows={CONV_RATING_TABLE.quoteToSO} />
              </div>
            )}
          </div>
          {/* SO â†’ SI */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggle("so2si")} className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100 transition-colors">
              <SectionHeader icon="âœ…" title="SO â†’ SI Conversion" color="bg-transparent text-red-800" />
              <ChevronRight className={`w-4 h-4 text-red-500 transition-transform ${expandedSection === "so2si" ? "rotate-90" : ""}`} />
            </button>
            {expandedSection === "so2si" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Delivered / SI" formula="Activity na may SO + Delivered" result={soToSIDeliveredCount} />
                <FormulaRow label="Activities w/ SO" formula="Activity na may Quote + SO" result={soToSISalesOrderCount} />
                <FormulaRow label="Conversion %" formula={`(${soToSIDeliveredCount} ÷ ${soToSISalesOrderCount}) Ã— 100`} result={`${soToSIPercentage}%`} />
                <FormulaRow label="Target" formula="Fixed: 70%" result="70%" />
                <FormulaRow label="Rating" formula="Batay sa conversion %" result={soToSIRating} highlight />
                <RatingTable rows={CONV_RATING_TABLE.soToSI} />
              </div>
            )}
          </div>
          {/* New Account */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={() => toggle("newacct")} className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors">
              <SectionHeader icon="ðŸ¢" title="New Account Development" color="bg-transparent text-purple-800" />
              <ChevronRight className={`w-4 h-4 text-purple-500 transition-transform ${expandedSection === "newacct" ? "rotate-90" : ""}`} />
            </button>
            {expandedSection === "newacct" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="New Accounts" formula="Bilang ng bagong accounts" result={newAccountCount} />
                <FormulaRow label="Monthly Target" formula="Nakaset na target sa settings" result={newAccountTarget} />
                <FormulaRow label="Achievement %" formula={`(${newAccountCount} ÷ ${newAccountTarget}) Ã— 100`} result={`${newAccountPercentage}%`} />
                <FormulaRow label="Rating" formula="Batay sa achievement %" result={newAccountRating} highlight />
                <RatingTable rows={RATING_TABLE} />
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 px-5 py-3 border-t bg-gray-50 text-[10px] text-gray-400 text-center">
          Ang mga halaga ay live â€” batay sa kasalukuyang date range filter
        </div>
      </div>
    </div>
  );
};

// â”€â”€ Main Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const ManagerSalesPipelineCard: React.FC<ManagerSalesPipelineCardProps> = ({
  manager,
  dateRange,
  obCallsCount: obCallsCountProp = 0,
  loadingObCalls = false,
  loadingObCallsTarget = false,
  quotesCount = 0,
  loadingQuotes = false,
  callsToQuotesCount: callsToQuotesCountProp = 0,
  loadingCallsToQuotes = false,
  quoteToSOQuotationCount: quoteToSOQuotationCountProp = 0,
  quoteToSOSalesOrderCount: quoteToSOSalesOrderCountProp = 0,
  loadingQuoteToSO = false,
  soToSISalesOrderCount: soToSISalesOrderCountProp = 0,
  soToSIDeliveredCount: soToSIDeliveredCountProp = 0,
  newAccountCount = 0,
  newAccountTarget: propNewAccountTarget = 0,
  loadingNewAccount = false,
}) => {
  const router = useRouter();
  const [explainOpen, setExplainOpen] = useState(false);

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "";
    router.push(`/roles/manager/sales-quotation-settings${id ? `?id=${encodeURIComponent(id)}` : ""}`);
  };

  // -- Self-fetch: OB count + ALL conversion counts from unified API + targets --
  const [selfObCallsCount,          setSelfObCallsCount]          = useState<number | null>(null);
  const [selfCallsToQuotesCount,    setSelfCallsToQuotesCount]    = useState<number | null>(null);
  const [selfQuoteToSOQuotation,    setSelfQuoteToSOQuotation]    = useState<number | null>(null);
  const [selfQuoteToSOSalesOrder,   setSelfQuoteToSOSalesOrder]   = useState<number | null>(null);
  const [selfSoToSISalesOrder,      setSelfSoToSISalesOrder]      = useState<number | null>(null);
  const [selfSoToSIDelivered,       setSelfSoToSIDelivered]       = useState<number | null>(null);
  const [teamObTarget,              setTeamObTarget]              = useState<number | null>(null);
  const [teamQuotesTarget,          setTeamQuotesTarget]          = useState<number | null>(null);
  const [teamNewAccountTarget,      setTeamNewAccountTarget]      = useState<number | null>(null);
  const [loadingFetch,              setLoadingFetch]              = useState(false);

  const fetchTeamTargets = useCallback(async () => {
    if (!manager) return;
    setLoadingFetch(true);
    const refDate   = dateRange?.from ?? new Date();
    const monthName = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"][refDate.getMonth()];
    const year      = refDate.getFullYear().toString();
    const params    = new URLSearchParams({ manager, year });
    const now  = new Date();
    const from = dateRange?.from
      ? dateRange.from.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
      : new Date(now.getFullYear(), now.getMonth(), 1)
          .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const to   = dateRange?.to
      ? dateRange.to.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
      : now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const mBase      = `manager=${encodeURIComponent(manager)}`;
    const dateSuffix = `&from=${from}&to=${to}`;

    // OB count (Successful)
    try {
      const res = await fetch(`/api/manager-agent-outbound-history?${mBase}&from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        const history: any[] = data.history ?? [];
        setSelfObCallsCount(history.filter(
          (r) => r.source === "Outbound - Touchbase" && r.call_status === "Successful"
        ).length);
      }
    } catch { /* silent */ }

    // All conversion counts from unified API (same logic as Agent Performance Detail)
    try {
      const convRes = await fetch(`/api/manager-pipeline-conversion?${mBase}${dateSuffix}`);
      if (convRes.ok) {
        const convData = await convRes.json();
        if (convData.success) {
          setSelfCallsToQuotesCount(Number(convData.callsToQuoteCount)         || 0);
          setSelfQuoteToSOQuotation(Number(convData.quoteToSOQuotationCount)   || 0);
          setSelfQuoteToSOSalesOrder(Number(convData.quoteToSOSalesOrderCount) || 0);
          setSelfSoToSISalesOrder(Number(convData.soToSISalesOrderCount)       || 0);
          setSelfSoToSIDelivered(Number(convData.soToSIDeliveredCount)         || 0);
        }
      }
    } catch { /* silent */ }

    // OB target
    try {
      const obRes = await fetch(`/api/manager-agent-ob-target-sum?${params.toString()}`);
      if (obRes.ok) {
        const obData = await obRes.json();
        if (obData.success) {
          const total = Object.values(obData.targets ?? {}).reduce(
            (acc: number, agentMonths) => acc + ((agentMonths as Record<string, number>)[monthName] ?? 0), 0
          );
          setTeamObTarget(total as number);
        }
      }
    } catch { /* silent */ }

    // Quotes target
    try {
      const qtRes = await fetch(`/api/manager-agent-quote-target?${params.toString()}`);
      if (qtRes.ok) {
        const qtData = await qtRes.json();
        if (qtData.success) {
          const total = Object.values(qtData.targets ?? {}).reduce(
            (acc: number, agentMonths) => acc + ((agentMonths as Record<string, number>)[monthName] ?? 0), 0
          );
          setTeamQuotesTarget(total as number);
        }
      }
    } catch { /* silent */ }

    // New account target
    try {
      const dateParams = new URLSearchParams({ manager });
      if (dateRange?.from) dateParams.append("from", from);
      if (dateRange?.to)   dateParams.append("to",   to);
      const naRes = await fetch(`/api/manager-new-account-development?${dateParams.toString()}`);
      if (naRes.ok) {
        const naData = await naRes.json();
        if (naData.success) setTeamNewAccountTarget(Number(naData.target) || 0);
      }
    } catch { /* silent */ }

    setLoadingFetch(false);
  }, [manager, dateRange]);

  useEffect(() => { fetchTeamTargets(); }, [fetchTeamTargets]);

  // Resolved values -- self-fetched always wins over props
  const obCallsCount             = selfObCallsCount        ?? obCallsCountProp;
  const obCallsTarget            = teamObTarget            ?? 0;
  const quotesTarget             = teamQuotesTarget        ?? 0;
  const newAccountTarget         = teamNewAccountTarget    ?? propNewAccountTarget ?? 0;
  const callsToQuotesCount       = selfCallsToQuotesCount  ?? callsToQuotesCountProp;
  const quoteToSOQuotationCount  = selfQuoteToSOQuotation  ?? quoteToSOQuotationCountProp;
  const quoteToSOSalesOrderCount = selfQuoteToSOSalesOrder ?? quoteToSOSalesOrderCountProp;
  const soToSISalesOrderCount    = selfSoToSISalesOrder    ?? soToSISalesOrderCountProp;
  const soToSIDeliveredCount     = selfSoToSIDelivered     ?? soToSIDeliveredCountProp;

  // â”€â”€ Computations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const obCallsPercentage = obCallsTarget > 0 ? Math.round((obCallsCount / obCallsTarget) * 100) : 0;
  const obCallsRating = standardRating(obCallsPercentage);

  const quotesPercentage = quotesTarget > 0 ? Math.round((quotesCount / quotesTarget) * 100) : 0;
  const quotesRating = standardRating(quotesPercentage);

  const callsToQuotePercentage = obCallsCount > 0 ? Math.round((callsToQuotesCount / obCallsCount) * 100) : 0;
  const callsToQuoteAchievementPercentage = Math.min(100, Math.round((callsToQuotePercentage / 20) * 100));
  let callsToQuoteRating = 1;
  if (callsToQuotePercentage >= 20) callsToQuoteRating = 5;
  else if (callsToQuotePercentage >= 14.01) callsToQuoteRating = 4;
  else if (callsToQuotePercentage >= 12.01) callsToQuoteRating = 3;
  else if (callsToQuotePercentage >= 10.01) callsToQuoteRating = 2;

  const quoteToSOPercentage = quoteToSOQuotationCount > 0
    ? Math.round((quoteToSOSalesOrderCount / quoteToSOQuotationCount) * 100) : 0;
  const quoteToSOAchievementPercentage = Math.min(100, Math.round((quoteToSOPercentage / 30) * 100));
  let quoteToSORating = 1;
  if (quoteToSOPercentage >= 30) quoteToSORating = 5;
  else if (quoteToSOPercentage >= 25.01) quoteToSORating = 4;
  else if (quoteToSOPercentage >= 20.01) quoteToSORating = 3;
  else if (quoteToSOPercentage >= 15.01) quoteToSORating = 2;

  const soToSIPercentage = soToSISalesOrderCount > 0
    ? Math.round((soToSIDeliveredCount / soToSISalesOrderCount) * 100) : 0;
  const soToSIAchievementPercentage = Math.min(100, Math.round((soToSIPercentage / 70) * 100));
  let soToSIRating = 1;
  if (soToSIPercentage >= 70) soToSIRating = 5;
  else if (soToSIPercentage >= 60.01) soToSIRating = 4;
  else if (soToSIPercentage >= 50.01) soToSIRating = 3;
  else if (soToSIPercentage >= 40.01) soToSIRating = 2;

  const newAccountPercentage = newAccountTarget > 0 ? Math.round((newAccountCount / newAccountTarget) * 100) : 0;
  const newAccountRating = standardRating(newAccountPercentage);

  const chartData = [
    { name: "Calls â†’ Quote", conversion: callsToQuotePercentage, fill: "#3b82f6" },
    { name: "Quote â†’ SO",    conversion: quoteToSOPercentage,    fill: "#10b981" },
    { name: "SO â†’ SI",       conversion: soToSIPercentage,       fill: "#f59e0b" },
  ];
  const chartConfig = { conversion: { label: "Conversion Rate (%)", color: "#3b82f6" } };

  return (
    <>
      <ExplainPanel
        open={explainOpen} onClose={() => setExplainOpen(false)}
        obCallsCount={obCallsCount} obCallsTarget={obCallsTarget}
        obCallsPercentage={obCallsPercentage} obCallsRating={obCallsRating}
        quotesCount={quotesCount} quotesTarget={quotesTarget}
        quotesPercentage={quotesPercentage} quotesRating={quotesRating}
        callsToQuotesCount={callsToQuotesCount} callsToQuotePercentage={callsToQuotePercentage}
        callsToQuoteRating={callsToQuoteRating}
        quoteToSOQuotationCount={quoteToSOQuotationCount} quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
        quoteToSOPercentage={quoteToSOPercentage} quoteToSORating={quoteToSORating}
        soToSISalesOrderCount={soToSISalesOrderCount} soToSIDeliveredCount={soToSIDeliveredCount}
        soToSIPercentage={soToSIPercentage} soToSIRating={soToSIRating}
        newAccountCount={newAccountCount} newAccountTarget={newAccountTarget}
        newAccountPercentage={newAccountPercentage} newAccountRating={newAccountRating}
      />

      <Card className="bg-white z-10 text-black flex flex-col">
        <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
              Sales pipeline â€” conversion metrics
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSettings} className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer" type="button">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => fetchTeamTargets()} disabled={loadingFetch}
                className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-40"
                aria-label="Refresh pipeline data" title="Refresh conversion metrics">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFetch ? "animate-spin" : ""}`} />
              </button>
              <button type="button" onClick={() => setExplainOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-gray-900 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-sm">
                <HelpCircle className="w-3.5 h-3.5" /> Explain
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 w-full">
            {/* OB Calls */}
            <div className="bg-blue-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingObCalls ? <Spinner className="w-6 h-6" /> : obCallsCount}
              </div>
              <div className="text-xs font-medium text-gray-600">OB Calls (Successful)</div>
              <div className="text-xs text-gray-500">
                Target: {loadingObCallsTarget ? "..." : obCallsTarget} · Achievement: {obCallsPercentage}% · Rating: {obCallsRating}
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(obCallsPercentage, 100)}%` }} />
              </div>
            </div>
            {/* Quotes */}
            <div className="bg-green-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingQuotes ? <Spinner className="w-6 h-6" /> : quotesCount}
              </div>
              <div className="text-xs font-medium text-gray-600">Quotes generated</div>
              <div className="text-xs text-gray-500">
                Target: {quotesTarget} · Achievement: {quotesPercentage}% · Rating: {quotesRating}
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(quotesPercentage, 100)}%` }} />
              </div>
            </div>
            {/* Calls â†’ Quote */}
            <div className="bg-yellow-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingCallsToQuotes ? <Spinner className="w-6 h-6" /> : `${callsToQuotesCount} (${callsToQuotePercentage}%)`}
              </div>
              <div className="text-xs font-medium text-gray-600">Calls â†’ Quote</div>
              <div className="text-xs text-gray-500">Target: 20% · Achievement: {callsToQuoteAchievementPercentage}% · Rating: {callsToQuoteRating}</div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${Math.min(callsToQuoteAchievementPercentage, 100)}%` }} />
              </div>
            </div>
            {/* Quote â†’ SO */}
            <div className="bg-orange-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingQuoteToSO ? <Spinner className="w-6 h-6" /> : `${quoteToSOSalesOrderCount} (${quoteToSOPercentage}%)`}
              </div>
              <div className="text-xs font-medium text-gray-600">Quote â†’ SO</div>
              <div className="text-xs text-gray-500">Target: 30% · Achievement: {quoteToSOAchievementPercentage}% · Rating: {quoteToSORating}</div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${Math.min(quoteToSOAchievementPercentage, 100)}%` }} />
              </div>
            </div>
            {/* SO â†’ SI */}
            <div className="bg-red-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingQuoteToSO ? <Spinner className="w-6 h-6" /> : `${soToSIDeliveredCount} (${soToSIPercentage}%)`}
              </div>
              <div className="text-xs font-medium text-gray-600">SO â†’ SI</div>
              <div className="text-xs text-gray-500">Target: 70% · Achievement: {soToSIAchievementPercentage}% · Rating: {soToSIRating}</div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min(soToSIAchievementPercentage, 100)}%` }} />
              </div>
            </div>
            {/* New Account Dev */}
            <div className="bg-purple-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingNewAccount ? <Spinner className="w-6 h-6" /> : newAccountCount}
              </div>
              <div className="text-xs font-medium text-gray-600">New Account Dev.</div>
              <div className="text-xs text-gray-500">
                Target: {newAccountTarget} · Achievement: {newAccountPercentage}% · Rating: {newAccountRating}
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(newAccountPercentage, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="w-full mt-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-4">Conversion Metrics</div>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="conversion" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
