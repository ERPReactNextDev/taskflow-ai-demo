"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

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
  return d.toISOString().slice(0, 10);
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

  const fetchTeamTarget = useCallback(async () => {
    if (!referenceid) return;
    setLoadingTeamTarget(true);
    try {
      // Derive the month/year from the date range (or current month/year)
      const refDate = dateRange?.from ?? new Date();
      const monthName = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
      ][refDate.getMonth()];
      const year = refDate.getFullYear().toString();

      // API returns { targets: { [referenceid]: { [month]: number } } }
      // Pass only tsm + year — then filter to the correct month client-side
      const params = new URLSearchParams({ tsm: referenceid, year });
      const res    = await fetch(`/api/tsm-agent-ob-target?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        // Sum each agent's target for the target month only
        const total = Object.values(data.targets ?? {}).reduce(
          (acc: number, agentMonths) => {
            const monthVal = (agentMonths as Record<string, number>)[monthName] ?? 0;
            return acc + (Number(monthVal) || 0);
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

  useEffect(() => { fetchTeamTarget(); }, [fetchTeamTarget]);

  const percentage = teamTarget > 0 ? Math.round((count / teamTarget) * 100) : 0;

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
            Total OB Calls
          </div>
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

        {/* Actual count */}
        <div className="text-4xl font-extrabold text-gray-900">
          {loading ? <Spinner className="w-8 h-8" /> : count}
        </div>

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
            Team monthly target · {currentMonthName()}
          </p>
        )}

      </CardContent>
    </Card>
  );
};

export default OutboundTouchbaseCountCard;
