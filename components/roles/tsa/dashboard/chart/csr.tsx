"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Card, CardContent, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card";

/* ================= FORMAT HOURS ================= */
function formatHoursToHMS(hours: number) {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ================= SPEEDOMETER ================= */
function Speedometer({ label, value, maxHours = 2 }: {
  label: string;
  value: number;
  maxHours?: number;
}) {
  const previousValueRef = React.useRef(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = previousValueRef.current;
    const end = value;
    let startTime: number | null = null;
    const duration = 800;

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else previousValueRef.current = end;
    }

    requestAnimationFrame(animate);
  }, [value]);

  const percentage = Math.min((displayValue / maxHours) * 100, 100);
  const angle = (percentage / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20">
        <div className="absolute w-full h-full border-t-[10px] border-gray-200 rounded-t-full" />
        <div
          className="absolute w-full h-full border-t-[10px] border-blue-500 rounded-t-full"
          style={{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }}
        />
        <div
          className="absolute bottom-0 left-1/2 origin-bottom"
          style={{ transform: `rotate(${angle - 90}deg)` }}
        >
          <div className="w-1 h-16 bg-red-500" />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full" />
      </div>
      <div className="text-sm font-bold mt-2">{formatHoursToHMS(displayValue)}</div>
      <div className="text-xs text-gray-500 text-center">{label}</div>
    </div>
  );
}

/* ================= MAIN COMPONENT ================= */
export function CSRMetricsCard({
  referenceId,
  dateRange,
  onMetricsChange,
}: {
  referenceId: string;
  dateRange?: { from?: Date; to?: Date };
  onMetricsChange?: (metrics: {
    avgResponseTime: number;
    avgQuotationHT: number;
    avgNonQuotationHT: number;
    avgSpfHT: number;
  }) => void;
}) {
  const today = new Date().toISOString().split("T")[0];

  // ── Derive from/to strings for the display chart (follows dateRange filter) ─
  const fromDate = dateRange?.from
    ? new Date(dateRange.from).toISOString().split("T")[0]
    : today;
  const toDate = dateRange?.to
    ? new Date(dateRange.to).toISOString().split("T")[0]
    : today;

  // ── Current month range — always used for KPI weighted score callback ──────
  const now = new Date();
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthTo   = today;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [avgNonQuotationHT, setAvgNonQuotationHT] = useState(0);
  const [avgQuotationHT, setAvgQuotationHT] = useState(0);
  const [avgSpfHT, setAvgSpfHT] = useState(0);

  const [tableStyles, setTableStyles] = useState({
    table_border_radius: "16",
  });

  useEffect(() => {
    fetch("/api/table-styles")
      .then((res) => res.json())
      .then((data) => {
        if (data?.table_styles) setTableStyles(data.table_styles);
      })
      .catch(() => { }); // silently fall back to defaults
  }, []);

  /* ================= EXACT SAME LOGIC AS breaches.tsx ================= */
  const fetchCSRMetrics = useCallback(async (refId: string, from: string, to: string) => {
    console.log("[csr.tsx] fetchCSRMetrics called with refId:", refId, "from:", from, "to:", to);
    if (!refId) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/act-fetch-activity-v2?referenceid=${encodeURIComponent(refId)}`;
      console.log("[csr.tsx] Fetching from:", url);
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[csr.tsx] Fetch failed with status:", res.status);
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const result = await res.json();
      console.log("[csr.tsx] Fetched result:", result);
      const data: any[] = result.data || [];

      const excluded = [
        "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const fromTs = new Date(from).getTime();
      const toDateObj = new Date(to);
      toDateObj.setHours(23, 59, 59, 999);
      const toTs = toDateObj.getTime();

      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0;

      data.forEach((row) => {
        if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
        const created = new Date(row.date_created).getTime();
        if (isNaN(created) || created < fromTs || created > toTs) return;
        if (excluded.includes(row.wrap_up)) return;

        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();
        const endorsed = new Date(row.ticket_endorsed).getTime();
        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          rtTotal += (tsaAck - endorsed) / 3600000;
          rtCount++;
        }

        const received = new Date(row.ticket_received).getTime();
        const tsaHandle = new Date(row.tsa_handling_time).getTime();
        const tsmHandle = new Date(row.tsm_handling_time).getTime();
        let baseHT = 0;
        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received)
          baseHT = (tsaHandle - received) / 3600000;
        else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received)
          baseHT = (tsmHandle - received) / 3600000;
        if (!baseHT) return;

        const remarks = (row.remarks || "").toUpperCase();
        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          qTotal += baseHT; qCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT; spfCount++;
        } else {
          nqTotal += baseHT; nqCount++;
        }
      });

      setAvgResponseTime(rtCount ? rtTotal / rtCount : 0);
      setAvgNonQuotationHT(nqCount ? nqTotal / nqCount : 0);
      setAvgQuotationHT(qCount ? qTotal / qCount : 0);
      setAvgSpfHT(spfCount ? spfTotal / spfCount : 0);

    } catch {
      setError("Failed to fetch CSR metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Re-fetch display chart whenever referenceId or date range changes ──
  useEffect(() => {
    if (!referenceId) return;
    fetchCSRMetrics(referenceId, fromDate, toDate);
  }, [referenceId, fromDate, toDate, fetchCSRMetrics]);

  // ── Separate monthly fetch — always current month, for KPI score ───────
  useEffect(() => {
    if (!referenceId || !onMetricsChange) return;

    const computeMonthly = async () => {
      try {
        const res = await fetch(
          `/api/act-fetch-activity-v2?referenceid=${encodeURIComponent(referenceId)}`
        );
        if (!res.ok) return;
        const result = await res.json();
        const data: any[] = result.data || [];

        const excluded = [
          "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
          "Supplier/Vendor Product Offer", "Internal Whistle Blower",
          "Threats/Extortion/Intimidation", "Prank Call",
        ];

        const now = new Date();
        const fromTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const toTs   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

        let rtTotal = 0, rtCount = 0;
        let nqTotal = 0, nqCount = 0;
        let qTotal  = 0, qCount  = 0;
        let spfTotal = 0, spfCount = 0;

        data.forEach((row) => {
          if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
          const created = new Date(row.date_created).getTime();
          if (isNaN(created) || created < fromTs || created > toTs) return;
          if (excluded.includes(row.wrap_up)) return;

          const tsaAck   = new Date(row.tsa_acknowledge_date).getTime();
          const endorsed = new Date(row.ticket_endorsed).getTime();
          if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
            rtTotal += (tsaAck - endorsed) / 3600000;
            rtCount++;
          }

          const received  = new Date(row.ticket_received).getTime();
          const tsaHandle = new Date(row.tsa_handling_time).getTime();
          const tsmHandle = new Date(row.tsm_handling_time).getTime();
          let baseHT = 0;
          if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received)
            baseHT = (tsaHandle - received) / 3600000;
          else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received)
            baseHT = (tsmHandle - received) / 3600000;
          if (!baseHT) return;

          const remarks = (row.remarks || "").toUpperCase();
          if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
            qTotal += baseHT; qCount++;
          } else if (remarks.includes("SPF")) {
            spfTotal += baseHT; spfCount++;
          } else {
            nqTotal += baseHT; nqCount++;
          }
        });

        onMetricsChange({
          avgResponseTime:   rtCount ? rtTotal / rtCount : 0,
          avgQuotationHT:    qCount  ? qTotal  / qCount  : 0,
          avgNonQuotationHT: nqCount ? nqTotal / nqCount : 0,
          avgSpfHT:          spfCount ? spfTotal / spfCount : 0,
        });
      } catch {
        // silently fail — KPI score will default to rating 1
      }
    };

    computeMonthly();
  }, [referenceId, onMetricsChange]);

  /* ================= UI ================= */
  return (
    <Card className="bg-white z-10 text-black flex flex-col justify-between"
      style={{ borderRadius: `${tableStyles.table_border_radius}px`, }}>
      <CardHeader>
        <CardTitle>CSR Metrics Tickets</CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div className="grid grid-cols-2 gap-6 justify-items-center">
            <Speedometer label="TSA Response Time" value={avgResponseTime} maxHours={2} />
            <Speedometer label="Non-Quotation HT" value={avgNonQuotationHT} maxHours={2} />
            <Speedometer label="Quotation HT" value={avgQuotationHT} maxHours={2} />
            <Speedometer label="SPF Handling Duration" value={avgSpfHT} maxHours={2} />
          </div>
        )}
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        CSR performance summary
      </CardFooter>
    </Card>
  );
}