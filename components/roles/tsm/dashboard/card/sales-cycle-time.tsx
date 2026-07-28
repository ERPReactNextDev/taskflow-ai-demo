"use client";

import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SalesCycleTimeCardProps {
  /** Total OB Calls count */
  obCallsCount: number;
  /** Calls→Quote funnel count */
  funnelQuotes: number;
  /** Quote→SO converted count */
  quoteToSOCount: number;
  /** SO→SI delivered count */
  soToSICount: number;
  loading?: boolean;
  referenceDate?: Date;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getManilaDateInfo(ref?: Date): { daysElapsed: number } {
  const now    = ref ?? new Date();
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  return { daysElapsed: manila.getDate() };
}

function cycleDays(daysElapsed: number, openInventory: number, completed: number): number | null {
  if (completed <= 0) return null;
  return (daysElapsed * openInventory) / completed;
}

type CycleLevel = "fast" | "avg" | "slow";

function cycleLevel(days: number | null, teamAvg: number | null): CycleLevel {
  if (days === null || teamAvg === null) return "avg";
  if (days <= teamAvg * 0.9) return "fast";
  if (days <= teamAvg * 1.1) return "avg";
  return "slow";
}

const CYCLE_CFG: Record<CycleLevel, { cls: string }> = {
  fast: { cls: "text-green-600" },
  avg:  { cls: "text-amber-600" },
  slow: { cls: "text-red-500"   },
};

function fmtDays(d: number | null): string {
  if (d === null) return "N/A";
  return `${d.toFixed(1)}d`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SalesCycleTimeCard: React.FC<SalesCycleTimeCardProps> = ({
  obCallsCount,
  funnelQuotes,
  quoteToSOCount,
  soToSICount,
  loading = false,
  referenceDate,
}) => {
  const { daysElapsed } = useMemo(() => getManilaDateInfo(referenceDate), [referenceDate]);

  const { c2qDays, q2soDays, so2siDays, totalDays } = useMemo(() => {
    const openPreQuote = Math.max(0, obCallsCount - funnelQuotes);
    const openQuotes   = Math.max(0, funnelQuotes - quoteToSOCount);
    const openSO       = Math.max(0, quoteToSOCount - soToSICount);

    const c2q   = cycleDays(daysElapsed, openPreQuote, funnelQuotes);
    const q2so  = cycleDays(daysElapsed, openQuotes,   quoteToSOCount);
    const so2si = cycleDays(daysElapsed, openSO,       soToSICount);
    const total = (c2q ?? 0) + (q2so ?? 0) + (so2si ?? 0);

    return { c2qDays: c2q, q2soDays: q2so, so2siDays: so2si, totalDays: total };
  }, [obCallsCount, funnelQuotes, quoteToSOCount, soToSICount, daysElapsed]);

  const rows = [
    { label: "Calls → Quote", days: c2qDays,   level: cycleLevel(c2qDays,   c2qDays) },
    { label: "Quote → SO",    days: q2soDays,  level: cycleLevel(q2soDays,  q2soDays) },
    { label: "SO → SI",       days: so2siDays, level: cycleLevel(so2siDays, so2siDays) },
  ];

  return (
    <Card className="bg-white z-10 text-black flex flex-col border border-gray-100 shadow-sm rounded-xl">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">

        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">
            Funnel Velocity
          </p>
          <p className="text-[10px] font-black uppercase tracking-tight text-gray-600 mt-0.5">
            Avg Sales Cycle Time
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 w-full">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            <p className="text-3xl font-extrabold tabular-nums text-gray-900 leading-none">
              {fmtDays(totalDays)}
            </p>
            <p className="text-[9px] text-gray-400">total end-to-end</p>

            <div className="flex flex-col gap-1.5 w-full mt-1">
              {rows.map(({ label, days, level }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-500">{label}</span>
                  <span className={`text-[10px] font-bold tabular-nums ${CYCLE_CFG[level].cls}`}>
                    {fmtDays(days)}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-gray-400 mt-1 leading-tight">
              Call today → becomes SI ~{Math.round(totalDays)} days later
            </p>
          </>
        )}

      </CardContent>
    </Card>
  );
};
