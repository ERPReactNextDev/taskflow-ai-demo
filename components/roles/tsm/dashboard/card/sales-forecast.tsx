"use client";

import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SalesForecastCardProps {
  monthlyTarget: number;
  siActual: number;
  soActual: number;
  loading?: boolean;
  referenceDate?: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}₱${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000)     return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)         return `${sign}₱${(abs / 1_000).toFixed(2)}K`;
  return `${sign}₱${abs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtGap(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmt(n)}`;
}

function getManilaDateInfo(ref?: Date): { daysInMonth: number; daysElapsed: number; monthLabel: string } {
  const now    = ref ?? new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const year   = manila.getFullYear();
  const month  = manila.getMonth();
  const day    = manila.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel  = manila.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" });
  return { daysInMonth, daysElapsed: day, monthLabel };
}

function colorClass(value: number, threshold = 0): string {
  return value >= threshold ? "text-green-600" : "text-red-500";
}

function pctColorClass(value: number): string {
  return value >= 100 ? "text-green-600" : "text-red-500";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PillBadge({ value, threshold = 100 }: { value: number; threshold?: number }) {
  const ok = value >= threshold;
  return (
    <span className={[
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border",
      ok ? "bg-green-50 text-green-700 border-green-200"
         : "bg-red-50 text-red-700 border-red-200",
    ].join(" ")}>
      {fmtPct(value)}
    </span>
  );
}

function GapPill({ gap }: { gap: number }) {
  const ok = gap >= 0;
  return (
    <span className={[
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border",
      ok ? "bg-green-50 text-green-700 border-green-200"
         : "bg-red-50 text-red-700 border-red-200",
    ].join(" ")}>
      {fmtGap(gap)}
    </span>
  );
}

interface ScenarioBarProps {
  label: string;
  multiplier: number;
  combinedActual: number;
  runRate: number;
  remainingDays: number;
  target: number;
  isBase?: boolean;
}

function ScenarioBar({ label, multiplier, combinedActual, runRate, remainingDays, target, isBase }: ScenarioBarProps) {
  const forecast   = combinedActual + runRate * multiplier * remainingDays;
  const overTarget = forecast - target;
  const pct        = target > 0 ? (forecast / target) * 100 : 0;
  const barPct     = Math.min((pct / 120) * 100, 100); // cap bar at 120% of target for visual

  return (
    <div className={`rounded-lg p-3 flex flex-col gap-2 ${isBase ? "bg-gray-900 text-white" : "bg-gray-50 border border-gray-100"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isBase ? "text-gray-300" : "text-gray-500"}`}>
          {label}
          {isBase && <span className="ml-1.5 text-yellow-400">★</span>}
        </span>
        <span className={`text-[10px] font-semibold ${pct >= 100 ? (isBase ? "text-green-400" : "text-green-600") : (isBase ? "text-red-400" : "text-red-500")}`}>
          {fmtPct(pct)}
        </span>
      </div>
      {/* Progress bar */}
      <div className={`w-full h-1.5 rounded-full ${isBase ? "bg-gray-700" : "bg-gray-200"}`}>
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${pct >= 100 ? "bg-green-500" : "bg-red-400"}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className={`text-xs font-black tabular-nums ${isBase ? "text-white" : "text-gray-800"}`}>
            {fmtCompact(forecast)}
          </span>
          <span className={`text-[9px] ${isBase ? "text-gray-400" : "text-gray-400"}`}>total forecast</span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xs font-black tabular-nums ${overTarget >= 0 ? (isBase ? "text-green-400" : "text-green-600") : (isBase ? "text-red-400" : "text-red-500")}`}>
            {overTarget >= 0 ? "+" : ""}{fmtCompact(overTarget)}
          </span>
          <span className={`text-[9px] ${isBase ? "text-gray-400" : "text-gray-400"}`}>
            {overTarget >= 0 ? "over target" : "short of target"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const SalesForecastCard: React.FC<SalesForecastCardProps> = ({
  monthlyTarget,
  siActual,
  soActual,
  loading = false,
  referenceDate,
}) => {
  const { daysInMonth, daysElapsed, monthLabel } = useMemo(
    () => getManilaDateInfo(referenceDate),
    [referenceDate]
  );

  const remainingDays = daysInMonth - daysElapsed;

  // ── PART 1: Basic Forecast ────────────────────────────────────────────────
  const combinedActual  = siActual + soActual;
  const siRunRate       = daysElapsed > 0 ? siActual       / daysElapsed : 0;
  const soRunRate       = daysElapsed > 0 ? soActual       / daysElapsed : 0;
  const combinedRunRate = daysElapsed > 0 ? combinedActual / daysElapsed : 0;

  const siRemaining       = siRunRate       * remainingDays;
  const soRemaining       = soRunRate       * remainingDays;
  const combinedRemaining = combinedRunRate * remainingDays;

  const siForecast       = siActual       + siRemaining;
  const soForecast       = soActual       + soRemaining;
  const combinedForecast = combinedActual + combinedRemaining;

  const combinedPctOfTarget = monthlyTarget > 0 ? (combinedForecast / monthlyTarget) * 100 : 0;
  const baseGap             = combinedForecast - monthlyTarget;

  // ── PART 2: Over-Target Income ────────────────────────────────────────────
  const requiredDaily          = monthlyTarget > 0 ? monthlyTarget / daysInMonth : 0;
  const dailyExcess            = combinedRunRate - requiredDaily;
  const totalOverTarget        = combinedForecast - monthlyTarget;
  const overTargetPct          = monthlyTarget > 0 ? (totalOverTarget / monthlyTarget) * 100 : 0;
  const remainingOverTarget    = dailyExcess * remainingDays;

  return (
    <Card className="bg-white z-10 text-black border border-gray-100 shadow-sm rounded-xl">
      <CardContent className="p-5 flex flex-col gap-5">

        {/* ── Card Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {monthLabel} Running Forecast
            </p>
            <p className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">
              Possible Over-Target Income
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-gray-50 border border-gray-100 rounded-md px-2 py-1 text-[10px] font-mono text-gray-500">
              Day {daysElapsed}/{daysInMonth}
            </span>
            <span className="bg-gray-50 border border-gray-100 rounded-md px-2 py-1 text-[10px] font-mono text-gray-500">
              {remainingDays}d left
            </span>
            <span className="bg-gray-50 border border-gray-100 rounded-md px-2 py-1 text-[10px] font-mono text-gray-500">
              Target {fmtCompact(monthlyTarget)}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* ── LEFT COLUMN: Basic Forecast ── */}
            <div className="flex flex-col gap-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b pb-2">
                Basic Forecast
              </p>

              {/* Combined Forecast — main number */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Combined Forecast (SI + SO)
                </p>
                <p className={`text-3xl font-extrabold tabular-nums leading-none ${pctColorClass(combinedPctOfTarget)}`}>
                  {fmtCompact(combinedForecast)}
                </p>
                <p className="text-xs text-gray-400 mt-1 tabular-nums">{fmt(combinedForecast)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <PillBadge value={combinedPctOfTarget} />
                  <GapPill gap={baseGap} />
                </div>
              </div>

              {/* Progress bar vs target */}
              <div>
                <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                  <span>0</span>
                  <span>Target {fmtCompact(monthlyTarget)}</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${combinedPctOfTarget >= 100 ? "bg-green-500" : "bg-red-400"}`}
                    style={{ width: `${Math.min(combinedPctOfTarget, 100)}%` }}
                  />
                </div>
              </div>

              {/* SI / SO breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50/60 rounded-lg p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700 mb-1">SI Forecast</p>
                  <p className="text-sm font-extrabold text-gray-900 tabular-nums">{fmtCompact(siForecast)}</p>
                  <p className="text-[9px] text-gray-400 tabular-nums mt-0.5">Rate {fmtCompact(siRunRate)}/day</p>
                </div>
                <div className="bg-blue-50/60 rounded-lg p-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-blue-700 mb-1">SO Forecast</p>
                  <p className="text-sm font-extrabold text-gray-900 tabular-nums">{fmtCompact(soForecast)}</p>
                  <p className="text-[9px] text-gray-400 tabular-nums mt-0.5">Rate {fmtCompact(soRunRate)}/day</p>
                </div>
              </div>

              {/* Run rate stats */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Combined Run Rate</p>
                  <p className="font-extrabold text-gray-900 tabular-nums">{fmtCompact(combinedRunRate)}</p>
                  <p className="text-[9px] text-gray-400">per day</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Remaining Projection</p>
                  <p className="font-extrabold text-gray-900 tabular-nums">{fmtCompact(combinedRemaining)}</p>
                  <p className="text-[9px] text-gray-400">in {remainingDays} days</p>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Over-Target Income ── */}
            <div className="flex flex-col gap-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 border-b pb-2">
                Over-Target Income
              </p>

              {/* Main over-target value */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                  Total Sobra sa Target
                </p>
                <p className={`text-3xl font-extrabold tabular-nums leading-none ${colorClass(totalOverTarget)}`}>
                  {totalOverTarget >= 0 ? "+" : ""}{fmtCompact(totalOverTarget)}
                </p>
                <p className={`text-xs tabular-nums mt-1 ${colorClass(totalOverTarget)}`}>
                  {totalOverTarget >= 0 ? "+" : ""}{fmt(totalOverTarget)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={[
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums border",
                    overTargetPct >= 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200",
                  ].join(" ")}>
                    {overTargetPct >= 0 ? "+" : ""}{fmtPct(overTargetPct)} vs target
                  </span>
                </div>
              </div>

              {/* Daily excess + remaining possible */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Daily Excess Rate</p>
                  <p className={`text-sm font-extrabold tabular-nums ${colorClass(dailyExcess)}`}>
                    {dailyExcess >= 0 ? "+" : ""}{fmtCompact(dailyExcess)}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    {dailyExcess >= 0 ? "sobra" : "kulang"} per day vs required {fmtCompact(requiredDaily)}/day
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">Remaining Possible</p>
                  <p className={`text-sm font-extrabold tabular-nums ${colorClass(remainingOverTarget)}`}>
                    {remainingOverTarget >= 0 ? "+" : ""}{fmtCompact(remainingOverTarget)}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    pwede pang kitain sa {remainingDays} days
                  </p>
                </div>
              </div>

              {/* 3-Tier Scenario Bars */}
              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  Possible Income Scenarios
                </p>
                <ScenarioBar
                  label="Conservative (90%)"
                  multiplier={0.9}
                  combinedActual={combinedActual}
                  runRate={combinedRunRate}
                  remainingDays={remainingDays}
                  target={monthlyTarget}
                />
                <ScenarioBar
                  label="Base (100%)"
                  multiplier={1.0}
                  combinedActual={combinedActual}
                  runRate={combinedRunRate}
                  remainingDays={remainingDays}
                  target={monthlyTarget}
                  isBase
                />
                <ScenarioBar
                  label="Aggressive (110%)"
                  multiplier={1.1}
                  combinedActual={combinedActual}
                  runRate={combinedRunRate}
                  remainingDays={remainingDays}
                  target={monthlyTarget}
                />
                <p className="text-[9px] text-gray-400 text-center mt-1">
                  Auto-generated daily based on current sales run rate
                </p>
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
};
