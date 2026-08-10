"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, Settings } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutboundTouchbaseCountCardProps {
  /** TSM ReferenceID — used to self-fetch the team monthly OB target */
  referenceid?: string;
  /** Actual OB call count for the period (passed from parent) */
  count?: number;
  loading?: boolean;
  userId?: string;
  /** Optional date range to derive which month's target to show */
  dateRange?: { from?: Date; to?: Date };
  // Legacy props kept for backward compat — ignored in favour of self-fetch
  target?: number;
  loadingTarget?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function currentMonthName(): string {
  return [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ][new Date().getMonth()];
}

// ── Component ─────────────────────────────────────────────────────────────────

export const OutboundTouchbaseCountCard: React.FC<OutboundTouchbaseCountCardProps> = ({
  referenceid,
  count = 0,
  loading = false,
  userId = "",
  dateRange,
}) => {
  const router = useRouter();

  // Self-fetched team total target
  const [teamTarget,        setTeamTarget]        = useState<number>(0);
  const [loadingTeamTarget, setLoadingTeamTarget] = useState(false);

  // Successful / Unsuccessful counts
  const [successfulCount,   setSuccessfulCount]   = useState<number>(0);
  const [unsuccessfulCount, setUnsuccessfulCount] = useState<number>(0);
  const [loadingBreakdown,  setLoadingBreakdown]  = useState(false);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTeamTarget = useCallback(async () => {
    if (!referenceid) return;
    setLoadingTeamTarget(true);
    try {
      // Derive year from the date range (or current year)
      const refDate = dateRange?.from ?? new Date();
      const year = refDate.getFullYear().toString();

      const params = new URLSearchParams({ tsm: referenceid, year });
      const res    = await fetch(`/api/tsm-agent-ob-target?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        // Build the set of months covered by the date range
        const fromDate = dateRange?.from ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const toDate   = dateRange?.to   ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        const MONTH_NAMES = [
          "January","February","March","April","May","June",
          "July","August","September","October","November","December",
        ];

        // Collect all month names between from and to
        const coveredMonths = new Set<string>();
        const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
        while (cur <= toDate) {
          coveredMonths.add(MONTH_NAMES[cur.getMonth()]);
          cur.setMonth(cur.getMonth() + 1);
        }

        // Sum each agent's target across all covered months
        const total = Object.values(data.targets ?? {}).reduce(
          (acc: number, agentMonths) => {
            const monthsTotal = Array.from(coveredMonths).reduce((mAcc, month) => {
              const monthVal = (agentMonths as Record<string, number>)[month] ?? 0;
              return mAcc + (Number(monthVal) || 0);
            }, 0);
            return acc + monthsTotal;
          },
          0
        );
        setTeamTarget(total as number);
      }
    } catch (err) {
      console.error("OutboundTouchbaseCountCard: failed to fetch team OB target", err);
    } finally {
      setLoadingTeamTarget(false);
    }
  }, [referenceid, dateRange]);

  const fetchBreakdown = useCallback(async () => {
    if (!referenceid) return;
    setLoadingBreakdown(true);
    try {
      const from = dateRange?.from ? toDateStr(dateRange.from) : toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const to   = dateRange?.to   ? toDateStr(dateRange.to)   : toDateStr(new Date());

      // Use tsm-agent-outbound-history to get all history rows with call_status
      const res = await fetch(`/api/tsm-agent-outbound-history?tsm=${encodeURIComponent(referenceid)}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        const history = data.history ?? [];
        // Count Outbound - Touchbase rows only
        let successful = 0;
        let unsuccessful = 0;
        for (const row of history) {
          if (row.source === "Outbound - Touchbase") {
            if (row.call_status === "Successful") successful++;
            else unsuccessful++;
          }
        }
        setSuccessfulCount(successful);
        setUnsuccessfulCount(unsuccessful);
      }
    } catch (err) {
      console.error("OutboundTouchbaseCountCard: failed to fetch breakdown", err);
    } finally {
      setLoadingBreakdown(false);
    }
  }, [referenceid, dateRange]);

  useEffect(() => { fetchTeamTarget(); }, [fetchTeamTarget]);
  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([fetchTeamTarget(), fetchBreakdown()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, fetchTeamTarget, fetchBreakdown]);

  const totalCalls = successfulCount + unsuccessfulCount;
  const percentage = teamTarget > 0 ? Math.round((successfulCount / teamTarget) * 100) : 0;

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(window.location.search);
    const id = userId || params.get("id") || "";
    router.push(`/roles/tsm/ob-breakdown${id ? `?id=${encodeURIComponent(id)}` : ""}`);
  };

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">

        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            OB Calls (Successful)
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Refresh OB calls data"
              title="Refresh data"
              type="button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleSettings}
              className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
              aria-label="OB calls breakdown"
              title="View OB calls breakdown &amp; manage team targets"
              type="button"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main count — Successful only */}
        <div className="text-4xl font-extrabold text-gray-900">
          {loading || loadingBreakdown ? <Spinner className="w-8 h-8" /> : successfulCount}
        </div>

        {/* Breakdown: Successful / Unsuccessful */}
        {!loading && !loadingBreakdown && totalCalls > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">✗ Unsuccessful</span>
              <span className="text-sm font-bold text-red-500">{unsuccessfulCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Total (incl. unsuccessful)</span>
              <span className="text-sm font-bold text-gray-400">{totalCalls}</span>
            </div>
          </div>
        )}

        {/* Achievement pill */}
        <div className="flex items-center gap-2">
          {loadingTeamTarget ? (
            <span className="px-3 py-1 bg-gray-50 text-gray-400 text-xs rounded-full">
              Loading target…
            </span>
          ) : teamTarget > 0 ? (
            <span
              className={[
                "px-3 py-1 text-sm font-medium rounded-full",
                percentage >= 100
                  ? "bg-green-50 text-green-600"
                  : percentage >= 70
                    ? "bg-blue-50 text-blue-600"
                    : "bg-amber-50 text-amber-600",
              ].join(" ")}
            >
              {percentage}% of {teamTarget}
            </span>
          ) : (
            <span className="px-3 py-1 bg-gray-50 text-gray-400 text-xs rounded-full">
              No team target set
            </span>
          )}
        </div>

        {/* Sub-label */}
        {teamTarget > 0 && (
          <p className="text-[10px] text-gray-400 leading-tight">
            Team target · {dateRange?.from
              ? dateRange.from.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" })
              : currentMonthName()}
            {dateRange?.to && dateRange.from &&
              dateRange.to.getMonth() !== dateRange.from.getMonth()
                ? ` – ${dateRange.to.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Manila" })}`
                : ""}
          </p>
        )}

      </CardContent>
    </Card>
  );
};

export default OutboundTouchbaseCountCard;
