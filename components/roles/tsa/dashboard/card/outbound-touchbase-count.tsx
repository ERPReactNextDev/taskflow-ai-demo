"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutboundTouchbaseCountCardProps {
  referenceid?: string;
  /** Kept for backward compat but ignored — card self-fetches breakdown */
  count?: number;
  target?: number;
  loading?: boolean;
  loadingTarget?: boolean;
  dateRange?: { from?: Date; to?: Date };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const OutboundTouchbaseCountCard: React.FC<OutboundTouchbaseCountCardProps> = ({
  referenceid,
  target = 0,
  loadingTarget = false,
  dateRange,
}) => {
  const [successfulCount,   setSuccessfulCount]   = useState<number>(0);
  const [unsuccessfulCount, setUnsuccessfulCount] = useState<number>(0);
  const [loadingBreakdown,  setLoadingBreakdown]  = useState(false);

  const fetchBreakdown = useCallback(async () => {
    if (!referenceid) return;
    setLoadingBreakdown(true);
    try {
      const now  = new Date();
      const from = dateRange?.from
        ? toDateStr(dateRange.from)
        : toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      const to   = dateRange?.to ? toDateStr(dateRange.to) : toDateStr(now);

      const params = new URLSearchParams({ referenceid, from, to });
      const res    = await fetch(`/api/history-outbound?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // history-outbound now returns { count, successful, unsuccessful }
      setSuccessfulCount(Number(data.successful)   || 0);
      setUnsuccessfulCount(Number(data.unsuccessful) || 0);
    } catch (err) {
      console.error("OutboundTouchbaseCountCard (TSA): failed to fetch breakdown", err);
    } finally {
      setLoadingBreakdown(false);
    }
  }, [referenceid, dateRange]);

  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

  const totalCalls = successfulCount + unsuccessfulCount;
  const percentage = target > 0 ? Math.round((successfulCount / target) * 100) : 0;

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">

        <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
          OB Calls (Successful)
        </div>

        {/* Successful count as main number */}
        <div className="text-4xl font-extrabold text-gray-900">
          {loadingBreakdown ? <Spinner className="w-8 h-8" /> : successfulCount}
        </div>

        {/* Unsuccessful + total breakdown */}
        {!loadingBreakdown && totalCalls > 0 && (
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
        {(target > 0 || loadingTarget) && (
          <div className="flex items-center gap-2">
            {loadingTarget ? (
              <span className="px-3 py-1 bg-gray-50 text-gray-400 text-xs rounded-full">
                Loading target…
              </span>
            ) : (
              <span className={[
                "px-3 py-1 text-sm font-medium rounded-full",
                percentage >= 100 ? "bg-green-50 text-green-600"
                  : percentage >= 70  ? "bg-blue-50 text-blue-600"
                  : "bg-amber-50 text-amber-600",
              ].join(" ")}>
                {percentage}% of {target}
              </span>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  );
};