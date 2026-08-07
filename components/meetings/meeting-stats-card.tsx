"use client";

import React, { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, XCircle, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MeetingStats {
  total: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShow: number;
  thisWeek: number;
  totalConversionDelta: number;
}

interface MeetingStatsCardProps {
  referenceid?: string;
  tsm?: string;
  manager?: string;
  meetingPageUrl?: string;
  className?: string;
}

export function MeetingStatsCard({
  referenceid, tsm, manager,
  meetingPageUrl = "/roles/tsa/activity/meeting",
  className,
}: MeetingStatsCardProps) {
  const [stats, setStats] = useState<MeetingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const param = referenceid ? `referenceid=${referenceid}`
                : tsm         ? `tsm=${tsm}`
                : manager     ? `manager=${manager}` : null;
    if (!param) { setLoading(false); return; }

    fetch(`/api/meetings/stats?${param}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [referenceid, tsm, manager]);

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-gray-200 bg-white p-4 space-y-2 animate-pulse", className)}>
        <div className="h-4 w-32 bg-gray-100 rounded" />
        <div className="grid grid-cols-2 gap-2">
          {[0,1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    { label: "Upcoming",  value: stats.upcoming,  icon: <Clock className="w-3.5 h-3.5 text-blue-500" />,    bg: "bg-blue-50" },
    { label: "Completed", value: stats.completed, icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />, bg: "bg-emerald-50" },
    { label: "This Week", value: stats.thisWeek,  icon: <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />, bg: "bg-indigo-50" },
    { label: "No Show",   value: stats.noShow,    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,    bg: "bg-red-50" },
  ];

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-700">Meetings</span>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
            {stats.total} total
          </span>
        </div>
        <Link href={meetingPageUrl} className="text-[10px] text-indigo-600 hover:underline font-medium">
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.label} className={cn("rounded-lg p-2.5 flex items-center gap-2", item.bg)}>
            {item.icon}
            <div>
              <p className="text-sm font-bold text-gray-800 leading-none">{item.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {stats.totalConversionDelta !== 0 && (
        <div className={cn(
          "mt-2.5 flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2",
          stats.totalConversionDelta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        )}>
          <TrendingUp className="w-3.5 h-3.5" />
          Conversion impact: {stats.totalConversionDelta > 0 ? "+" : ""}{stats.totalConversionDelta} pts
        </div>
      )}
    </div>
  );
}
