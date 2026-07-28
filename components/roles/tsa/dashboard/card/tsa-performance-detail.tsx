"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerformanceData {
  name: string;
  referenceid: string;
  runningTarget: number;
  runningSI: number;
  runningSO: number;
  siPercentage: number;
  soPercentage: number;
  obCalls: number;
  quotationsCount: number;
  clientVisits: number;
  status: "On track" | "At risk" | "Below target";
}

interface TsaPerformanceDetailProps {
  referenceid: string;
  dateRange?: { from?: Date; to?: Date };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtAmount = (n: number): string => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₱${(n / 1_000).toFixed(2)}K`;
  return `₱${n.toLocaleString()}`;
};

const statusStyle: Record<PerformanceData["status"], string> = {
  "On track":    "text-green-600 font-semibold",
  "At risk":     "text-yellow-600 font-semibold",
  "Below target":"text-red-500 font-semibold",
};

// ─── SI % cell with inline bar ────────────────────────────────────────────────

const PctCell: React.FC<{ value: number; target: number; color: string }> = ({
  value,
  target,
  color,
}) => {
  const fill = Math.min((value / target) * 100, 100);
  const textColor =
    value >= target          ? "text-green-600" :
    value >= target * 0.7    ? "text-yellow-600" :
                               "text-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <span className={`font-mono font-bold text-xs ${textColor}`}>{value}%</span>
      <div className="flex-1 bg-gray-100 h-1.5 rounded-full min-w-[40px]">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${fill}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ─── Table header cell ────────────────────────────────────────────────────────

const TH: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <th
    className={`text-[10px] font-bold uppercase tracking-widest text-gray-500 px-4 py-3 text-left whitespace-nowrap ${className}`}
  >
    {children}
  </th>
);

// ─── Table data cell ──────────────────────────────────────────────────────────

const TD: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <td className={`px-4 py-3 text-xs text-gray-800 whitespace-nowrap ${className}`}>
    {children}
  </td>
);

// ─── Avatar initials ──────────────────────────────────────────────────────────

const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold shrink-0">
      {initials}
    </span>
  );
};

// ─── Main card ────────────────────────────────────────────────────────────────

export const TsaPerformanceDetail: React.FC<TsaPerformanceDetailProps> = ({
  referenceid,
  dateRange,
}) => {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!referenceid) return;
    setLoading(true);
    setError(null);
    const url = new URL("/api/dashboard-tsa-performance", window.location.origin);
    url.searchParams.append("referenceid", referenceid);
    if (dateRange?.from) url.searchParams.append("from", dateRange.from.toISOString().slice(0, 10));
    if (dateRange?.to)   url.searchParams.append("to",   dateRange.to.toISOString().slice(0, 10));
    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch performance data");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [referenceid, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="p-0 flex flex-col">
        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            TSA performance detail
          </p>
        </div>

        {/* ── States ── */}
        {loading && (
          <div className="flex items-center justify-center h-24 gap-2 text-xs text-gray-400">
            <Spinner className="w-4 h-4" />
            <span>Loading performance data...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center h-24 gap-1">
            <span className="text-2xl grayscale opacity-30">⚠️</span>
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && !data && (
          <div className="flex flex-col items-center justify-center h-24 gap-1">
            <span className="text-2xl grayscale opacity-30">📋</span>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              No data available
            </p>
          </div>
        )}

        {/* ── Table ── */}
        {!loading && !error && data && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <TH>TSA</TH>
                  <TH>Target</TH>
                  <TH>Running SI</TH>
                  <TH>Running SO</TH>
                  <TH>SI %</TH>
                  <TH>SO %</TH>
                  <TH>OB Calls</TH>
                  <TH>Quotations</TH>
                  <TH>Client Visits</TH>
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  {/* TSA name + avatar */}
                  <TD>
                    <div className="flex items-center gap-2">
                      <Avatar name={data.name} />
                      <span className="font-semibold text-gray-900">{data.name}</span>
                    </div>
                  </TD>

                  {/* Running Target */}
                  <TD>
                    <span className="font-mono font-bold text-gray-800">
                      {fmtAmount(data.runningTarget)}
                    </span>
                  </TD>

                  {/* Running SI */}
                  <TD>
                    <span className="font-mono font-bold text-gray-800">
                      {fmtAmount(data.runningSI)}
                    </span>
                  </TD>

                  {/* Running SO */}
                  <TD>
                    <span className="font-mono font-bold text-gray-800">
                      {fmtAmount(data.runningSO)}
                    </span>
                  </TD>

                  {/* SI % with bar */}
                  <TD>
                    <PctCell value={data.siPercentage} target={70} color="#dc2626" />
                  </TD>

                  {/* SO % with bar */}
                  <TD>
                    <PctCell value={data.soPercentage} target={30} color="#2563eb" />
                  </TD>

                  {/* OB Calls */}
                  <TD>
                    <span className="font-mono font-bold">{data.obCalls}</span>
                  </TD>

                  {/* Quotations */}
                  <TD>
                    <span className="font-mono font-bold">{data.quotationsCount}</span>
                  </TD>

                  {/* Client Visits */}
                  <TD>
                    <span className="font-mono font-bold">{data.clientVisits}</span>
                  </TD>

                  {/* Status */}
                  <TD>
                    <span className={statusStyle[data.status]}>{data.status}</span>
                  </TD>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
