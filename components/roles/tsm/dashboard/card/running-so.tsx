"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

interface RunningSoCardProps {
  referenceid?: string;
  targetTotal?: number;
  total?: number;
  totalRegular?: number;
  totalSPF?: number;
  loading?: boolean;
  userId?: string;
  dateRange?: { from?: Date; to?: Date };
}

export const RunningSoCard: React.FC<RunningSoCardProps> = ({
  targetTotal = 8750000,
  total = 0,
  totalRegular = 0,
  totalSPF = 0,
  loading = false,
  userId = "",
  dateRange,
}) => {
  const router = useRouter();

  // ── Label: show the active date range or fall back to current month ──────────
  const rangeLabel = (() => {
    const now = new Date();
    if (dateRange?.from && dateRange?.to) {
      const from = dateRange.from;
      const to   = dateRange.to;
      // Same day
      if (from.toDateString() === to.toDateString()) {
        return from.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
      }
      // Same month
      if (
        from.getFullYear() === to.getFullYear() &&
        from.getMonth()    === to.getMonth()
      ) {
        const month = from.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Manila" });
        const year  = from.getFullYear();
        // Full month check
        const firstOfMonth = new Date(from.getFullYear(), from.getMonth(), 1);
        const lastOfMonth  = new Date(from.getFullYear(), from.getMonth() + 1, 0);
        const isFullMonth =
          from.getDate() === firstOfMonth.getDate() &&
          to.getDate()   === lastOfMonth.getDate();
        return isFullMonth ? `${month} ${year}` : `${month} ${from.getDate()}–${to.getDate()}, ${year}`;
      }
      // Cross-month range
      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "Asia/Manila" };
      return `${from.toLocaleDateString("en-US", opts)} – ${to.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
    }
    // Default: current month
    return now.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" });
  })();

  const formatAmount = (amount: number) =>
    `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const percentage = targetTotal > 0 ? Math.round((total / targetTotal) * 100) : 0;

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(window.location.search);
    const id = userId || params.get("id") || "";
    router.push(`/roles/tsm/so-breakdown${id ? `?id=${encodeURIComponent(id)}` : ""}`);
  };

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            RUNNING SO ACTUAL — {rangeLabel}
          </div>
          <button
            onClick={handleSettings}
            className="relative z-20 p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="SO breakdown"
            title="View SO breakdown by agent"
            type="button"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-2xl md:text-3xl font-extrabold text-gray-900 break-all">
          {loading ? <Spinner className="w-6 h-6" /> : formatAmount(total)}
        </div>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Regular SO</span>
            <span className="text-sm font-bold text-gray-800">
              {loading ? <Spinner className="w-4 h-4" /> : formatAmount(totalRegular)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">SPF - Special Project</span>
            <span className="text-sm font-bold text-gray-800">
              {loading ? <Spinner className="w-4 h-4" /> : formatAmount(totalSPF)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={[
            "px-3 py-1 text-sm font-medium rounded-full",
            percentage >= 100 ? "bg-green-50 text-green-600"
              : percentage >= 70  ? "bg-blue-50 text-blue-600"
              : "bg-amber-50 text-amber-600",
          ].join(" ")}>
            {percentage}% achieved
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
