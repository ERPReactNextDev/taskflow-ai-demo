"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineStage {
  stage: string;
  completed: boolean;
  date: string | null;
  count: number;
  isCurrent: boolean;
  isNext: boolean;
}

interface ActivityTimelineProps {
  accountReferenceNumber: string;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

const STAGE_LABELS: Record<string, string> = {
  "Outbound Calls":               "Outbound Call",
  "Quotation Preparation":        "Quotation Sent",
  "Sales Order Preparation":      "Sales Order",
  "Delivered / Closed Transaction": "Closed / Delivered",
};

const STAGE_ICONS: Record<string, string> = {
  "Outbound Calls":               "📞",
  "Quotation Preparation":        "📄",
  "Sales Order Preparation":      "📦",
  "Delivered / Closed Transaction": "🏆",
};

export function ActivityTimeline({ accountReferenceNumber }: ActivityTimelineProps) {
  const [data, setData] = useState<{
    timeline: TimelineStage[];
    progress_pct: number;
    current_stage: string;
    next_stage: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountReferenceNumber) return;
    setLoading(true);
    fetch(`/api/lead-conversion/activity-timeline?account_reference_number=${encodeURIComponent(accountReferenceNumber)}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); })
      .finally(() => setLoading(false));
  }, [accountReferenceNumber]);

  if (loading) {
    return <div className="h-20 flex items-center justify-center text-xs text-gray-400">Loading timeline...</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${data.progress_pct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-600 tabular-nums shrink-0">
          {data.progress_pct}% to Client
        </span>
      </div>

      {/* Stage steps */}
      <div className="flex items-center gap-0">
        {data.timeline.map((stage, i) => (
          <React.Fragment key={stage.stage}>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              {/* Icon */}
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm border-2 transition-all",
                stage.completed
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200"
                  : stage.isNext
                  ? "bg-white border-amber-400 text-amber-500"
                  : "bg-white border-gray-200 text-gray-300"
              )}>
                {stage.completed
                  ? <CheckCircle2 className="w-5 h-5" />
                  : stage.isNext
                  ? <Clock className="w-4 h-4" />
                  : <Circle className="w-4 h-4" />
                }
              </div>

              {/* Label */}
              <div className="text-center px-1">
                <p className={cn(
                  "text-[10px] font-bold leading-tight truncate",
                  stage.completed ? "text-emerald-700" : stage.isNext ? "text-amber-600" : "text-gray-400"
                )}>
                  {STAGE_ICONS[stage.stage]} {STAGE_LABELS[stage.stage] ?? stage.stage}
                </p>
                {stage.completed && stage.date && (
                  <p className="text-[9px] text-gray-400 mt-0.5">{fmtDate(stage.date)}</p>
                )}
                {!stage.completed && stage.isNext && (
                  <p className="text-[9px] text-amber-500 mt-0.5 font-medium">Next step</p>
                )}
                {stage.count > 1 && (
                  <p className="text-[9px] text-gray-400">×{stage.count}</p>
                )}
              </div>
            </div>

            {/* Connector */}
            {i < data.timeline.length - 1 && (
              <ChevronRight className={cn(
                "w-4 h-4 shrink-0 -mx-1",
                data.timeline[i + 1].completed ? "text-emerald-400" : "text-gray-200"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
