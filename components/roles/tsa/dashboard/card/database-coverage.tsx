"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface DatabaseCoverageCardProps {
  referenceid: string;
  name?: string;
  fromDate?: string;
  toDate?: string;
}

// Convert ISO date string to PH local date string (YYYY-MM-DD)
const toLocalDateString = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
};

function barColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#3b82f6";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

export function DatabaseCoverageCard({
  referenceid,
  name = "—",
  fromDate,
  toDate,
}: DatabaseCoverageCardProps) {
  const [coveredCount, setCoveredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use current date if fromDate/toDate not provided
  const today = useMemo(() => toLocalDateString(new Date()), []);
  const effectiveFromDate = fromDate || today;

  // Compute month range from effectiveFromDate
  const monthRange = useMemo(() => {
    const d = new Date(effectiveFromDate + "T00:00:00Z");
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1)).toISOString().split("T")[0];
    const monthEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().split("T")[0];
    return { monthStart, monthEnd };
  }, [effectiveFromDate]);

  // Fetch data
  useEffect(() => {
    if (!referenceid) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/db-coverage?referenceid=${encodeURIComponent(referenceid)}&from=${monthRange.monthStart}&to=${monthRange.monthEnd}`
        );
        if (!res.ok) throw new Error("Failed to fetch DB coverage");
        const data = await res.json();
        if (data.success) {
          setCoveredCount(data.coveredCount);
          setTotalCount(data.totalCount);
        } else {
          throw new Error(data.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [referenceid, monthRange.monthStart, monthRange.monthEnd]);

  const percentage = totalCount > 0 ? Math.min(Math.round((coveredCount / totalCount) * 100), 100) : 0;

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
          DB Coverage
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-4 gap-2 text-xs text-gray-400">
            <Spinner className="w-4 h-4" />
            <span>Loading…</span>
          </div>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{name}</span>
                <span className="text-sm font-bold" style={{ color: barColor(percentage) }}>
                  {coveredCount.toLocaleString()}/{totalCount.toLocaleString()}
                </span>
              </div>
              {totalCount > 0 && (
                <div className="w-full bg-gray-200 h-1.5 rounded-full">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: barColor(percentage),
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
