"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Download, Search, AlertTriangle, CheckCircle2, Users, TrendingUp } from "lucide-react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import ExcelJS from "exceljs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriorityRow {
  account_reference_number: string;
  company_name: string;
  agent_referenceid: string;
  agent_name: string;
  last_ob_date: string | null;
  days_since_last_call: number | null;
  total_sales_last3months: number;
  tx_count_last3months: number;
  forecast_amount: number;
  current_month_sales: number;
  priority_score: number;
}

interface ClearedRow {
  account_reference_number: string;
  company_name: string;
  agent_referenceid: string;
  agent_name: string;
  ob_date_this_month: string | null;
}

interface AgentItem { referenceid: string; name: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPeso(n: number) {
  return n.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function priorityColor(score: number) {
  if (score >= 8) return "bg-red-100 text-red-700 border-red-300";
  if (score >= 5) return "bg-orange-100 text-orange-700 border-orange-300";
  return "bg-yellow-100 text-yellow-700 border-yellow-300";
}

function ForecastBar({ current, forecast }: { current: number; forecast: number }) {
  const pct = forecast > 0 ? Math.min(Math.round((current / forecast) * 100), 100) : 0;
  const color = pct >= 100 ? "#16a34a" : pct >= 50 ? "#3b82f6" : "#f59e0b";
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
        <span>{fmtPeso(current)} achieved</span><span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 h-1.5 rounded-full">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <Card className="bg-white">
      <CardContent className="p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</span>
          <span className="text-gray-400">{icon}</span>
        </div>
        <span className="text-2xl font-black text-gray-900">{value}</span>
        {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
      </CardContent>
    </Card>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function Top50Content() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [tsmRef, setTsmRef] = useState("");
  const [tsmName, setTsmName] = useState("");
  const [rows, setRows] = useState<PriorityRow[]>([]);
  const [clearedRows, setClearedRows] = useState<ClearedRow[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [totalTop50, setTotalTop50] = useState(0);
  const [clearedCount, setClearedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "cleared">("pending");

  // filters
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [scoreFilter, setScoreFilter] = useState<[number, number]>([1, 10]);
  const [daysFilter, setDaysFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<keyof PriorityRow>("priority_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  // cleared tab filters
  const [clearedSearch, setClearedSearch] = useState("");
  const [clearedPage, setClearedPage] = useState(1);

  // Fetch user → tsmRef
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ReferenceID) {
          setTsmRef(data.ReferenceID);
          setTsmName(`${data.Firstname ?? ""} ${data.Lastname ?? ""}`.trim());
        }
      }).catch(() => {});
  }, [userId]);

  const fetchData = useCallback(async () => {
    if (!tsmRef) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/tsm-top50-priority?tsm=${encodeURIComponent(tsmRef)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRows(data.rows ?? []);
      setClearedRows(data.clearedRows ?? []);
      setAgents(data.agents ?? []);
      setTotalTop50(data.totalTop50 ?? 0);
      setClearedCount(data.clearedCount ?? 0);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error("[Top50Page]", err);
      setFetchError(err.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [tsmRef]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── NO auto-refresh — manual Refresh button only ────────────────────────

  // ── Filtered + sorted rows ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(row =>
        row.company_name.toLowerCase().includes(q) ||
        row.agent_name.toLowerCase().includes(q) ||
        row.account_reference_number.toLowerCase().includes(q)
      );
    }
    if (agentFilter.length > 0) r = r.filter(row => agentFilter.includes(row.agent_referenceid));
    r = r.filter(row => row.priority_score >= scoreFilter[0] && row.priority_score <= scoreFilter[1]);
    if (daysFilter !== "all") {
      r = r.filter(row => {
        const d = row.days_since_last_call;
        if (daysFilter === "0-7")  return d !== null && d <= 7;
        if (daysFilter === "8-14") return d !== null && d >= 8  && d <= 14;
        if (daysFilter === "15-30")return d !== null && d >= 15 && d <= 30;
        if (daysFilter === ">30")  return d === null || d > 30;
        return true;
      });
    }
    return [...r].sort((a, b) => {
      const av = a[sortCol] as any, bv = b[sortCol] as any;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [rows, search, agentFilter, scoreFilter, daysFilter, sortCol, sortDir]);

  // Reset to page 1 when filters/sort change
  useEffect(() => { setPage(1); }, [search, agentFilter, scoreFilter, daysFilter, sortCol, sortDir]);

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Cleared tab ─────────────────────────────────────────────────────────
  const filteredCleared = useMemo(() => {
    if (!clearedSearch.trim()) return clearedRows;
    const q = clearedSearch.toLowerCase();
    return clearedRows.filter(r =>
      r.company_name.toLowerCase().includes(q) ||
      r.agent_name.toLowerCase().includes(q)
    );
  }, [clearedRows, clearedSearch]);

  useEffect(() => { setClearedPage(1); }, [clearedSearch]);

  const totalClearedPages = Math.max(1, Math.ceil(filteredCleared.length / PAGE_SIZE));
  const paginatedCleared  = filteredCleared.slice((clearedPage - 1) * PAGE_SIZE, clearedPage * PAGE_SIZE);

  // ── KPI totals ──────────────────────────────────────────────────────────
  const totalForecast = filtered.reduce((s, r) => s + r.forecast_amount, 0);
  const uniqueAgents  = new Set(filtered.map(r => r.agent_referenceid)).size;
  const pctCleared    = totalTop50 > 0 ? Math.round((clearedCount / totalTop50) * 100) : 0;

  // ── Sort toggle ─────────────────────────────────────────────────────────
  const toggleSort = (col: keyof PriorityRow) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };
  const sortIcon = (col: keyof PriorityRow) =>
    sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  // ── Excel export ────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Top 50 Priority");
    ws.columns = [
      { header: "Client Name",           key: "company_name",            width: 30 },
      { header: "Assigned Agent",        key: "agent_name",              width: 22 },
      { header: "Agent Ref #",           key: "agent_referenceid",       width: 16 },
      { header: "Account Ref #",         key: "account_reference_number",width: 20 },
      { header: "Last OB Call",          key: "last_ob_date",            width: 16 },
      { header: "Days Since Last Call",  key: "days_since_last_call",    width: 18 },
      { header: "Sales Last 3M (PHP)",   key: "total_sales_last3months", width: 20 },
      { header: "Txn Count Last 3M",     key: "tx_count_last3months",    width: 16 },
      { header: "Forecast This Month",   key: "forecast_amount",         width: 20 },
      { header: "Achieved This Month",   key: "current_month_sales",     width: 20 },
      { header: "Priority Score",        key: "priority_score",          width: 14 },
    ];
    const hr = ws.getRow(1);
    hr.font = { bold: true };
    hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    filtered.forEach(row => {
      ws.addRow({
        ...row,
        last_ob_date: row.last_ob_date ? new Date(row.last_ob_date).toLocaleDateString("en-PH") : "NEVER CALLED",
        days_since_last_call: row.days_since_last_call ?? "N/A",
      });
    });
    // metadata row
    ws.addRow([]);
    ws.addRow({ company_name: `TSM: ${tsmName}`, agent_name: `Generated: ${new Date().toLocaleString("en-PH")}` });

    const buf = await wb.xlsx.writeBuffer();
    const blobUrl = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `Top50Priority_${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">
        <GlobalTopBar
          title="🎯 Top 50 Priority"
          rightExtra={
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="text-xs h-7 gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportExcel} disabled={filtered.length === 0} className="text-xs h-7 gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            </div>
          }
        />

        <div className="flex flex-col gap-4 p-4 overflow-y-auto">
          {/* Page subtitle */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">TSM: {tsmName || tsmRef}</span>
            <span>·</span>
            <span className="text-red-600 font-semibold">{filtered.length} pending clients</span>
            <span>·</span>
            <span>{agents.length} agents</span>
            <span>·</span>
            <span className="bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
              No OB Call — {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Manila" })}
            </span>
            {lastRefreshed && <><span>·</span><span className="text-gray-400">As of {lastRefreshed.toLocaleTimeString("en-PH")}</span></>}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Pending Top 50" value={String(filtered.length)}
              sub={`${totalTop50} total in team`} icon={<AlertTriangle className="w-4 h-4 text-red-400" />} />
            <KpiCard label="Agents with Pending" value={String(uniqueAgents)}
              sub={`of ${agents.length} agents`} icon={<Users className="w-4 h-4 text-orange-400" />} />
            <KpiCard label="Total Forecast" value={fmtPeso(totalForecast)}
              sub="Sum of pending clients" icon={<TrendingUp className="w-4 h-4 text-blue-400" />} />
            <KpiCard label="% Cleared" value={`${pctCleared}%`}
              sub={`${clearedCount} of ${totalTop50} done`} icon={<CheckCircle2 className="w-4 h-4 text-green-500" />} />
          </div>

          {/* ── Tab bar ── */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("pending")}
              className={[
                "px-5 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors",
                activeTab === "pending"
                  ? "border-red-500 text-red-600"
                  : "border-transparent text-gray-400 hover:text-gray-600",
              ].join(" ")}
            >
              🔴 Pending ({rows.length})
            </button>
            <button
              onClick={() => setActiveTab("cleared")}
              className={[
                "px-5 py-2.5 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-colors",
                activeTab === "cleared"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-400 hover:text-gray-600",
              ].join(" ")}
            >
              ✅ Completed This Month ({clearedRows.length})
            </button>
          </div>

          {/* ── PENDING tab ── */}
          {activeTab === "pending" && (<>
          {/* Filters row */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search client / agent…"
                className="pl-8 h-8 text-xs rounded-none w-56" />
            </div>

            {/* Agent multi-select */}
            <select
              className="h-8 text-xs border border-gray-200 rounded-none px-2 bg-white max-w-[180px]"
              value={agentFilter.length === 1 ? agentFilter[0] : ""}
              onChange={e => setAgentFilter(e.target.value ? [e.target.value] : [])}
            >
              <option value="">All Agents</option>
              {agents.map(a => <option key={a.referenceid} value={a.referenceid}>{a.name}</option>)}
            </select>

            {/* Priority filter */}
            <select className="h-8 text-xs border border-gray-200 rounded-none px-2 bg-white"
              onChange={e => {
                const v = e.target.value;
                if (v === "high")   setScoreFilter([8, 10]);
                else if (v === "mid") setScoreFilter([5, 7]);
                else if (v === "low") setScoreFilter([1, 4]);
                else setScoreFilter([1, 10]);
              }}>
              <option value="">All Priority</option>
              <option value="high">🔴 High (8–10)</option>
              <option value="mid">🟠 Medium (5–7)</option>
              <option value="low">🟡 Low (1–4)</option>
            </select>

            {/* Days since last call */}
            <select className="h-8 text-xs border border-gray-200 rounded-none px-2 bg-white"
              value={daysFilter} onChange={e => setDaysFilter(e.target.value)}>
              <option value="all">All Days</option>
              <option value="0-7">0–7 days</option>
              <option value="8-14">8–14 days</option>
              <option value="15-30">15–30 days</option>
              <option value=">30">&gt;30 days / Never</option>
            </select>

            {(search || agentFilter.length > 0 || daysFilter !== "all" || scoreFilter[0] !== 1 || scoreFilter[1] !== 10) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500"
                onClick={() => { setSearch(""); setAgentFilter([]); setScoreFilter([1, 10]); setDaysFilter("all"); }}>
                Reset Filters
              </Button>
            )}
          </div>

          {/* Table / empty states */}
          {fetchError ? (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-none text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span><strong>Error:</strong> {fetchError}</span>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-xs text-gray-400">
              <Spinner className="w-5 h-5" /> Loading Top 50 priority data…
            </div>
          ) : filtered.length === 0 && rows.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
              <p className="text-sm font-bold text-green-700">🎉 All Top 50 clients already have Outbound Calls this month!</p>
              <p className="text-xs text-gray-400">Your team is fully covered. Check back next month.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-xs text-gray-400">
              No rows match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 w-8">#</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 cursor-pointer whitespace-nowrap hover:text-gray-800 min-w-[180px]"
                      onClick={() => toggleSort("company_name")}>Client Name{sortIcon("company_name")}</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 cursor-pointer whitespace-nowrap hover:text-gray-800"
                      onClick={() => toggleSort("agent_name")}>Assigned Agent{sortIcon("agent_name")}</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 cursor-pointer whitespace-nowrap hover:text-gray-800"
                      onClick={() => toggleSort("days_since_last_call")}>Last OB Call{sortIcon("days_since_last_call")}</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Prev Transactions</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 cursor-pointer whitespace-nowrap hover:text-gray-800 min-w-[160px]"
                      onClick={() => toggleSort("forecast_amount")}>📊 Forecast{sortIcon("forecast_amount")}</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 cursor-pointer whitespace-nowrap hover:text-gray-800"
                      onClick={() => toggleSort("priority_score")}>Priority{sortIcon("priority_score")}</th>
                    <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((row, idx) => (
                    <tr key={row.account_reference_number} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-3 text-gray-400 font-mono">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-3 py-3 font-semibold text-gray-800">{row.company_name}</td>
                      <td className="px-3 py-3">
                        <div className="text-gray-700 font-medium">{row.agent_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{row.agent_referenceid}</div>
                      </td>
                      <td className="px-3 py-3">
                        {row.last_ob_date ? (
                          <>
                            <div className="text-gray-700">{fmtDate(row.last_ob_date)}</div>
                            <div className="text-[10px] text-gray-400">{row.days_since_last_call}d ago</div>
                          </>
                        ) : (
                          <span className="text-red-600 font-bold text-[11px]">⚠️ NEVER CALLED</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-gray-700 font-semibold">{fmtPeso(row.total_sales_last3months)}</div>
                        <div className="text-[10px] text-gray-400">{row.tx_count_last3months} txn{row.tx_count_last3months !== 1 ? "s" : ""} last 3mo</div>
                      </td>
                      <td className="px-3 py-3 min-w-[160px]">
                        {row.forecast_amount > 0 ? (
                          <>
                            <div className="font-bold text-blue-700">{fmtPeso(row.forecast_amount)}</div>
                            <ForecastBar current={row.current_month_sales} forecast={row.forecast_amount} />
                          </>
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">No prior sales</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={`text-[11px] font-black border ${priorityColor(row.priority_score)}`}>
                          {row.priority_score}/10
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge className="bg-red-100 text-red-700 border border-red-300 text-[9px] font-bold whitespace-nowrap">
                          🔴 NO OB CALL
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <span>
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} pending clients
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                  disabled={page === 1} onClick={() => setPage(1)}>«</Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                  disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</Button>
                {/* Page number pills */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-gray-400">…</span>
                    ) : (
                      <Button key={p} variant={page === p ? "default" : "outline"} size="sm"
                        className={`h-7 w-7 p-0 text-xs rounded-none ${page === p ? "bg-gray-900 text-white" : ""}`}
                        onClick={() => setPage(p as number)}>
                        {p}
                      </Button>
                    )
                  )}
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                  disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</Button>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                  disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
              </div>
            </div>
          )}
          {/* end PENDING tab */}
          </>)}

          {/* ── CLEARED tab ── */}
          {activeTab === "cleared" && (<>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input value={clearedSearch} onChange={e => setClearedSearch(e.target.value)}
                placeholder="Search client / agent…"
                className="pl-8 h-8 text-xs rounded-none" />
            </div>

            {filteredCleared.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <CheckCircle2 className="w-10 h-10 text-gray-300" />
                <p className="text-xs text-gray-400">No Top 50 clients have been called yet this month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-green-50 border-b border-green-200 text-left">
                      <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 w-8">#</th>
                      <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 min-w-[180px]">Client Name</th>
                      <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500">Assigned Agent</th>
                      <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">OB Call Date (This Month)</th>
                      <th className="px-3 py-3 font-bold uppercase tracking-wider text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedCleared.map((row, idx) => (
                      <tr key={row.account_reference_number} className="hover:bg-green-50/40 transition-colors">
                        <td className="px-3 py-3 text-gray-400 font-mono">{(clearedPage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-3 py-3 font-semibold text-gray-800">{row.company_name}</td>
                        <td className="px-3 py-3">
                          <div className="text-gray-700 font-medium">{row.agent_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{row.agent_referenceid}</div>
                        </td>
                        <td className="px-3 py-3 text-green-700 font-semibold">
                          {row.ob_date_this_month ? fmtDate(row.ob_date_this_month) : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge className="bg-green-100 text-green-700 border border-green-300 text-[9px] font-bold whitespace-nowrap">
                            ✅ OB CALL DONE
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filteredCleared.length > PAGE_SIZE && (
              <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                <span>
                  Showing {Math.min((clearedPage - 1) * PAGE_SIZE + 1, filteredCleared.length)}–{Math.min(clearedPage * PAGE_SIZE, filteredCleared.length)} of {filteredCleared.length} completed
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                    disabled={clearedPage === 1} onClick={() => setClearedPage(1)}>«</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                    disabled={clearedPage === 1} onClick={() => setClearedPage(p => p - 1)}>‹ Prev</Button>
                  {Array.from({ length: totalClearedPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalClearedPages || Math.abs(p - clearedPage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, i, arr) => {
                      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span key={`ec-${i}`} className="px-1 text-gray-400">…</span>
                      ) : (
                        <Button key={p} variant={clearedPage === p ? "default" : "outline"} size="sm"
                          className={`h-7 w-7 p-0 text-xs rounded-none ${clearedPage === p ? "bg-gray-900 text-white" : ""}`}
                          onClick={() => setClearedPage(p as number)}>{p}</Button>
                      )
                    )}
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                    disabled={clearedPage === totalClearedPages} onClick={() => setClearedPage(p => p + 1)}>Next ›</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs rounded-none"
                    disabled={clearedPage === totalClearedPages} onClick={() => setClearedPage(totalClearedPages)}>»</Button>
                </div>
              </div>
            )}
          </>)}
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><Spinner className="w-8 h-8" /></div>}>
            <Top50Content />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
