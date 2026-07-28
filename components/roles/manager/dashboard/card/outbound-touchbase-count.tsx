"use client";

import { useState, useEffect, useCallback } from "react";
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

interface ManagerOutboundTouchbaseCountCardProps {
  referenceid?: string;
  /** Kept for backward compat but ignored — card self-fetches breakdown */
  count?: number;
  loading?: boolean;
  userId?: string;
  dateRange?: { from?: Date; to?: Date };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ManagerOutboundTouchbaseCountCard: React.FC<ManagerOutboundTouchbaseCountCardProps> = ({
  referenceid,
  loading = false,
  userId = "",
  dateRange,
}) => {
  const router = useRouter();

  const [teamTarget,        setTeamTarget]        = useState<number>(0);
  const [loadingTeamTarget, setLoadingTeamTarget] = useState(false);

  const [successfulCount,   setSuccessfulCount]   = useState<number>(0);
  const [unsuccessfulCount, setUnsuccessfulCount] = useState<number>(0);
  const [loadingBreakdown,  setLoadingBreakdown]  = useState(false);

  // ── Fetch team OB target ──────────────────────────────────────────────────

  const fetchTeamTarget = useCallback(async () => {
    if (!referenceid) return;
    setLoadingTeamTarget(true);
    try {
      const refDate   = dateRange?.from ?? new Date();
      const monthName = MONTH_NAMES[refDate.getMonth()];
      const year      = refDate.getFullYear().toString();

      const tsmRes = await fetch(`/api/manager-fetch-tsms?manager=${encodeURIComponent(referenceid)}`);
      if (!tsmRes.ok) throw new Error(`HTTP ${tsmRes.status}`);
      const tsmData = await tsmRes.json();
      const tsms: string[] = (tsmData.tsms ?? []).map((t: any) => t.referenceid as string);
      if (tsms.length === 0) { setTeamTarget(0); return; }

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
          total += Number((agentMonths as Record<string, number>)[monthName] ?? 0) || 0;
        }
      }
      setTeamTarget(total);
    } catch (err) {
      console.error("ManagerOutboundTouchbaseCountCard: failed to fetch team OB target", err);
    } finally {
      setLoadingTeamTarget(false);
    }
  }, [referenceid, dateRange]);

  // ── Fetch successful / unsuccessful breakdown ─────────────────────────────

  const fetchBreakdown = useCallback(async () => {
    if (!referenceid) return;
    setLoadingBreakdown(true);
    try {
      const now  = new Date();
      const from = dateRange?.from
        ? toDateStr(dateRange.from)
        : toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
      const to   = dateRange?.to ? toDateStr(dateRange.to) : toDateStr(now);

      // manager-agent-outbound-history returns { history: [...], agents: [...] }
      const res  = await fetch(
        `/api/manager-agent-outbound-history?manager=${encodeURIComponent(referenceid)}&from=${from}&to=${to}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const history: any[] = data.history ?? [];
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
    } catch (err) {
      console.error("ManagerOutboundTouchbaseCountCard: failed to fetch breakdown", err);
    } finally {
      setLoadingBreakdown(false);
    }
  }, [referenceid, dateRange]);

  useEffect(() => { fetchTeamTarget(); }, [fetchTeamTarget]);
  useEffect(() => { fetchBreakdown();  }, [fetchBreakdown]);

  const totalCalls       = successfulCount + unsuccessfulCount;
  const percentage       = teamTarget > 0 ? Math.round((totalCalls / teamTarget) * 100) : 0;
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

        {/* Total */}
        <div className="text-4xl font-extrabold text-gray-900">
          {loading || loadingBreakdown ? <Spinner className="w-8 h-8" /> : totalCalls}
        </div>

        {/* Successful / Unsuccessful breakdown */}
        {!loading && !loadingBreakdown && totalCalls > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">✓ Successful</span>
              <span className="text-sm font-bold text-green-600">{successfulCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">✗ Unsuccessful</span>
              <span className="text-sm font-bold text-red-500">{unsuccessfulCount}</span>
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
            <span className={[
              "px-3 py-1 text-sm font-medium rounded-full",
              percentage >= 100 ? "bg-green-50 text-green-600"
                : percentage >= 70  ? "bg-blue-50 text-blue-600"
                : "bg-amber-50 text-amber-600",
            ].join(" ")}>
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
