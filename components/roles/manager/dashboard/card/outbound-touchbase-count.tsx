"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Settings } from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface ManagerOutboundTouchbaseCountCardProps {
  /** Manager ReferenceID — used to self-fetch the team monthly OB target */
  referenceid?: string;
  /** Actual OB call count for the period (passed from parent) */
  count?: number;
  loading?: boolean;
  userId?: string;
  /** Date range to derive which month(s) target to show */
  dateRange?: { from?: Date; to?: Date };
}

export const ManagerOutboundTouchbaseCountCard: React.FC<ManagerOutboundTouchbaseCountCardProps> = ({
  referenceid,
  count = 0,
  loading = false,
  userId = "",
  dateRange,
}) => {
  const router = useRouter();

  const [teamTarget,        setTeamTarget]        = useState<number>(0);
  const [loadingTeamTarget, setLoadingTeamTarget] = useState(false);

  const fetchTeamTarget = useCallback(async () => {
    if (!referenceid) return;
    setLoadingTeamTarget(true);
    try {
      // Fetch all TSMs under this manager, then sum each TSM's ob-target for the month
      const refDate   = dateRange?.from ?? new Date();
      const monthName = MONTH_NAMES[refDate.getMonth()];
      const year      = refDate.getFullYear().toString();

      // Get all TSMs under the manager
      const tsmRes = await fetch(`/api/manager-fetch-tsms?manager=${encodeURIComponent(referenceid)}`);
      if (!tsmRes.ok) throw new Error(`HTTP ${tsmRes.status}`);
      const tsmData = await tsmRes.json();
      const tsms: string[] = (tsmData.tsms ?? []).map((t: any) => t.referenceid as string);

      if (tsms.length === 0) { setTeamTarget(0); return; }

      // For each TSM fetch their agents' ob targets and sum
      const results = await Promise.all(
        tsms.map((tsm) =>
          fetch(`/api/tsm-agent-ob-target?tsm=${encodeURIComponent(tsm)}&year=${year}`)
            .then((r) => r.ok ? r.json() : { success: false, targets: {} })
        )
      );

      let total = 0;
      for (const data of results) {
        if (!data.success) continue;
        for (const agentMonths of Object.values(data.targets ?? {})) {
          const val = (agentMonths as Record<string, number>)[monthName] ?? 0;
          total += Number(val) || 0;
        }
      }
      setTeamTarget(total);
    } catch (err) {
      console.error("ManagerOutboundTouchbaseCountCard: failed to fetch team OB target", err);
    } finally {
      setLoadingTeamTarget(false);
    }
  }, [referenceid, dateRange]);

  useEffect(() => { fetchTeamTarget(); }, [fetchTeamTarget]);

  const percentage = teamTarget > 0 ? Math.round((count / teamTarget) * 100) : 0;
  const currentMonthName = MONTH_NAMES[new Date().getMonth()];

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(window.location.search);
    const id = userId || params.get("id") || "";
    router.push(`/roles/manager/ob-breakdown${id ? `?id=${encodeURIComponent(id)}` : ""}`);
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
            title="View OB calls breakdown"
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

        {teamTarget > 0 && (
          <p className="text-[10px] text-gray-400 leading-tight">
            Team monthly target · {currentMonthName}
          </p>
        )}

      </CardContent>
    </Card>
  );
};

export default ManagerOutboundTouchbaseCountCard;
