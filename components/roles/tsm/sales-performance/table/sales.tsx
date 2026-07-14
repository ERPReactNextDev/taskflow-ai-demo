"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, Download } from "lucide-react";
import ExcelJS from "exceljs";
import {
  Table, TableBody, TableCell, TableFooter,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  firstname: string;
  lastname: string;
}

interface AgentRow { referenceid: string; name: string; }

interface SiRecord {
  referenceid: string;
  actual_sales: number;
  delivery_date: string;
}

interface SalesProps {
  referenceid: string;
  dateCreatedFilterRange: any;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<any>>;
  userDetails: UserDetails;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const countWorkingDays = (from: Date, to: Date): number => {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (cursor <= end) {
    if (cursor.getDay() !== 0) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

const toLocalDateStr = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const CustomDailyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  const hit  = data.actualSales >= data.dailyQuota;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-xs min-w-[220px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-1">
        <span className="text-gray-500">Daily Quota</span>
        <span className="font-semibold text-right">{data.dailyQuota.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span>
        <span className="text-gray-500">Total Sales</span>
        <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>{data.actualSales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span>
        <span className="text-gray-500">Variance</span>
        <span className={`font-semibold text-right ${hit ? "text-green-600" : "text-red-500"}`}>{(data.actualSales - data.dailyQuota).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span>
      </div>
      <p className={`text-xs font-bold mb-2 ${hit ? "text-green-600" : "text-red-500"}`}>{hit ? "✓ Hit" : "✗ Missed"}</p>
      {data.agentsBreakdown?.length > 0 && (
        <>
          <p className="text-gray-400 font-semibold uppercase tracking-wide text-[10px] mb-1">Agent Breakdown</p>
          <div className="space-y-1.5">
            {data.agentsBreakdown.sort((a: any, b: any) => b.sales - a.sales).map((agent: any, i: number) => (
              <div key={i} className="flex flex-col gap-0.5 border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                <div className="flex justify-between gap-4 items-center">
                  <span className="capitalize text-gray-700 font-semibold">{agent.name}</span>
                  <span className={`text-xs font-bold ${agent.hit ? "text-green-600" : "text-red-500"}`}>{agent.hit ? "✓ Hit" : "✗ Missed"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                  <span>Quota</span><span className="font-medium text-gray-600 text-right">{agent.dailyQuota.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span>
                  <span>Sales</span><span className={`font-medium text-right ${agent.hit ? "text-green-600" : "text-red-500"}`}>{agent.sales.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span>
                  <span>Variance</span><span className={`font-medium text-right ${agent.hit ? "text-green-600" : "text-red-500"}`}>{(agent.sales - agent.dailyQuota).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const SalesTable: React.FC<SalesProps> = ({
  referenceid,
  dateCreatedFilterRange,
}) => {
  const [siRecords,        setSiRecords]        = useState<SiRecord[]>([]);
  const [agents,           setAgents]           = useState<AgentRow[]>([]);
  const [quotaMap,         setQuotaMap]         = useState<Record<string, number>>({});
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [selectedAgent,    setSelectedAgent]    = useState<string>("all");
  const [totalWorkingDays, setTotalWorkingDays] = useState<26 | 22>(26);

  // ── Date range ─────────────────────────────────────────────────────────────
  const { fromDate, toDate } = useMemo(() => {
    let from: Date, to: Date;
    if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
      from = new Date(dateCreatedFilterRange.from);
      to   = new Date(dateCreatedFilterRange.to);
    } else {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { fromDate: from, toDate: to };
  }, [dateCreatedFilterRange]);

  const year = fromDate.getFullYear().toString();

  // ── Fetch (no row limits — server paginates) ───────────────────────────────
  const fetchData = useCallback(async () => {
    if (!referenceid) return;
    setLoading(true);
    setError(null);
    try {
      const fromStr = toLocalDateStr(fromDate);
      const toStr   = toLocalDateStr(toDate);
      const tsm     = encodeURIComponent(referenceid);

      // 1. SI raw records + agents — tsm-history-si now returns records[] and agents[]
      const [siRes, quotaRes] = await Promise.all([
        fetch(`/api/tsm-history-si?tsm=${tsm}&from=${fromStr}&to=${toStr}`),
        fetch(`/api/tsm-agent-quota?tsm=${tsm}&year=${encodeURIComponent(year)}`),
      ]);

      if (!siRes.ok) throw new Error("Failed to fetch SI data");
      const siData = await siRes.json();
      setSiRecords(siData.records ?? []);
      setAgents(siData.agents ?? []);

      // 2. Quota — quotas is { [referenceid]: { [month]: amount } }
      // Pick the month matching fromDate
      if (quotaRes.ok) {
        const quotaData = await quotaRes.json();
        const qMap: Record<string, number> = {};
        const quotas: Record<string, Record<string, number>> = quotaData.quotas ?? {};
        const month = MONTHS[fromDate.getMonth()];
        for (const [refId, monthMap] of Object.entries(quotas)) {
          // Use the specific month's quota
          qMap[refId] = (monthMap as Record<string, number>)[month] ?? 0;
        }
        setQuotaMap(qMap);
      }
    } catch (err: any) {
      setError(err.message ?? "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [referenceid, fromDate, toDate, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Working days ───────────────────────────────────────────────────────────
  const workingDaysSoFar = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const rangeEnd = toDate < today ? toDate : today;
    if (fromDate > rangeEnd) return 0;
    return countWorkingDays(fromDate, rangeEnd);
  }, [fromDate, toDate]);

  const parPercentage    = (workingDaysSoFar / totalWorkingDays) * 100;
  const hasDateRange     = !!(dateCreatedFilterRange?.from && dateCreatedFilterRange?.to);

  // Full-month quota = sum of months in the selected year range
  // For the selected date range, we prorate by working days
  const getProratedQuota = (full: number) =>
    hasDateRange ? Math.round((full / totalWorkingDays) * workingDaysSoFar) : full;

  // ── Per-agent aggregation from raw SI records ──────────────────────────────
  const salesDataPerAgent = useMemo(() => {
    const fromTime = fromDate.getTime();
    const toTime   = toDate.getTime();

    const salesByAgent: Record<string, number> = {};
    for (const r of siRecords) {
      if (!r.delivery_date) continue;
      const t = new Date(r.delivery_date).getTime();
      if (t < fromTime || t > toTime) continue;
      salesByAgent[r.referenceid] = (salesByAgent[r.referenceid] ?? 0) + (Number(r.actual_sales) || 0);
    }

    // Use the month of fromDate to get per-month quota

    return agents.map((agent) => {
      const totalActualSales = salesByAgent[agent.referenceid] ?? 0;
      const fullMonthQuota   = quotaMap[agent.referenceid] ?? 0;
      const proratedQuota    = getProratedQuota(fullMonthQuota);
      const variance         = proratedQuota - totalActualSales;
      const achievement      = proratedQuota > 0 ? (totalActualSales / proratedQuota) * 100 : 0;

      return {
        agentId:          agent.referenceid,
        agentName:        agent.name,
        totalActualSales,
        fullMonthQuota,
        proratedQuota,
        variance,
        parPercentage,
        percentToPlan: Math.round(achievement),
      };
    });
  }, [agents, siRecords, quotaMap, fromDate, toDate, totalWorkingDays, workingDaysSoFar]);

  const filteredSalesData = useMemo(() =>
    selectedAgent === "all"
      ? salesDataPerAgent
      : salesDataPerAgent.filter((d) => d.agentId.toLowerCase() === selectedAgent.toLowerCase()),
    [salesDataPerAgent, selectedAgent]);

  const columnTotals = useMemo(() =>
    filteredSalesData.reduce(
      (acc, d) => ({
        proratedQuota:    acc.proratedQuota    + d.proratedQuota,
        totalActualSales: acc.totalActualSales + d.totalActualSales,
        variance:         acc.variance         + d.variance,
      }),
      { proratedQuota: 0, totalActualSales: 0, variance: 0 }
    ), [filteredSalesData]);

  // ── Daily chart ────────────────────────────────────────────────────────────
  const agentNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of agents) m[a.referenceid.toLowerCase()] = a.name;
    return m;
  }, [agents]);

  const dailyChartData = useMemo(() => {
    const totalFullQuota = filteredSalesData.reduce((s, d) => s + d.fullMonthQuota, 0);
    const dailyQuota     = totalWorkingDays > 0 ? totalFullQuota / totalWorkingDays : 0;
    const agentDailyQ: Record<string, number> = {};
    for (const d of salesDataPerAgent)
      agentDailyQ[d.agentId.toLowerCase()] = totalWorkingDays > 0 ? d.fullMonthQuota / totalWorkingDays : 0;

    const days: any[] = [];
    const cursor = new Date(fromDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
      if (cursor.getDay() !== 0) {
        const dateStr = toLocalDateStr(cursor);
        const label   = cursor.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
        const agentSales: Record<string, number> = {};
        let dayTotal = 0;

        siRecords
          .filter((r) => {
            if (!r.delivery_date) return false;
            if (selectedAgent !== "all" && r.referenceid.toLowerCase() !== selectedAgent.toLowerCase()) return false;
            return toLocalDateStr(new Date(r.delivery_date)) === dateStr;
          })
          .forEach((r) => {
            const key = r.referenceid.toLowerCase();
            agentSales[key] = (agentSales[key] ?? 0) + (Number(r.actual_sales) || 0);
            dayTotal += Number(r.actual_sales) || 0;
          });

        const agentsBreakdown = Object.entries(agentSales).map(([refId, sales]) => ({
          name: agentNameMap[refId] || refId,
          sales,
          dailyQuota: Math.round(agentDailyQ[refId] ?? 0),
          hit: sales >= (agentDailyQ[refId] ?? 0),
        }));

        days.push({ date: label, actualSales: dayTotal, dailyQuota: Math.round(dailyQuota), agentsBreakdown });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [fromDate, toDate, siRecords, salesDataPerAgent, filteredSalesData, totalWorkingDays, selectedAgent, agentNameMap]);

  // ── Excel export ───────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    if (!filteredSalesData.length) { alert("No data to export"); return; }
    try {
      const workbook  = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sales Performance");
      worksheet.columns = [
        { header: "Agent",        key: "agent",         width: 25 },
        { header: "Target Quota", key: "targetQuota",   width: 15 },
        { header: "Total Sales",  key: "totalSales",    width: 15 },
        { header: "Variance",     key: "variance",      width: 15 },
        { header: "Par",          key: "par",           width: 10 },
        { header: "% To Plan",    key: "percentToPlan", width: 12 },
      ];
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      filteredSalesData.forEach((item) => {
        worksheet.addRow({ agent: item.agentName, targetQuota: item.proratedQuota,
          totalSales: item.totalActualSales, variance: item.variance,
          par: parPercentage, percentToPlan: item.percentToPlan });
      });
      const totalsRow = worksheet.addRow({ agent: "TOTAL", targetQuota: columnTotals.proratedQuota,
        totalSales: columnTotals.totalActualSales, variance: columnTotals.variance, par: "", percentToPlan: "" });
      totalsRow.font = { bold: true };
      ["targetQuota","totalSales","variance"].forEach((k) => { worksheet.getColumn(k).numFmt = '#,##0.00" ₱"'; });
      worksheet.getColumn("par").numFmt = '0.00"%"';
      worksheet.getColumn("percentToPlan").numFmt = '0"%"';

      let filename = "Sales_Performance";
      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        const f = new Date(dateCreatedFilterRange.from).toLocaleDateString().replace(/\//g, "-");
        const t = new Date(dateCreatedFilterRange.to).toLocaleDateString().replace(/\//g, "-");
        filename += `_${f}_to_${t}`;
      }
      filename += ".xlsx";
      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = window.URL.createObjectURL(blob);
      const link   = document.createElement("a");
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (err) { console.error("Export error:", err); alert("Failed to export"); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center items-center h-40"><Spinner className="size-8" /></div>;
  if (error) return (
    <Alert variant="destructive" className="flex items-center space-x-3 p-4 text-xs">
      <AlertCircleIcon className="h-6 w-6 text-red-600" />
      <div><AlertTitle>Error Loading Data</AlertTitle><AlertDescription>{error}</AlertDescription></div>
    </Alert>
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-[220px] text-xs"><SelectValue placeholder="Filter by Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.referenceid} value={a.referenceid}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(totalWorkingDays)} onValueChange={(v) => setTotalWorkingDays(Number(v) as 26 | 22)}>
          <SelectTrigger className="w-[180px] text-xs"><SelectValue placeholder="Working Days" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="26">26 Working Days (Mon–Sat)</SelectItem>
            <SelectItem value="22">22 Working Days (Mon–Fri)</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-gray-500">
          Days elapsed: <strong>{workingDaysSoFar}</strong> / {totalWorkingDays} &nbsp;|&nbsp;
          Par: <strong>{parPercentage.toFixed(1)}%</strong>
        </span>

        <button onClick={exportToExcel}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          <Download size={14} /> Export Excel
        </button>
      </div>

      {/* Sales Metrics Table */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Sales Metrics</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Agent</TableHead>
              <TableHead className="text-xs">Target Quota</TableHead>
              <TableHead className="text-xs text-right">Total Sales Invoice</TableHead>
              <TableHead className="text-xs">Variance</TableHead>
              <TableHead className="text-xs">Par</TableHead>
              <TableHead className="text-xs">% To Plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSalesData.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-gray-400 py-8">No data available</TableCell></TableRow>
            ) : filteredSalesData.map(({ agentId, agentName, totalActualSales, proratedQuota, variance, percentToPlan }) => (
              <TableRow key={agentId} className="hover:bg-muted/30 text-xs">
                <TableCell className="capitalize">{agentName}</TableCell>
                <TableCell>{proratedQuota.toLocaleString(undefined, { style: "currency", currency: "PHP" })}</TableCell>
                <TableCell className="text-right">{totalActualSales.toLocaleString(undefined, { style: "currency", currency: "PHP" })}</TableCell>
                <TableCell className={variance > 0 ? "text-red-500" : "text-green-600"}>
                  {variance.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
                </TableCell>
                <TableCell>{parPercentage.toFixed(2)}%</TableCell>
                <TableCell>{percentToPlan}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-gray-50 font-semibold text-xs">
              <TableCell className="font-bold">Total</TableCell>
              <TableCell>{columnTotals.proratedQuota.toLocaleString(undefined, { style: "currency", currency: "PHP" })}</TableCell>
              <TableCell className="text-right">{columnTotals.totalActualSales.toLocaleString(undefined, { style: "currency", currency: "PHP" })}</TableCell>
              <TableCell className={columnTotals.variance > 0 ? "text-red-500" : "text-green-600"}>
                {columnTotals.variance.toLocaleString(undefined, { style: "currency", currency: "PHP" })}
              </TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Daily Sales Trend Chart */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-1">Daily Sales Trend</h2>
        <p className="text-xs text-gray-400 mb-4">
          Bar shows actual sales per working day vs. daily quota target (dashed line).
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-500"></span> Hit
            <span className="inline-block w-3 h-3 rounded-sm bg-red-400 ml-2"></span> Missed
          </span>
        </p>
        {dailyChartData.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-8">No data for selected range</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyChartData} margin={{ top: 8, right: 16, left: 16, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) =>
                v >= 1_000_000 ? `₱${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `₱${(v/1_000).toFixed(0)}K` : `₱${v}`} />
              <Tooltip content={<CustomDailyTooltip />} />
              <ReferenceLine y={dailyChartData[0]?.dailyQuota ?? 0} stroke="#6366f1"
                strokeDasharray="5 4" strokeWidth={1.5}
                label={{ value: "Daily Quota", position: "insideTopRight", fontSize: 10, fill: "#6366f1" }} />
              <Bar dataKey="actualSales" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {dailyChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.actualSales >= entry.dailyQuota ? "#22c55e" : "#f87171"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Computation Explanation */}
      <div className="rounded-md border p-4 bg-white shadow-sm font-mono">
        <h2 className="font-semibold text-sm mb-4">Computation Explanation</h2>
        <div className="text-xs space-y-3 text-gray-700">
          <p><strong>Target Quota:</strong> Monthly quota for the selected month. With a date filter, prorated by working days elapsed.<br />
            <code>Pro-rated Quota = (Monthly Quota / Total Working Days) × Working Days Elapsed</code></p>
          <p><strong>Total Sales Invoice:</strong> Sum of <code>actual_sales</code> from <code>Delivered / Closed Transaction</code> records within the selected date range. Fetched without row limits via server-side pagination.</p>
          <p><strong>Par:</strong> Expected progress based on working days elapsed.<br />
            <code>Par = (Working Days Elapsed / Total Working Days) × 100%</code></p>
          <p><strong>Variance:</strong> Positive (red) = below target; Negative (green) = above target.<br />
            <code>Variance = Target Quota − Total Actual Sales</code></p>
        </div>
      </div>
    </div>
  );
};

export default SalesTable;
