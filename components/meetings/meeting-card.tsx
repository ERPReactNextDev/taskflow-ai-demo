"use client";

import React from "react";
import { CalendarClock, MapPin, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Meeting, STATUS_COLORS, TYPE_COLORS, fmtManila } from "@/types/meetings";
import { cn } from "@/lib/utils";

interface MeetingCardProps {
  meeting: Meeting;
  onClick?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function MeetingCard({ meeting, onClick, onEdit, onCancel, compact = false }: MeetingCardProps) {
  const typeCls   = TYPE_COLORS[meeting.type_activity] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const statusCls = STATUS_COLORS[meeting.status ?? "Scheduled"] ?? STATUS_COLORS["Scheduled"];
  const isCancelled = meeting.is_cancelled;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative rounded-lg border bg-white transition-all cursor-pointer select-none",
        isCancelled ? "opacity-50 border-gray-200" : "border-gray-200 hover:border-indigo-300 hover:shadow-md",
        compact ? "p-2.5" : "p-3.5"
      )}
    >
      {/* Left accent bar */}
      <div className={cn(
        "absolute left-0 top-3 bottom-3 w-[3px] rounded-full",
        isCancelled ? "bg-gray-300" :
        meeting.type_activity === "Client Meeting" ? "bg-indigo-500" :
        meeting.type_activity === "Group Meeting"  ? "bg-violet-500" :
        meeting.type_activity === "Demo"           ? "bg-amber-500" :
        "bg-gray-400"
      )} />

      <div className="pl-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn("font-bold text-gray-800 truncate leading-tight", compact ? "text-[11px]" : "text-xs")}>
              {meeting.company_name ?? meeting.type_activity}
            </p>
            {meeting.company_name && (
              <p className="text-[10px] text-gray-400 mt-0.5">{meeting.type_activity}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && !isCancelled && (
              <button
                onClick={e => { e.stopPropagation(); onEdit(); }}
                className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Edit"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onCancel && !isCancelled && (
              <button
                onClick={e => { e.stopPropagation(); onCancel(); }}
                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Cancel"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Time */}
        <div className={cn("flex items-center gap-1 mt-1.5 text-gray-500", compact ? "text-[10px]" : "text-[11px]")}>
          <CalendarClock className="w-3 h-3 shrink-0" />
          <span>{fmtManila(meeting.start_date, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</span>
          <span className="text-gray-300 mx-0.5">–</span>
          <span>{fmtManila(meeting.end_date, { hour: "numeric", minute: "2-digit", hour12: true })}</span>
        </div>

        {/* Location */}
        {meeting.location && !compact && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{meeting.location}</span>
          </div>
        )}

        {/* Badges */}
        {!compact && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", typeCls)}>
              {meeting.type_activity}
            </span>
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", statusCls)}>
              {meeting.status ?? "Scheduled"}
            </span>
            {meeting.outcome && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-200">
                {meeting.outcome}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
