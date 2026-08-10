"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminOutboundTouchbaseCountCardProps {
  /** Kept for backward compat but ignored — card self-fetches breakdown */
  count?: number;
  loading?: boolean;
  dateRange?: { from?: Date; to?: Date };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AdminOutboundTouchbaseCountCard: React.FC<AdminOutboundTouchbaseCountCardProps> = ({
  loading = false,
  dateRange,
}) => {
  const router = useRouter();

  const [successfulCount,   setSuccessfulCount]   = useState<number>(0);
  const [unsuccessfulCount, setUnsuccessfulCount] = useState<number>(0);
  const [loadingBreakdown,  setLoadingBreakdown]  = useState(false);

  const fetchBreakdown = useCallback(async () => {
    setLoadingBreakdown(true);
    try {
      const now  = new Date();
      const from = dateRange?.from
        ? toDateStr(dateRange.from)
        : toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      const to   = dateRange?.to ? toDateStr(dateRange.to) : toDateStr(now);

      const params = new URLSearchParams({ from, to });
      const res    = await fetch(`/api/admin-history-outbound?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // admin-history-outbound now returns { count, successful, unsuccessful }
      setSuccessfulCount(Number(data.successful)   || 0);
      setUnsuccessfulCount(Number(data.unsuccessful) || 0);
    } catch (err) {
      console.error("AdminOutboundTouchbaseCountCard: failed to fetch breakdown", err);
    } finally {
      setLoadingBreakdown(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchBreakdown(); }, [fetchBreakdown]);

  const totalCalls     = successfulCount + unsuccessfulCount;
  const refDate        = dateRange?.from ?? new Date();
  const currentMonth   = MONTH_NAMES[refDate.getMonth()];

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-2">

        {/* Header */}
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            OB Calls (Successful)
          </div>
          <button
            onClick={() => router.push("/roles/admin/ob-breakdown")}
            className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="OB calls breakdown"
            title="View system-wide OB calls breakdown"
            type="button"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Main count — Successful only */}
        <div className="text-4xl font-extrabold text-gray-900">
          {loading || loadingBreakdown ? <Spinner className="w-8 h-8" /> : successfulCount.toLocaleString()}
        </div>

        {/* Unsuccessful + total breakdown */}
        {!loading && !loadingBreakdown && totalCalls > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">✗ Unsuccessful</span>
              <span className="text-sm font-bold text-red-500">{unsuccessfulCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">Total (incl. unsuccessful)</span>
              <span className="text-sm font-bold text-gray-400">{totalCalls.toLocaleString()}</span>
            </div>
          </div>
        )}

        <p className="text-[10px] text-gray-400 leading-tight">
          System-wide · {currentMonth}
        </p>

      </CardContent>
    </Card>
  );
};

export default AdminOutboundTouchbaseCountCard;
