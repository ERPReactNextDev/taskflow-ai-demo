"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type ConversionStatus =
  | "NEW LEAD"
  | "PROSPECT"
  | "QUALIFIED PROSPECT"
  | "COMMITTED PROSPECT"
  | "OFFICIAL CLIENT";

interface ConversionStatusBadgeProps {
  status: ConversionStatus | string;
  probability?: number;
  showProbability?: boolean;
  size?: "sm" | "md";
  flags?: string[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "NEW LEAD":           { bg: "bg-gray-100",   text: "text-gray-600",   border: "border-gray-200",  dot: "bg-gray-400" },
  "PROSPECT":           { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200",  dot: "bg-blue-500" },
  "QUALIFIED PROSPECT": { bg: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200", dot: "bg-amber-500" },
  "COMMITTED PROSPECT": { bg: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200",dot: "bg-orange-500" },
  "OFFICIAL CLIENT":    { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200",dot: "bg-emerald-500" },
};

const STATUS_NEXT_ACTION: Record<string, string> = {
  "NEW LEAD":           "Schedule outbound call",
  "PROSPECT":           "Prepare quotation",
  "QUALIFIED PROSPECT": "Follow up on quote — close SO",
  "COMMITTED PROSPECT": "Confirm delivery date",
  "OFFICIAL CLIENT":    "Maintain relationship",
};

export function ConversionStatusBadge({
  status, probability, showProbability = true, size = "sm", flags = [],
}: ConversionStatusBadgeProps) {
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES["NEW LEAD"];
  const nextAction = STATUS_NEXT_ACTION[status] ?? "";

  return (
    <div className="inline-flex flex-col gap-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide",
          styles.bg, styles.text, styles.border,
          size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
        )}
        title={`Next: ${nextAction}`}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)} />
        {status}
        {showProbability && probability !== undefined && (
          <span className="opacity-60 font-normal">({probability}%)</span>
        )}
      </span>

      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {flags.map(f => (
            <span key={f} className="inline-flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              ⚠️ {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConversionProgressBar({ probability, status }: { probability: number; status: string }) {
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES["NEW LEAD"];

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", styles.dot)}
          style={{ width: `${probability}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-gray-500 tabular-nums w-8 text-right">
        {probability}%
      </span>
    </div>
  );
}
