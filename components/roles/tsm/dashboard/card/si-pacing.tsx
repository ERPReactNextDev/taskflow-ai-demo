"use client";

import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SiPacingCardProps {
  /** Monthly SI target for the full team */
  monthlyTarget: number;
  /** Team running SI actual to date */
  siActual: number;
  loading?: boolean;
  /** Override reference date for testing; defaults to today (Manila time) */
  referenceDate?: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number): string {
  const abs  = Math.abs(n);
  const sign = n < 0 ? "-" : n > 0 ? "" : "";
  if (abs >= 1_000_000_000) return `${sign}₱${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)     return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)         return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₱${abs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtSigned(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${fmt(n)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Days in month + days elapsed in Manila time */
function getManilaDateInfo(ref?: Date): { daysInMonth: number; daysElapsed: number; monthLabel: string } {
  const now    = ref ?? new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const year   = manila.getFullYear();
  const month  = manila.getMonth();
  const day    = manila.getDate();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const monthLabel   = manila.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" });
  return { daysInMonth, daysElapsed: day, monthLabel };
}

// ── Feasibility flag ──────────────────────────────────────────────────────────

type FlagLevel = "green" | "yellow" | "red";

function getFeasibilityFlag(currentRunRate: number, catchUpDaily: number): FlagLevel {
  if (catchUpDaily <= 0) return "green"; // already met or exceeded
  if (currentRunRate >= catchUpDaily)              return "green";
  if (currentRunRate >= catchUpDaily * 0.7)        return "yellow";
  return "red";
}

const FLAG_CONFIG: Record<FlagLevel, { label: string; textCls: string; bgCls: string; borderCls: string; icon: string }> = {
  green:  { label: "On Track",     textCls: "text-green-700", bgCls: "bg-green-50",  borderCls: "border-green-200", icon: "✅" },
  yellow: { label: "At Risk",      textCls: "text-amber-700", bgCls: "bg-amber-50",  borderCls: "border-amber-200", icon: "⚠️" },
  red:    { label: "Critical",     textCls: "text-red-700",   bgCls: "bg-red-50",    borderCls: "border-red-200",   icon: "❌" },
};

function FeasibilityBadge({ flag }: { flag: FlagLevel }) {
  const cfg = FLAG_CONFIG[flag];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bgCls} ${cfg.borderCls} ${cfg.textCls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function PacingBadge({ pct }: { pct: number }) {
  const ok   = pct >= 100;
  const warn = pct >= 80;
  const cls  = ok   ? "bg-green-50 text-green-700 border-green-200"
             : warn ? "bg-amber-50 text-amber-700 border-amber-200"
             :        "bg-red-50   text-red-700   border-red-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border ${cls}`}>
      {fmtPct(pct)}
    </span>
  );
}

function gapColor(gap: number): string {
  return gap >= 0 ? "text-green-600" : "text-red-500";
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SiPacingCard: React.FC<SiPacingCardProps> = ({
  monthlyTarget,
  siActual,
  loading = false,
  referenceDate,
}) => {
  const { daysInMonth, daysElapsed, monthLabel } = useMemo(
    () => getManilaDateInfo(referenceDate),
    [referenceDate]
  );

  const remainingDays = daysInMonth - daysElapsed;

  // ── Core pacing calculations ────────────────────────────────────────────────
  const requiredDaily       = monthlyTarget > 0 ? monthlyTarget / daysInMonth : 0;
  const requiredPacingToDate = requiredDaily * daysElapsed;
  const pacingGap           = siActual - requiredPacingToDate;
  const pacingPct           = requiredPacingToDate > 0 ? (siActual / requiredPacingToDate) * 100 : 0;
  const currentRunRate      = daysElapsed > 0 ? siActual / daysElapsed : 0;
  const remainingGap        = monthlyTarget - siActual;
  const catchUpDaily        = remainingDays > 0 ? remainingGap / remainingDays : 0;
  const flag                = getFeasibilityFlag(currentRunRate, catchUpDaily);

  return (
    <Card className="bg-white z-10 text-black flex flex-col border border-gray-100 shadow-sm rounded-xl">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between w-full">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
              {monthLabel} Daily Pacing
            </p>
            <p className="text-[10px] font-black uppercase tracking-tight text-gray-600 mt-0.5">
              SI Pacing Report
            </p>
          </div>
          <span className="text-[9px] font-mono bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-gray-400">
            Day {daysElapsed}/{daysInMonth}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 w-full">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            {/* ── Main: Pacing Gap ── */}
            <div>
              <p className={`text-3xl font-extrabold tabular-nums leading-none ${gapColor(pacingGap)}`}>
                {fmtSigned(pacingGap)}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Pacing Gap vs Required Today</p>
            </div>

            {/* ── Row 1: Required vs Actual ── */}
            <div className="grid grid-cols-2 gap-3 w-full text-xs">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Required Today</p>
                <p className="font-extrabold text-gray-900 tabular-nums text-sm">{fmtCompact(requiredPacingToDate)}</p>
                <p className="text-[9px] text-gray-400 tabular-nums">{fmt(requiredPacingToDate)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Actual Today</p>
                <p className={`font-extrabold tabular-nums text-sm ${gapColor(pacingGap)}`}>{fmtCompact(siActual)}</p>
                <p className="text-[9px] text-gray-400 tabular-nums">{fmt(siActual)}</p>
              </div>
            </div>

            {/* ── Row 2: Pacing % + Days ── */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Pacing %</p>
                <PacingBadge pct={pacingPct} />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Days Left</p>
                <span className="text-xs font-bold text-gray-700 tabular-nums">
                  {remainingDays} day{remainingDays !== 1 ? "s" : ""} remaining
                </span>
              </div>
            </div>

            {/* ── Row 3: Catch-Up Required ── */}
            <div className={`w-full rounded-lg p-3 border ${FLAG_CONFIG[flag].bgCls} ${FLAG_CONFIG[flag].borderCls}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Required Catch-Up / Day
                </p>
                <FeasibilityBadge flag={flag} />
              </div>
              <p className={`text-xl font-extrabold tabular-nums ${FLAG_CONFIG[flag].textCls}`}>
                {catchUpDaily > 0 ? fmt(catchUpDaily) : "Target Met ✅"}
              </p>
              <p className="text-[9px] text-gray-400 mt-1 tabular-nums">
                Current run rate: {fmtCompact(currentRunRate)} / day
                {catchUpDaily > 0 && ` · next ${remainingDays} day${remainingDays !== 1 ? "s" : ""}`}
              </p>
            </div>

          </>
        )}

      </CardContent>
    </Card>
  );
};
