"use client";

import React, { useEffect, useState } from "react";
import { type DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SiteVisitCardProps {
  referenceid: string;
  dateRange?: DateRange;
  name?: string;
}

interface SiteVisitTarget {
  target?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function barColor(pct: number): string {
  if (pct >= 90) return "#16a34a";
  if (pct >= 70) return "#10b981";
  if (pct >= 50) return "#3b82f6";
  if (pct >= 30) return "#f59e0b";
  return "#ef4444";
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SiteVisitCard({ referenceid, dateRange, name = "—" }: SiteVisitCardProps) {
  const [visitCount, setVisitCount]         = useState<number>(0);
  const [target, setTarget]                 = useState<number>(0);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  useEffect(() => {
    if (!referenceid) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // ── Fetch Login count from Supabase tasklog ──
        const visitsUrl = new URL("/api/fetch-tasklog-supabase", window.location.origin);
        visitsUrl.searchParams.append("referenceid", referenceid);

        if (dateRange?.from) visitsUrl.searchParams.append("from", toDateStr(dateRange.from));
        if (dateRange?.to)   visitsUrl.searchParams.append("to",   toDateStr(dateRange.to));

        // ── Fetch site visit target ──
        const now        = new Date();
        const year       = now.getFullYear().toString();
        const monthNames = ["January","February","March","April","May","June",
                            "July","August","September","October","November","December"];
        const month      = monthNames[now.getMonth()];
        const targetUrl  = `/api/site-visit-target?referenceid=${encodeURIComponent(referenceid)}&year=${year}&month=${month}`;

        const [visitsRes, targetRes] = await Promise.all([
          fetch(visitsUrl.toString()),
          fetch(targetUrl),
        ]);

        if (!visitsRes.ok) throw new Error("Failed to fetch site visits");
        if (!targetRes.ok) throw new Error("Failed to fetch site visit target");

        const visitsData = await visitsRes.json();
        const targetData = await targetRes.json();

        // Count only Login entries
        const logins = (visitsData.siteVisits || []).filter(
          (v: any) => v.Status === "Login"
        ).length;

        setVisitCount(logins);
        setTarget(parseInt(targetData.target?.target ?? "0") || 10); // Default to 10
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [referenceid, dateRange]);

  const percentage = target > 0 ? Math.min(Math.round((visitCount / target) * 100), 100) : 0;
  const color      = barColor(percentage);

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
          Site Visits
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <Spinner className="w-4 h-4" />
            <span>Loading...</span>
          </div>
        ) : error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <div className="space-y-2">
            {/* Name + count */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">{name}</span>
              <span
                className="text-sm font-bold"
                style={{ color }}
              >
                {visitCount}/{target || "—"}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 h-1.5 rounded-full">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
