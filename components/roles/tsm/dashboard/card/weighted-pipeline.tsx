"use client";

import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeightedPipelineCardProps {
  /** Monthly SI target */
  monthlyTarget: number;
  /** Running SI actual to date */
  siActual: number;
  /** Running SO actual to date */
  soActual: number;
  /** Calls → Quote count (funnel quotes that entered pipeline) */
  funnelQuotesCount: number;
  /** Quote → SO converted count */
  quoteToSOCount: number;
  /** SO → SI converted (delivered) count */
  soToSICount: number;
  loading?: boolean;
  /** Override for testing; defaults to today Manila time */
  referenceDate?: Date;
}

type CoverageLevel = "safe" | "at_risk" | "shortfall";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number): string {
  const abs  = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}₱${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)     return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)         return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₱${abs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

function getManilaMonthLabel(ref?: Date): string {
  return (ref ?? new Date()).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "Asia/Manila",
  });
}

// ── Badge components ──────────────────────────────────────────────────────────

function CoverageBadge({ ratio }: { ratio: number }) {
  const level: CoverageLevel = ratio >= 150 ? "safe" : ratio >= 100 ? "at_risk" : "shortfall";
  const cfg = {
    safe:      { cls: "bg-green-50 text-green-700 border-green-200" },
    at_risk:   { cls: "bg-amber-50 text-amber-700 border-amber-200" },
    shortfall: { cls: "bg-red-50   text-red-700   border-red-200"   },
  }[level];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border ${cfg.cls}`}>
      {fmtPct(ratio)}
    </span>
  );
}

function StatusBox({ level, remaining, buffer, shortfall, additionalQuotesNeeded, quoteToSORate, soToSIRate }: {
  level: CoverageLevel;
  remaining: number;
  buffer: number;
  shortfall: number;
  additionalQuotesNeeded: number;
  quoteToSORate: number;
  soToSIRate: number;
}) {
  if (level === "safe") return (
    <div className="w-full rounded-lg p-3 border bg-green-50 border-green-200">
      <p className="text-xs font-black text-green-700">✅ Pipeline Safe</p>
      <p className="text-sm font-extrabold text-green-700 tabular-nums mt-0.5">
        Buffer: +{fmtCompact(buffer)}
      </p>
      <p className="text-[9px] text-green-600 mt-0.5">
        Existing pipeline can cover the remaining gap with room to spare.
      </p>
    </div>
  );

  if (level === "at_risk") return (
    <div className="w-full rounded-lg p-3 border bg-amber-50 border-amber-200">
      <p className="text-xs font-black text-amber-700">⚠️ AT RISK — No Room for Error</p>
      <p className="text-[9px] text-amber-600 mt-1">
        Maintain {fmtPct(quoteToSORate)} Quote→SO · {fmtPct(soToSIRate)} SO→SI rates to close the gap.
      </p>
    </div>
  );

  return (
    <div className="w-full rounded-lg p-3 border bg-red-50 border-red-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black text-red-700">🔴 Pipeline Shortfall</p>
        <span className="text-xs font-extrabold text-red-700 tabular-nums shrink-0">{fmtCompact(shortfall)}</span>
      </div>
      <p className="text-xl font-extrabold text-red-700 tabular-nums mt-1.5">
        Need +{additionalQuotesNeeded.toLocaleString()} Additional Quotes
      </p>
      <p className="text-[9px] text-red-500 mt-0.5">
        Generate more quotes immediately to cover the pipeline shortfall.
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const WeightedPipelineCard: React.FC<WeightedPipelineCardProps> = ({
  monthlyTarget,
  siActual,
  soActual,
  funnelQuotesCount,
  quoteToSOCount,
  soToSICount,
  loading = false,
  referenceDate,
}) => {
  const monthLabel = getManilaMonthLabel(referenceDate);

  const computed = useMemo(() => {
    // ── PART 1: Historical conversion rates + avg deal sizes ──────────────────
    const quoteToSORate   = funnelQuotesCount > 0 ? (quoteToSOCount / funnelQuotesCount) : 0;   // decimal
    const soToSIRate      = quoteToSOCount    > 0 ? (soToSICount    / quoteToSOCount)    : 0;   // decimal
    const endToEndRate    = quoteToSORate * soToSIRate;                                           // decimal

    const avgSIDealSize   = soToSICount   > 0 ? siActual / soToSICount   : 0;
    const avgSODealSize   = quoteToSOCount > 0 ? soActual / quoteToSOCount : 0;

    // ── PART 2: Open pipeline inventory ──────────────────────────────────────
    const openSO     = quoteToSOCount - soToSICount;       // approved SO not yet SI
    const openQuotes = funnelQuotesCount - quoteToSOCount; // funnel quotes not yet SO

    // ── PART 3: Weighted pipeline value ──────────────────────────────────────
    const expectedFromSO     = openSO     * soToSIRate    * avgSIDealSize;
    const expectedFromQuotes = openQuotes * quoteToSORate * soToSIRate * avgSIDealSize;
    const totalWeighted      = expectedFromSO + expectedFromQuotes;

    // ── PART 4: Gap analysis ──────────────────────────────────────────────────
    const remainingGap    = Math.max(0, monthlyTarget - siActual);
    const coverageRatio   = remainingGap > 0 ? (totalWeighted / remainingGap) * 100 : 999;
    const buffer          = totalWeighted - remainingGap;
    const shortfall       = remainingGap - totalWeighted;
    const level: CoverageLevel = coverageRatio >= 150 ? "safe" : coverageRatio >= 100 ? "at_risk" : "shortfall";

    // Additional quotes needed (round up)
    const additionalQuotesNeeded = level === "shortfall" && endToEndRate > 0 && avgSIDealSize > 0
      ? Math.ceil((shortfall / avgSIDealSize) / endToEndRate)
      : 0;

    return {
      quoteToSORate: quoteToSORate * 100,  // as percent for display
      soToSIRate:    soToSIRate    * 100,
      endToEndRate:  endToEndRate  * 100,
      avgSIDealSize,
      avgSODealSize,
      openSO,
      openQuotes,
      expectedFromSO,
      expectedFromQuotes,
      totalWeighted,
      remainingGap,
      coverageRatio,
      buffer,
      shortfall,
      level,
      additionalQuotesNeeded,
    };
  }, [monthlyTarget, siActual, soActual, funnelQuotesCount, quoteToSOCount, soToSICount]);

  const coverageColor = computed.level === "safe"     ? "text-green-600"
                      : computed.level === "at_risk"  ? "text-amber-600"
                      :                                 "text-red-500";

  return (
    <Card className="bg-white z-10 text-black flex flex-col border border-gray-100 shadow-sm rounded-xl">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between w-full">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
              {monthLabel} Pipeline
            </p>
            <p className="text-[10px] font-black uppercase tracking-tight text-gray-600 mt-0.5">
              Weighted Pipeline Value
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 w-full">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            {/* ── Main: Total Weighted Pipeline ── */}
            <div>
              <p className={`text-3xl font-extrabold tabular-nums leading-none ${coverageColor}`}>
                {fmtCompact(computed.totalWeighted)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Expected SI from Existing Pipeline</p>
            </div>

            {/* ── Row 1: Remaining Gap + Coverage ── */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Remaining Gap</p>
                <p className="text-sm font-extrabold text-gray-900 tabular-nums">{fmtCompact(computed.remainingGap)}</p>
                <p className="text-[9px] text-gray-400 tabular-nums">{fmt(computed.remainingGap)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Coverage</p>
                <CoverageBadge ratio={computed.coverageRatio} />
                <p className="text-[9px] text-gray-400 mt-1">of remaining gap</p>
              </div>
            </div>

            {/* ── Row 2: Pipeline Breakdown ── */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-blue-50/60 rounded-lg p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-700 mb-1">
                  From Open SO
                </p>
                <p className="text-sm font-extrabold text-gray-900 tabular-nums">
                  {fmtCompact(computed.expectedFromSO)}
                </p>
                <p className="text-[9px] text-gray-400">
                  {computed.openSO} open SO · {fmtPct(computed.soToSIRate, 0)} chance
                </p>
              </div>
              <div className="bg-violet-50/60 rounded-lg p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-violet-700 mb-1">
                  From Open Quotes
                </p>
                <p className="text-sm font-extrabold text-gray-900 tabular-nums">
                  {fmtCompact(computed.expectedFromQuotes)}
                </p>
                <p className="text-[9px] text-gray-400">
                  {computed.openQuotes} open · {fmtPct(computed.endToEndRate, 0)} chance
                </p>
              </div>
            </div>

            {/* ── Row 3: Status Box ── */}
            <StatusBox
              level={computed.level}
              remaining={computed.remainingGap}
              buffer={computed.buffer}
              shortfall={computed.shortfall}
              additionalQuotesNeeded={computed.additionalQuotesNeeded}
              quoteToSORate={computed.quoteToSORate}
              soToSIRate={computed.soToSIRate}
            />
          </>
        )}

      </CardContent>
    </Card>
  );
};
