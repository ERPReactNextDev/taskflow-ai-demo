"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { HelpCircle, X, ChevronRight } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminSalesPipelineCardProps {
  obCallsCount?: number;
  loadingObCalls?: boolean;
  quotesCount?: number;
  loadingQuotes?: boolean;
  callsToQuotesCount?: number;
  quoteToSOQuotationCount?: number;
  quoteToSOSalesOrderCount?: number;
  soToSISalesOrderCount?: number;
  soToSIDeliveredCount?: number;
  loadingPipeline?: boolean;
}

// ── Rating helpers ────────────────────────────────────────────────────────────

function standardRating(pct: number) {
  if (pct>=91) return 5; if (pct>=81) return 4; if (pct>=61) return 3; if (pct>=50) return 2; return 1;
}

const RATING_TABLE = [
  { range:"≥ 91%",    rating:5, color:"text-green-700 bg-green-50" },
  { range:"81–90%",   rating:4, color:"text-blue-700 bg-blue-50" },
  { range:"61–80%",   rating:3, color:"text-yellow-700 bg-yellow-50" },
  { range:"50–60%",   rating:2, color:"text-orange-700 bg-orange-50" },
  { range:"< 50%",    rating:1, color:"text-red-700 bg-red-50" },
];
const C2Q_TABLE  = [
  { range:"≥ 20%",        rating:5, color:"text-green-700 bg-green-50" },
  { range:"14.01–19.99%", rating:4, color:"text-blue-700 bg-blue-50" },
  { range:"12.01–14%",    rating:3, color:"text-yellow-700 bg-yellow-50" },
  { range:"10.01–12%",    rating:2, color:"text-orange-700 bg-orange-50" },
  { range:"< 10%",        rating:1, color:"text-red-700 bg-red-50" },
];
const Q2SO_TABLE = [
  { range:"≥ 30%",        rating:5, color:"text-green-700 bg-green-50" },
  { range:"25.01–29.99%", rating:4, color:"text-blue-700 bg-blue-50" },
  { range:"20.01–25%",    rating:3, color:"text-yellow-700 bg-yellow-50" },
  { range:"15.01–20%",    rating:2, color:"text-orange-700 bg-orange-50" },
  { range:"< 15%",        rating:1, color:"text-red-700 bg-red-50" },
];
const S2SI_TABLE = [
  { range:"≥ 70%",        rating:5, color:"text-green-700 bg-green-50" },
  { range:"60.01–69.99%", rating:4, color:"text-blue-700 bg-blue-50" },
  { range:"50.01–60%",    rating:3, color:"text-yellow-700 bg-yellow-50" },
  { range:"40.01–50%",    rating:2, color:"text-orange-700 bg-orange-50" },
  { range:"< 40%",        rating:1, color:"text-red-700 bg-red-50" },
];

// ── Helper sub-components ─────────────────────────────────────────────────────

function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest ${color}`}>
      <span>{icon}</span><span>{title}</span>
    </div>
  );
}
function FormulaRow({ label, formula, result, highlight=false }: { label:string; formula:string; result:string|number; highlight?:boolean }) {
  return (
    <div className={`grid grid-cols-[140px_1fr_80px] gap-2 items-center px-3 py-1.5 rounded text-[11px] ${highlight?"bg-gray-900 text-white":"bg-gray-50"}`}>
      <span className={`font-bold ${highlight?"text-gray-300":"text-gray-500"} uppercase tracking-wide`}>{label}</span>
      <span className={`font-mono ${highlight?"text-yellow-300":"text-gray-700"}`}>{formula}</span>
      <span className={`font-black text-right ${highlight?"text-white":"text-gray-900"}`}>{result}</span>
    </div>
  );
}
function RatingTable({ rows }: { rows:{range:string;rating:number;color:string}[] }) {
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

// ── Explain panel ─────────────────────────────────────────────────────────────

function ExplainPanel({ open, onClose, obCallsCount, quotesCount, callsToQuotesCount,
  callsToQuotePercentage, callsToQuoteRating, quoteToSOQuotationCount, quoteToSOSalesOrderCount,
  quoteToSOPercentage, quoteToSORating, soToSISalesOrderCount, soToSIDeliveredCount,
  soToSIPercentage, soToSIRating }: {
  open:boolean; onClose:()=>void; obCallsCount:number; quotesCount:number;
  callsToQuotesCount:number; callsToQuotePercentage:number; callsToQuoteRating:number;
  quoteToSOQuotationCount:number; quoteToSOSalesOrderCount:number;
  quoteToSOPercentage:number; quoteToSORating:number;
  soToSISalesOrderCount:number; soToSIDeliveredCount:number;
  soToSIPercentage:number; soToSIRating:number;
}) {
  const [expanded, setExpanded] = useState<string|null>("c2q");
  const toggle = (k:string) => setExpanded(p => p===k ? null : k);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex justify-end" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-900 text-white shrink-0">
          <div>
            <p className="font-black text-sm uppercase tracking-widest">Computation Guide</p>
            <p className="text-[10px] text-gray-400 mt-0.5">System-wide pipeline breakdown</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Quotes */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={()=>toggle("quotes")} className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100">
              <SectionHeader icon="📄" title="Quotes Generated" color="bg-transparent text-green-800" />
              <ChevronRight className={`w-4 h-4 text-green-500 transition-transform ${expanded==="quotes"?"rotate-90":""}`} />
            </button>
            {expanded==="quotes" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Unique Quotes" formula="Unique quotation_number values" result={quotesCount} />
              </div>
            )}
          </div>
          {/* Calls → Quote */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={()=>toggle("c2q")} className="w-full flex items-center justify-between px-4 py-3 bg-yellow-50 hover:bg-yellow-100">
              <SectionHeader icon="🔄" title="Calls → Quote Conversion" color="bg-transparent text-yellow-800" />
              <ChevronRight className={`w-4 h-4 text-yellow-500 transition-transform ${expanded==="c2q"?"rotate-90":""}`} />
            </button>
            {expanded==="c2q" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Activities w/ Quote" formula="OB + Quotation" result={callsToQuotesCount} />
                <FormulaRow label="Total OB Calls"       formula="Outbound - Touchbase" result={obCallsCount} />
                <FormulaRow label="Conversion %"         formula={`(${callsToQuotesCount} ÷ ${obCallsCount}) × 100`} result={`${callsToQuotePercentage}%`} />
                <FormulaRow label="Target"               formula="Fixed: 20%" result="20%" />
                <FormulaRow label="Rating"               formula="Batay sa conversion %" result={callsToQuoteRating} highlight />
                <RatingTable rows={C2Q_TABLE} />
              </div>
            )}
          </div>
          {/* Quote → SO */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={()=>toggle("q2so")} className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 hover:bg-orange-100">
              <SectionHeader icon="📦" title="Quote → SO Conversion" color="bg-transparent text-orange-800" />
              <ChevronRight className={`w-4 h-4 text-orange-500 transition-transform ${expanded==="q2so"?"rotate-90":""}`} />
            </button>
            {expanded==="q2so" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Activities w/ SO"     formula="OB + Quote + SO" result={quoteToSOSalesOrderCount} />
                <FormulaRow label="Activities w/ Quote"  formula="OB + Quotation"  result={quoteToSOQuotationCount} />
                <FormulaRow label="Conversion %"         formula={`(${quoteToSOSalesOrderCount} ÷ ${quoteToSOQuotationCount}) × 100`} result={`${quoteToSOPercentage}%`} />
                <FormulaRow label="Target"               formula="Fixed: 30%" result="30%" />
                <FormulaRow label="Rating"               formula="Batay sa conversion %" result={quoteToSORating} highlight />
                <RatingTable rows={Q2SO_TABLE} />
              </div>
            )}
          </div>
          {/* SO → SI */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={()=>toggle("s2si")} className="w-full flex items-center justify-between px-4 py-3 bg-red-50 hover:bg-red-100">
              <SectionHeader icon="✅" title="SO → SI Conversion" color="bg-transparent text-red-800" />
              <ChevronRight className={`w-4 h-4 text-red-500 transition-transform ${expanded==="s2si"?"rotate-90":""}`} />
            </button>
            {expanded==="s2si" && (
              <div className="px-3 py-3 space-y-1.5 bg-white">
                <FormulaRow label="Delivered / SI"  formula="OB + Quote + SO + Delivered" result={soToSIDeliveredCount} />
                <FormulaRow label="Activities w/ SO" formula="OB + Quote + SO" result={soToSISalesOrderCount} />
                <FormulaRow label="Conversion %"    formula={`(${soToSIDeliveredCount} ÷ ${soToSISalesOrderCount}) × 100`} result={`${soToSIPercentage}%`} />
                <FormulaRow label="Target"          formula="Fixed: 70%" result="70%" />
                <FormulaRow label="Rating"          formula="Batay sa conversion %" result={soToSIRating} highlight />
                <RatingTable rows={S2SI_TABLE} />
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 px-5 py-3 border-t bg-gray-50 text-[10px] text-gray-400 text-center">
          System-wide · all active TSAs
        </div>
      </div>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export const AdminSalesPipelineCard: React.FC<AdminSalesPipelineCardProps> = ({
  obCallsCount = 0, loadingObCalls = false,
  quotesCount = 0,  loadingQuotes = false,
  callsToQuotesCount = 0,
  quoteToSOQuotationCount = 0, quoteToSOSalesOrderCount = 0,
  soToSISalesOrderCount = 0,   soToSIDeliveredCount = 0,
  loadingPipeline = false,
}) => {
  const [explainOpen, setExplainOpen] = useState(false);

  // Conversion percentages
  const c2qPct   = obCallsCount > 0              ? Math.round((callsToQuotesCount / obCallsCount) * 100)             : 0;
  const q2soPct  = quoteToSOQuotationCount > 0   ? Math.round((quoteToSOSalesOrderCount / quoteToSOQuotationCount) * 100) : 0;
  const s2siPct  = soToSISalesOrderCount > 0     ? Math.round((soToSIDeliveredCount / soToSISalesOrderCount) * 100)  : 0;

  // Achievement vs fixed targets
  const c2qAchieve  = Math.min(100, Math.round((c2qPct  / 20) * 100));
  const q2soAchieve = Math.min(100, Math.round((q2soPct / 30) * 100));
  const s2siAchieve = Math.min(100, Math.round((s2siPct / 70) * 100));

  // Ratings
  let c2qRating = 1;
  if (c2qPct>=20) c2qRating=5; else if (c2qPct>=14.01) c2qRating=4; else if (c2qPct>=12.01) c2qRating=3; else if (c2qPct>=10.01) c2qRating=2;
  let q2soRating = 1;
  if (q2soPct>=30) q2soRating=5; else if (q2soPct>=25.01) q2soRating=4; else if (q2soPct>=20.01) q2soRating=3; else if (q2soPct>=15.01) q2soRating=2;
  let s2siRating = 1;
  if (s2siPct>=70) s2siRating=5; else if (s2siPct>=60.01) s2siRating=4; else if (s2siPct>=50.01) s2siRating=3; else if (s2siPct>=40.01) s2siRating=2;

  const chartData = [
    { name:"Calls → Quote", conversion:c2qPct,  fill:"#3b82f6" },
    { name:"Quote → SO",    conversion:q2soPct, fill:"#10b981" },
    { name:"SO → SI",       conversion:s2siPct, fill:"#f59e0b" },
  ];
  const chartConfig = { conversion:{ label:"Conversion Rate (%)", color:"#3b82f6" } };

  const loading = loadingObCalls || loadingQuotes || loadingPipeline;

  return (
    <>
      <ExplainPanel
        open={explainOpen} onClose={() => setExplainOpen(false)}
        obCallsCount={obCallsCount} quotesCount={quotesCount}
        callsToQuotesCount={callsToQuotesCount} callsToQuotePercentage={c2qPct} callsToQuoteRating={c2qRating}
        quoteToSOQuotationCount={quoteToSOQuotationCount} quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
        quoteToSOPercentage={q2soPct} quoteToSORating={q2soRating}
        soToSISalesOrderCount={soToSISalesOrderCount} soToSIDeliveredCount={soToSIDeliveredCount}
        soToSIPercentage={s2siPct} soToSIRating={s2siRating}
      />

      <Card className="bg-white z-10 text-black flex flex-col">
        <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
              Sales Pipeline — Conversion Metrics (System-wide)
            </div>
            <button type="button" onClick={() => setExplainOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-gray-900 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-sm">
              <HelpCircle className="w-3.5 h-3.5" /> Explain
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 w-full">
            {/* OB Calls */}
            <div className="bg-blue-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingObCalls ? <Spinner className="w-6 h-6" /> : obCallsCount.toLocaleString()}
              </div>
              <div className="text-xs font-medium text-gray-600">OB Calls</div>
              <div className="text-[10px] text-gray-400">System-wide total</div>
            </div>
            {/* Quotes */}
            <div className="bg-green-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingQuotes ? <Spinner className="w-6 h-6" /> : quotesCount.toLocaleString()}
              </div>
              <div className="text-xs font-medium text-gray-600">Quotes Generated</div>
              <div className="text-[10px] text-gray-400">Unique quotations</div>
            </div>
            {/* Calls → Quote */}
            <div className="bg-yellow-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingPipeline ? <Spinner className="w-6 h-6" /> : `${c2qPct}%`}
              </div>
              <div className="text-xs font-medium text-gray-600">Calls → Quote</div>
              <div className="text-[10px] text-gray-400">Target: 20% · Rating: {c2qRating}</div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width:`${c2qAchieve}%` }} />
              </div>
            </div>
            {/* Quote → SO */}
            <div className="bg-orange-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingPipeline ? <Spinner className="w-6 h-6" /> : `${q2soPct}%`}
              </div>
              <div className="text-xs font-medium text-gray-600">Quote → SO</div>
              <div className="text-[10px] text-gray-400">Target: 30% · Rating: {q2soRating}</div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width:`${q2soAchieve}%` }} />
              </div>
            </div>
            {/* SO → SI */}
            <div className="bg-red-50 p-4 rounded-lg flex flex-col items-center gap-2">
              <div className="text-3xl font-extrabold text-gray-900">
                {loadingPipeline ? <Spinner className="w-6 h-6" /> : `${s2siPct}%`}
              </div>
              <div className="text-xs font-medium text-gray-600">SO → SI</div>
              <div className="text-[10px] text-gray-400">Target: 70% · Rating: {s2siRating}</div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div className="bg-red-500 h-2 rounded-full" style={{ width:`${s2siAchieve}%` }} />
              </div>
            </div>
          </div>

          {/* Chart */}
          {!loading && (
            <div className="w-full mt-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-gray-600 mb-4">Conversion Metrics</div>
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize:12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="conversion" radius={[4,4,0,0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};
