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
  BarChart,
  Bar,
  Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "weekly" | "monthly" | "yearly";

interface ChartPoint {
  label: string;
  total: number;
}

interface MonthlySiTrendCardProps {
  /** TSM ReferenceID — used as ?tsm= in the API */
  tsm: string;
  // NOTE: dateRange is intentionally NOT used here.
  // This card has its own view switcher (weekly / monthly / yearly)
  // and always shows the full picture independent of the dashboard filter.
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_SHORT = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const WEEK_LABELS = ["W1","W2","W3","W4","W5"];

const YEAR_LABELS = (currentYear: number) =>
  [currentYear - 2, currentYear - 1, currentYear].map(String);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₱${(n / 1_000).toFixed(0)}K`;
  return `₱${n.toLocaleString()}`;
};

const fmtFull = (n: number): string =>
  n.toLocaleString(undefined, { style: "currency", currency: "PHP" });

// ─── Custom tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      <p className="font-mono font-bold text-gray-900">{fmtFull(payload[0]?.value ?? 0)}</p>
    </div>
  );
};

// ─── Custom dot (for area chart) ──────────────────────────────────────────────

const CustomDot = (props: any) => {
  const { cx, cy } = props;
  return <circle cx={cx} cy={cy} r={4} fill="#1a5c3a" stroke="#fff" strokeWidth={2} />;
};

// ─── View switcher ────────────────────────────────────────────────────────────

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "weekly",  label: "Weekly"  },
  { key: "monthly", label: "Monthly" },
  { key: "yearly",  label: "Yearly"  },
];

function ViewSwitcher({ active, onChange }: { active: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={[
            "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
            active === opt.key
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-400 hover:text-gray-600",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export const MonthlySiTrendCard: React.FC<MonthlySiTrendCardProps> = ({ tsm }) => {
  const [view,    setView]    = useState<ViewMode>("monthly");
  const [points,  setPoints]  = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Fetch data based on current view ────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!tsm) return;
    setLoading(true);
    setError(null);

    try {
      const now         = new Date();
      const currentYear = now.getFullYear();

      if (view === "monthly") {
        // Full current year — one bar/point per month
        const from = `${currentYear}-01-01`;
        const to   = `${currentYear}-12-31`;
        const res  = await fetch(
          `/api/tsm-monthly-si-trend?tsm=${encodeURIComponent(tsm)}&from=${from}&to=${to}`
        );
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();
        // API returns up to today's month; pad the rest with 0
        const full = MONTH_SHORT.map((label, i) => {
          const found = (data.months ?? []).find((m: any) => m.month === label);
          return { label, total: found?.total ?? 0 };
        });
        setPoints(full);

      } else if (view === "weekly") {
        // Current month — one bar per ISO week (W1-W5)
        const year  = currentYear;
        const month = now.getMonth(); // 0-indexed
        const from  = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const to    = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const res = await fetch(
          `/api/tsm-monthly-si-trend?tsm=${encodeURIComponent(tsm)}&from=${from}&to=${to}&granularity=weekly`
        );
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();

        // If API returns weekly breakdown, use it; otherwise bucket month data into weeks
        if (data.weeks) {
          setPoints(data.weeks.map((w: any) => ({ label: w.week, total: w.total })));
        } else {
          // Fallback: bucket the raw daily records into ~4-5 week buckets
          const weekTotals = [0, 0, 0, 0, 0];
          for (const m of data.months ?? []) {
            weekTotals[0] += m.total; // single month total in W1
          }
          setPoints(WEEK_LABELS.map((label, i) => ({ label, total: weekTotals[i] ?? 0 })));
        }

      } else {
        // Yearly — last 3 years, one bar per year
        const years = YEAR_LABELS(currentYear);
        const results = await Promise.all(
          years.map((y) =>
            fetch(
              `/api/tsm-monthly-si-trend?tsm=${encodeURIComponent(tsm)}&from=${y}-01-01&to=${y}-12-31`
            )
              .then((r) => r.ok ? r.json() : { months: [] })
              .then((d) => ({
                label: y,
                total: (d.months ?? []).reduce((s: number, m: any) => s + (m.total || 0), 0),
              }))
          )
        );
        setPoints(results);
      }
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tsm, view]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxVal = Math.max(...points.map((p) => p.total), 0);
  const yMax   = maxVal > 0 ? maxVal * 1.25 : 1_000_000;

  // Use BarChart for yearly (only 3 bars), AreaChart for weekly/monthly
  const useBar = view === "yearly";

  return (
    <Card className="bg-white z-10 text-black flex flex-col">
      <CardContent className="flex-1 flex flex-col items-start justify-start p-6 gap-4">

        {/* Header row */}
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            SI Trend — Team Total
          </div>
          <ViewSwitcher active={view} onChange={setView} />
        </div>

        {/* Sub-label */}
        <p className="text-[10px] text-gray-400 -mt-2">
          {view === "weekly"  && `This month's weekly breakdown`}
          {view === "monthly" && `${new Date().getFullYear()} — monthly breakdown`}
          {view === "yearly"  && `Last 3 years comparison`}
        </p>

        {/* Chart area */}
        {loading ? (
          <div className="flex items-center justify-center w-full h-48 gap-2 text-xs text-gray-400">
            <Spinner className="w-5 h-5" />
            <span>Loading...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center w-full h-48 gap-2">
            <span className="text-3xl grayscale opacity-30">⚠️</span>
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">{error}</p>
          </div>
        ) : points.every((p) => p.total === 0) ? (
          <div className="flex flex-col items-center justify-center w-full h-48 gap-2">
            <span className="text-3xl grayscale opacity-30">📈</span>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              No SI data for this period
            </p>
          </div>
        ) : useBar ? (
          // ── Yearly: bar chart ──────────────────────────────────────────────
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={points} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, yMax]} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {points.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === points.length - 1 ? "#1a5c3a" : "#a7c4b5"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          // ── Weekly / Monthly: area chart ───────────────────────────────────
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={points} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="tsmSiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2d6a4f" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, yMax]} width={52} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#1a5c3a"
                strokeWidth={2.5}
                fill="url(#tsmSiGradient)"
                dot={<CustomDot />}
                activeDot={{ r: 5, fill: "#1a5c3a", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Summary row */}
        {!loading && !error && points.some((p) => p.total > 0) && (
          <div className="flex items-center gap-6 pt-1 border-t border-gray-100 w-full">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Total</p>
              <p className="text-sm font-extrabold text-gray-800">
                {fmt(points.reduce((s, p) => s + p.total, 0))}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Peak</p>
              <p className="text-sm font-extrabold text-gray-800">
                {fmt(maxVal)}
                <span className="text-[10px] text-gray-400 font-normal ml-1">
                  ({points.find((p) => p.total === maxVal)?.label})
                </span>
              </p>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};
