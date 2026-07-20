"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthData {
  month: string;
  total: number;
}

interface MonthlySiTrendCardProps {
  referenceid: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`;
  return `₱${n.toLocaleString()}`;
};

const fmtFull = (n: number): string =>
  n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

// ─── Custom dot ───────────────────────────────────────────────────────────────

const CustomDot = (props: any) => {
  const { cx, cy } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#1a5c3a"
      stroke="#fff"
      strokeWidth={2}
    />
  );
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const value: number = payload[0]?.value ?? 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      <p className="font-mono font-bold text-gray-900">{fmtFull(value)}</p>
    </div>
  );
};

// ─── Main card ────────────────────────────────────────────────────────────────

export const MonthlySiTrendCard: React.FC<MonthlySiTrendCardProps> = ({
  referenceid,
}) => {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!referenceid) return;
    setLoading(true);
    setError(null);
    fetch(
      `/api/dashboard-monthly-si-trend?referenceid=${encodeURIComponent(referenceid)}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch monthly SI trend");
        return res.json();
      })
      .then((d) => setMonths(d.months ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [referenceid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Y-axis domain with a bit of headroom
  const maxVal = Math.max(...months.map((m) => m.total), 0);
  const yMax = maxVal > 0 ? maxVal * 1.25 : 1_000_000;

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
          Monthly SI trend by TSA
        </div>

        {loading ? (
          <div className="flex items-center justify-center w-full h-48 gap-2 text-xs text-gray-400">
            <Spinner className="w-5 h-5" />
            <span>Loading trend data...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center w-full h-48 gap-2">
            <span className="text-3xl grayscale opacity-30">⚠️</span>
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">
              {error}
            </p>
          </div>
        ) : months.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full h-48 gap-2">
            <span className="text-3xl grayscale opacity-30">📈</span>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              No SI data for this year yet
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={months}
              margin={{ top: 12, right: 16, left: 8, bottom: 4 }}
            >
              <defs>
                <linearGradient id="siGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmt}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                domain={[0, yMax]}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#1a5c3a"
                strokeWidth={2.5}
                fill="url(#siGradient)"
                dot={<CustomDot />}
                activeDot={{ r: 5, fill: "#1a5c3a", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
