"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { ArrowLeft, Loader2, Info, Download, Settings2, X, Eye, EyeOff, Tag, Columns3, Users } from "lucide-react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";
import ExcelJS from "exceljs";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent        { referenceid: string; name: string; picture: string; }
interface HistoryItem  {
  referenceid: string; source: string; call_status: string; status: string;
  type_activity: string; actual_sales?: number | string; quotation_amount?: number | string;
  so_amount?: number | string; start_date: string; end_date: string;
  date_created: string; activity_reference_number: string;
}

type TabKey = "ob_calls" | "target" | "touchbase" | "outbound_history";

const MONTHS       = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTarget(val: string): number {
  const s = val.trim().replace(/,/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
}

const pct = (num: number, den: number) => den > 0 ? ((num / den) * 100).toFixed(2) + "%" : "0.00%";

function formatDurationMs(ms: number) {
  if (ms <= 0) return "-";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`, sec > 0 && `${sec}s`].filter(Boolean).join(" ") || "0s";
}

const isFinitePositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "ob_calls",         label: "OB Calls"        },
  { key: "target",           label: "Target"           },
  { key: "touchbase",        label: "Touchbase"        },
  { key: "outbound_history", label: "Outbound History" },
];

function TabBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <div className="flex items-center border-b border-gray-200 bg-white px-4 gap-0">
      {TABS.map((tab) => (
        <button key={tab.key} type="button" onClick={() => onChange(tab.key)}
          className={["px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px",
            active === tab.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600",
          ].join(" ")}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── OB Calls tab ─────────────────────────────────────────────────────────────

function ObCallsTab({ agents, obMap, year, loading }: {
  agents: Agent[]; obMap: Record<string, Record<string, number>>; year: string; loading: boolean;
}) {
  const getVal      = (id: string, m: string)  => obMap[id]?.[m] ?? 0;
  const agentTotal  = (id: string)              => MONTHS.reduce((s, m) => s + getVal(id, m), 0);
  const monthTotal  = (m: string)               => agents.reduce((s, a) => s + getVal(a.referenceid, m), 0);
  const grandTotal  = agents.reduce((s, a) => s + agentTotal(a.referenceid), 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">OB Calls Breakdown — {year}</p>
          <p className="text-xs text-gray-400 mt-0.5">Successful Outbound Touchbase calls per agent per month.</p>
        </div>
        {loading && <div className="flex items-center gap-2 text-xs text-gray-400"><Spinner className="w-4 h-4" /> Loading...</div>}
      </div>
      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">Agent</th>
                {MONTH_SHORT.map((m) => <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[60px]">{m}</th>)}
                <th className="text-right px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.length === 0
                ? <tr><td colSpan={14} className="text-center py-12 text-gray-400">No agents found.</td></tr>
                : agents.map((agent) => (
                  <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                      <p className="font-semibold text-gray-800">{agent.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
                    </td>
                    {MONTHS.map((month) => {
                      const val = getVal(agent.referenceid, month);
                      return <td key={month} className="px-2 py-2.5 text-center"><span className={val > 0 ? "font-semibold text-gray-700" : "text-gray-300"}>{val > 0 ? val : "—"}</span></td>;
                    })}
                    <td className="px-4 py-2.5 text-right font-bold text-gray-800">{agentTotal(agent.referenceid) || "—"}</td>
                  </tr>
                ))}
            </tbody>
            {agents.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-3 font-black text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">TOTAL</td>
                  {MONTHS.map((m) => <td key={m} className="px-2 py-3 text-center font-bold text-gray-600">{monthTotal(m) || "—"}</td>)}
                  <td className="px-4 py-3 text-right font-black text-gray-800">{grandTotal || "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Target tab ───────────────────────────────────────────────────────────────

function TargetTab({ agents, targets, year, tsm, manager, loading, onTargetUpdate }: {
  agents: Agent[]; targets: Record<string, Record<string, number>>; year: string;
  tsm: string; manager: string; loading: boolean;
  onTargetUpdate: (referenceid: string, month: string, value: number) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const handleSave = async (referenceid: string, month: string, rawValue: string) => {
    const parsed = parseTarget(rawValue);
    if (isNaN(parsed)) { sileo.error({ title: "Invalid value", description: "Must be a non-negative number.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } }); return; }
    const current = targets[referenceid]?.[month] ?? 0;
    if (parsed === current) return;
    const key = `${referenceid}-${month}`;
    setSaving(key);
    try {
      const res = await fetch("/api/tsm-agent-ob-target", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referenceid, month, year, ob_target: parsed, tsm, manager }) });
      if (!res.ok) throw new Error();
      onTargetUpdate(referenceid, month, parsed);
      sileo.success({ title: "Saved", description: `${month} OB target updated.`, duration: 2000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to save OB target.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setSaving(null); }
  };

  const agentTotal = (id: string) => MONTHS.reduce((s, m) => s + (targets[id]?.[m] ?? 0), 0);
  const monthTotal = (m: string) => agents.reduce((s, a) => s + (targets[a.referenceid]?.[m] ?? 0), 0);
  const grandTotal = agents.reduce((s, a) => s + agentTotal(a.referenceid), 0);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">OB Call Targets — {year}</p>
          <p className="text-xs text-gray-400 mt-0.5">Click any cell and press Enter or Tab to save.</p>
        </div>
        {loading && <div className="flex items-center gap-2 text-xs text-gray-400"><Spinner className="w-4 h-4" /> Loading...</div>}
      </div>
      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">Agent</th>
                {MONTH_SHORT.map((m) => <th key={m} className="text-center px-2 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[80px]">{m}</th>)}
                <th className="text-right px-4 py-3 font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.length === 0
                ? <tr><td colSpan={14} className="text-center py-12 text-gray-400">No agents found.</td></tr>
                : agents.map((agent) => (
                  <tr key={agent.referenceid} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-gray-50/50 z-10 border-r border-gray-100">
                      <p className="font-semibold text-gray-800">{agent.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{agent.referenceid}</p>
                    </td>
                    {MONTHS.map((month) => {
                      const key = `${agent.referenceid}-${month}`;
                      const val = targets[agent.referenceid]?.[month] ?? 0;
                      const busy = saving === key;
                      return (
                        <td key={month} className="px-1 py-1.5 text-center">
                          <div className="relative flex items-center justify-center">
                            {busy && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-blue-400" />}
                            <input type="text" inputMode="numeric" defaultValue={val > 0 ? String(val) : ""} placeholder="—"
                              className="w-full text-center text-xs border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-1 py-1 bg-transparent hover:bg-white focus:bg-white transition-all placeholder:text-gray-300"
                              onBlur={(e) => handleSave(agent.referenceid, month, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                                if (e.key === "Escape") { (e.target as HTMLInputElement).value = val > 0 ? String(val) : ""; (e.target as HTMLInputElement).blur(); }
                              }} />
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-bold text-gray-700">{agentTotal(agent.referenceid) || "—"}</td>
                  </tr>
                ))}
            </tbody>
            {agents.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-3 font-black text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">TOTAL</td>
                  {MONTHS.map((m) => <td key={m} className="px-2 py-3 text-center font-bold text-gray-600">{monthTotal(m) || "—"}</td>)}
                  <td className="px-4 py-3 text-right font-black text-gray-800">{grandTotal || "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Touchbase tab ────────────────────────────────────────────────────────────

function TouchbaseTab({ history, agents, dateRange, perAgentTargets }: {
  history: HistoryItem[]; agents: Agent[];
  dateRange: { from: Date; to: Date };
  perAgentTargets: Record<string, number>;
}) {
  const [showComputation, setShowComputation] = useState(false);
  const [outboundQuota, setOutboundQuota] = useState(20);

  useEffect(() => {
    if (Object.keys(perAgentTargets).length > 0) return;
    fetch("/api/outbound-quota").then(r => r.json()).then(d => { if (isFinitePositive(d?.outbound_quota)) setOutboundQuota(d.outbound_quota); }).catch(() => {});
  }, [perAgentTargets]);

  const agentMap = useMemo(() => {
    const m = new Map<string, { name: string; picture: string }>();
    agents.forEach(a => m.set(a.referenceid.toLowerCase(), { name: a.name, picture: a.picture }));
    return m;
  }, [agents]);

  const successfulOBCalls = useMemo(() =>
    history.filter(h => h.source === "Outbound - Touchbase" && h.call_status === "Successful"),
  [history]);

  const historyByRef = useMemo(() => {
    const m = new Map<string, HistoryItem[]>();
    history.forEach(h => { if (!h.activity_reference_number) return; if (!m.has(h.activity_reference_number)) m.set(h.activity_reference_number, []); m.get(h.activity_reference_number)!.push(h); });
    return m;
  }, [history]);

  const daysCount = useMemo(() => {
    const start = new Date(dateRange.from), end = new Date(dateRange.to);
    let count = 0; const cur = new Date(start);
    while (cur <= end) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1); }
    return count || 22;
  }, [dateRange]);

  const statsByAgent = useMemo(() => {
    const byAgent: Record<string, HistoryItem[]> = {};
    successfulOBCalls.forEach(h => { const id = h.referenceid?.toLowerCase(); if (!id) return; if (!byAgent[id]) byAgent[id] = []; byAgent[id].push(h); });
    return Object.entries(byAgent)
      .filter(([id]) => !["referenceid","agentid"].includes(id) && agentMap.has(id))
      .map(([agentId, obCalls]) => {
        const totalCalls = obCalls.length;
        const obRefNums = new Set(obCalls.map(c => c.activity_reference_number).filter(Boolean));
        const quoteRefs = new Set<string>(), soRefs = new Set<string>(), siRefs = new Set<string>();
        obRefNums.forEach(ref => {
          (historyByRef.get(ref) ?? []).forEach(act => {
            if (act.status === "Quote-Done") quoteRefs.add(ref);
            if (act.status === "SO-Done") soRefs.add(ref);
            if (act.type_activity === "Delivered / Closed Transaction") siRefs.add(ref);
          });
        });
        let quoteAmount = 0, soAmount = 0, actualSales = 0;
        obRefNums.forEach(ref => {
          (historyByRef.get(ref) ?? []).forEach(act => {
            if (act.status === "Quote-Done" && act.quotation_amount) quoteAmount += Number(act.quotation_amount) || 0;
            if (act.status === "SO-Done" && act.so_amount) soAmount += Number(act.so_amount) || 0;
            if (act.type_activity === "Delivered / Closed Transaction" && act.actual_sales) actualSales += Number(act.actual_sales) || 0;
          });
        });
        const agentTarget = perAgentTargets[agentId] ?? perAgentTargets[agentId.toUpperCase()] ?? outboundQuota * daysCount;
        return { agentId, totalCalls, numQuotes: quoteRefs.size, numSO: soRefs.size, numSI: siRefs.size, quoteAmount, soAmount, actualSales, agentTarget, achievement: agentTarget > 0 ? (totalCalls / agentTarget) * 100 : 0 };
      });
  }, [successfulOBCalls, historyByRef, agentMap, perAgentTargets, outboundQuota, daysCount]);

  const totals = useMemo(() => ({
    totalCalls: statsByAgent.reduce((s, a) => s + a.totalCalls, 0),
    numQuotes:  statsByAgent.reduce((s, a) => s + a.numQuotes, 0),
    numSO:      statsByAgent.reduce((s, a) => s + a.numSO, 0),
    numSI:      statsByAgent.reduce((s, a) => s + a.numSI, 0),
    totalTarget:      statsByAgent.reduce((s, a) => s + a.agentTarget, 0),
    totalQuoteAmount: statsByAgent.reduce((s, a) => s + a.quoteAmount, 0),
    totalSoAmount:    statsByAgent.reduce((s, a) => s + a.soAmount, 0),
    totalActualSales: statsByAgent.reduce((s, a) => s + a.actualSales, 0),
  }), [statsByAgent]);

  const exportToExcel = async () => {
    if (!statsByAgent.length) return;
    try {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Outbound Performance");
      ws.columns = [
        { header: "Agent", key: "agent", width: 25 }, { header: "OB Target", key: "target", width: 12 },
        { header: "Successful Calls", key: "calls", width: 15 }, { header: "Achievement (%)", key: "ach", width: 15 },
        { header: "Quotes", key: "quotes", width: 12 }, { header: "Calls→Quote", key: "c2q", width: 15 },
        { header: "Quote Amount", key: "qa", width: 18 }, { header: "SO", key: "so", width: 10 },
        { header: "SO Amount", key: "soa", width: 18 }, { header: "Quote→SO", key: "q2s", width: 15 },
        { header: "SI", key: "si", width: 10 }, { header: "SI Amount", key: "sia", width: 18 }, { header: "SO→SI", key: "s2i", width: 15 },
      ];
      const hr = ws.getRow(1); hr.font = { bold: true }; hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      statsByAgent.forEach(stat => {
        const name = agentMap.get(stat.agentId)?.name ?? stat.agentId;
        ws.addRow({ agent: name, target: stat.agentTarget, calls: stat.totalCalls, ach: stat.achievement / 100, quotes: stat.numQuotes, c2q: Number(pct(stat.numQuotes, stat.totalCalls)) / 100, qa: stat.quoteAmount, so: stat.numSO, soa: stat.soAmount, q2s: Number(pct(stat.numSO, stat.numQuotes)) / 100, si: stat.numSI, sia: stat.actualSales, s2i: Number(pct(stat.numSI, stat.numSO)) / 100 });
      });
      const tr = ws.addRow({ agent: "TOTAL", target: totals.totalTarget, calls: totals.totalCalls, ach: Number(pct(totals.totalCalls, totals.totalTarget)) / 100, quotes: totals.numQuotes, c2q: Number(pct(totals.numQuotes, totals.totalCalls)) / 100, qa: totals.totalQuoteAmount, so: totals.numSO, soa: totals.totalSoAmount, q2s: Number(pct(totals.numSO, totals.numQuotes)) / 100, si: totals.numSI, sia: totals.totalActualSales, s2i: Number(pct(totals.numSI, totals.numSO)) / 100 });
      tr.font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      const url = window.URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `Touchbase_${new Date().toISOString().split("T")[0]}.xlsx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch {}
  };

  const convBadge = (n: number) => <span className="ml-1 text-green-600 text-[12px] font-medium">{n}</span>;

  return (
    <div className="p-4">
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Outbound Calls (Touchbase)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Based on <span className="font-medium text-gray-500">Outbound – Touchbase · Successful</span> calls only</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!statsByAgent.length} className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"><Download className="w-3.5 h-3.5" />Export</Button>
              <Button variant="outline" size="sm" onClick={() => setShowComputation(v => !v)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"><Info className="w-3.5 h-3.5" />{showComputation ? "Hide" : "Details"}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {statsByAgent.length === 0
            ? <div className="flex items-center justify-center py-10 text-xs text-gray-400">No outbound records found.</div>
            : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 text-[11px]">
                      <TableHead className="text-gray-500">Agent</TableHead>
                      <TableHead className="text-gray-500 text-center">OB Target</TableHead>
                      <TableHead className="text-gray-500 text-center">Successful Calls</TableHead>
                      <TableHead className="text-gray-500 text-center">Achievement</TableHead>
                      <TableHead className="text-gray-500 text-center whitespace-normal max-w-[120px]">Quote Based on OB Successful</TableHead>
                      <TableHead className="text-gray-500 text-center">Calls → Quote</TableHead>
                      <TableHead className="text-gray-500 text-center">Quote Amount</TableHead>
                      <TableHead className="text-gray-500 text-center whitespace-normal max-w-[120px]">SO Based on OB Successful</TableHead>
                      <TableHead className="text-gray-500 text-center">SO Amount</TableHead>
                      <TableHead className="text-gray-500 text-center">Quote → SO</TableHead>
                      <TableHead className="text-gray-500 text-center whitespace-normal max-w-[120px]">SI Based on OB Successful</TableHead>
                      <TableHead className="text-gray-500 text-center">SI Amount</TableHead>
                      <TableHead className="text-gray-500 text-center">SO → SI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statsByAgent.map(stat => {
                      const info = agentMap.get(stat.agentId)!;
                      return (
                        <TableRow key={stat.agentId} className="text-xs hover:bg-gray-50/50 font-mono">
                          <TableCell><div className="flex items-center gap-2">{info?.picture ? <img src={info.picture} alt={info.name} className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{info?.name?.[0] ?? "?"}</div>}<span className="capitalize text-gray-700">{info?.name}</span></div></TableCell>
                          <TableCell className="text-center text-gray-600">{stat.agentTarget}</TableCell>
                          <TableCell className="text-center font-semibold text-gray-800">{stat.totalCalls}</TableCell>
                          <TableCell className="text-center"><span className={`font-semibold ${stat.achievement >= 100 ? "text-green-600" : stat.achievement >= 70 ? "text-amber-500" : "text-red-500"}`}>{stat.achievement.toFixed(2)}%</span></TableCell>
                          <TableCell className="text-center font-bold">{convBadge(stat.numQuotes)}</TableCell>
                          <TableCell className="text-center text-gray-700">{pct(stat.numQuotes, stat.totalCalls)}</TableCell>
                          <TableCell className="text-center font-semibold text-green-600">₱{stat.quoteAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-bold">{convBadge(stat.numSO)}</TableCell>
                          <TableCell className="text-center font-semibold text-blue-600">₱{stat.soAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-center text-gray-700">{pct(stat.numSO, stat.numQuotes)}</TableCell>
                          <TableCell className="text-center font-bold">{convBadge(stat.numSI)}</TableCell>
                          <TableCell className="text-center font-semibold text-emerald-600">₱{stat.actualSales.toLocaleString()}</TableCell>
                          <TableCell className="text-center text-gray-700">{pct(stat.numSI, stat.numSO)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-gray-50 text-xs font-semibold font-mono">
                      <TableCell className="text-gray-700">Total</TableCell>
                      <TableCell className="text-center text-gray-600">{totals.totalTarget}</TableCell>
                      <TableCell className="text-center text-gray-800">{totals.totalCalls}</TableCell>
                      <TableCell className="text-center text-gray-700">{pct(totals.totalCalls, totals.totalTarget || 1)}</TableCell>
                      <TableCell className="text-center">{convBadge(totals.numQuotes)}</TableCell>
                      <TableCell className="text-center">{pct(totals.numQuotes, totals.totalCalls)}</TableCell>
                      <TableCell className="text-center font-semibold text-green-600">₱{totals.totalQuoteAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{convBadge(totals.numSO)}</TableCell>
                      <TableCell className="text-center font-semibold text-blue-600">₱{totals.totalSoAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{pct(totals.numSO, totals.numQuotes)}</TableCell>
                      <TableCell className="text-center">{convBadge(totals.numSI)}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">₱{totals.totalActualSales.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{pct(totals.numSI, totals.numSO)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          {showComputation && (
            <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
              <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
              <p><strong>Base data:</strong> <code>source = "Outbound - Touchbase"</code> AND <code>call_status = "Successful"</code>.</p>
              <p><strong>Achievement:</strong> Successful Calls ÷ OB Target × 100%</p>
              <p><strong>Calls → Quote:</strong> Unique OB refs with <code>status = "Quote-Done"</code> ÷ Successful Calls</p>
              <p><strong>Quote → SO:</strong> Unique refs with <code>status = "SO-Done"</code> ÷ Quoted refs</p>
              <p><strong>SO → SI:</strong> Unique refs with <code>type_activity = "Delivered / Closed Transaction"</code> ÷ SO refs</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Outbound History tab ─────────────────────────────────────────────────────

const ALL_COLS = [
  { key: "tbTotal",   label: "Touchbase Total",   group: "tb" },
  { key: "tbSuccess", label: "Touchbase Success",  group: "tb" },
  { key: "tbFail",    label: "Touchbase Fail",     group: "tb" },
  { key: "fuTotal",   label: "Follow-up Total",    group: "fu" },
  { key: "fuSuccess", label: "Follow-up Success",  group: "fu" },
  { key: "fuFail",    label: "Follow-up Fail",     group: "fu" },
  { key: "subtotal",  label: "Subtotal",           group: "misc" },
] as const;
type ColKey = typeof ALL_COLS[number]["key"];

function OutboundHistoryTab({ history, agents, dateRange }: {
  history: HistoryItem[]; agents: Agent[]; dateRange: { from: Date; to: Date };
}) {
  const [showComputation, setShowComputation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set());
  const [touchbaseLabel, setTouchbaseLabel] = useState("Touchbase");
  const [followupLabel,  setFollowupLabel]  = useState("Follow-up");
  const [successLabel,   setSuccessLabel]   = useState("Success");
  const [failLabel,      setFailLabel]      = useState("Fail");
  const [hiddenCols, setHiddenCols] = useState<Set<ColKey>>(new Set());

  const agentMap = useMemo(() => {
    const m = new Map<string, { name: string; picture: string }>();
    agents.forEach(a => m.set(a.referenceid.toLowerCase(), { name: a.name, picture: a.picture }));
    return m;
  }, [agents]);

  const statsByAgent = useMemo(() => {
    type S = { agentID: string; tb: number; tbS: number; tbF: number; fu: number; fuS: number; fuF: number };
    const m = new Map<string, S>();
    history.forEach(item => {
      const id = item.referenceid?.toLowerCase();
      if (!id || !agentMap.has(id)) return;
      if (!m.has(id)) m.set(id, { agentID: id, tb: 0, tbS: 0, tbF: 0, fu: 0, fuS: 0, fuF: 0 });
      const s = m.get(id)!;
      if (item.source === "Outbound - Touchbase") { s.tb++; item.call_status === "Successful" ? s.tbS++ : s.tbF++; }
      else if (item.source === "Outbound - Follow-up") { s.fu++; item.call_status === "Successful" ? s.fuS++ : s.fuF++; }
    });
    return Array.from(m.values());
  }, [history, agentMap]);

  const visibleStats = useMemo(() => statsByAgent.filter(s => !hiddenAgents.has(s.agentID)), [statsByAgent, hiddenAgents]);

  const grandTotals = useMemo(() => {
    const t = { tb: 0, tbS: 0, tbF: 0, fu: 0, fuS: 0, fuF: 0 };
    visibleStats.forEach(s => { t.tb += s.tb; t.tbS += s.tbS; t.tbF += s.tbF; t.fu += s.fu; t.fuS += s.fuS; t.fuF += s.fuF; });
    return { ...t, subtotal: t.tb + t.fu };
  }, [visibleStats]);

  const totalDurationMs = useMemo(() =>
    history.filter(h => h.type_activity === "Outbound Calls").reduce((total, item) => {
      if (!item.start_date || !item.end_date) return total;
      const s = new Date(item.start_date.replace(" ", "T")).getTime(), e = new Date(item.end_date.replace(" ", "T")).getTime();
      return (!isNaN(s) && !isNaN(e) && e > s) ? total + (e - s) : total;
    }, 0),
  [history]);

  const cv = (k: ColKey) => !hiddenCols.has(k);
  const toggleAgent = (id: string) => setHiddenAgents(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCol   = (k: ColKey)  => setHiddenCols(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const agentList = useMemo(() => statsByAgent.map(s => ({ id: s.agentID, name: agentMap.get(s.agentID)!.name })), [statsByAgent, agentMap]);

  const exportToExcel = async () => {
    if (!visibleStats.length) return;
    try {
      const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Outbound History");
      const cols: any[] = [{ header: "Agent", key: "agent", width: 25 }];
      if (cv("tbTotal"))   cols.push({ header: `${touchbaseLabel} Total`,             key: "tbTotal",   width: 18 });
      if (cv("tbSuccess")) cols.push({ header: `${touchbaseLabel} ${successLabel}`,   key: "tbSuccess", width: 20 });
      if (cv("tbFail"))    cols.push({ header: `${touchbaseLabel} ${failLabel}`,      key: "tbFail",    width: 18 });
      if (cv("fuTotal"))   cols.push({ header: `${followupLabel} Total`,              key: "fuTotal",   width: 18 });
      if (cv("fuSuccess")) cols.push({ header: `${followupLabel} ${successLabel}`,    key: "fuSuccess", width: 20 });
      if (cv("fuFail"))    cols.push({ header: `${followupLabel} ${failLabel}`,       key: "fuFail",    width: 18 });
      if (cv("subtotal"))  cols.push({ header: "Subtotal",                            key: "subtotal",  width: 15 });
      ws.columns = cols;
      const hr = ws.getRow(1); hr.font = { bold: true }; hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      visibleStats.forEach(s => {
        const r: any = { agent: agentMap.get(s.agentID)!.name };
        if (cv("tbTotal"))   r.tbTotal   = s.tb;
        if (cv("tbSuccess")) r.tbSuccess = s.tbS;
        if (cv("tbFail"))    r.tbFail    = s.tbF;
        if (cv("fuTotal"))   r.fuTotal   = s.fu;
        if (cv("fuSuccess")) r.fuSuccess = s.fuS;
        if (cv("fuFail"))    r.fuFail    = s.fuF;
        if (cv("subtotal"))  r.subtotal  = s.tb + s.fu;
        ws.addRow(r);
      });
      const tr = ws.addRow({ agent: "TOTAL", ...(cv("tbTotal") && { tbTotal: grandTotals.tb }), ...(cv("tbSuccess") && { tbSuccess: grandTotals.tbS }), ...(cv("tbFail") && { tbFail: grandTotals.tbF }), ...(cv("fuTotal") && { fuTotal: grandTotals.fu }), ...(cv("fuSuccess") && { fuSuccess: grandTotals.fuS }), ...(cv("fuFail") && { fuFail: grandTotals.fuF }), ...(cv("subtotal") && { subtotal: grandTotals.subtotal }) });
      tr.font = { bold: true };
      const buf = await wb.xlsx.writeBuffer();
      const url = window.URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `Outbound_History_${new Date().toISOString().split("T")[0]}.xlsx`; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch {}
  };

  const activeCust = hiddenAgents.size + hiddenCols.size + (touchbaseLabel !== "Touchbase" ? 1 : 0) + (followupLabel !== "Follow-up" ? 1 : 0) + (successLabel !== "Success" ? 1 : 0) + (failLabel !== "Fail" ? 1 : 0);

  return (
    <div className="p-4">
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Outbound History</h2>
              <p className="text-xs text-gray-400 mt-0.5"><span className="font-medium text-gray-500">{touchbaseLabel}</span> and <span className="font-medium text-gray-500">{followupLabel}</span> outbound calls</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!visibleStats.length} className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"><Download className="w-3.5 h-3.5" />Export</Button>
              <Button variant="outline" size="sm" onClick={() => setShowComputation(v => !v)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"><Info className="w-3.5 h-3.5" />{showComputation ? "Hide" : "Details"}</Button>
              <Button variant={showSettings ? "default" : "outline"} size="sm" onClick={() => setShowSettings(v => !v)} className={`relative flex items-center gap-1.5 text-xs ${showSettings ? "bg-gray-800 text-white hover:bg-gray-700" : "text-gray-600 hover:text-gray-800"}`}>
                <Settings2 className="w-3.5 h-3.5" />Customize
                {activeCust > 0 && <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{activeCust}</span>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 relative">
          {showSettings && (
            <div className="absolute top-0 right-0 z-20 w-72 h-full bg-white border-l border-gray-200 shadow-xl rounded-r-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5 text-gray-500" /><span className="text-xs font-semibold text-gray-700">Customize View</span></div>
                <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-gray-200 transition-colors"><X className="w-3.5 h-3.5 text-gray-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"><Users className="w-3.5 h-3.5" /><span>Agent Visibility</span></div>
                  <div className="flex gap-1.5 mb-2">
                    <button onClick={() => setHiddenAgents(new Set())} className="text-[10px] px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-500">Show All</button>
                    <button onClick={() => setHiddenAgents(new Set(agentList.map(a => a.id)))} className="text-[10px] px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-500">Hide All</button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {agentList.map(({ id, name }) => {
                      const hidden = hiddenAgents.has(id);
                      return <button key={id} onClick={() => toggleAgent(id)} className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${hidden ? "bg-gray-100 text-gray-400" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}><span className="capitalize truncate">{name}</span>{hidden ? <EyeOff className="w-3 h-3 flex-shrink-0 text-gray-400" /> : <Eye className="w-3 h-3 flex-shrink-0 text-blue-400" />}</button>;
                    })}
                  </div>
                </div>
                <hr className="border-gray-100" />
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"><Tag className="w-3.5 h-3.5" /><span>Source Labels</span></div>
                  {[["Touchbase", touchbaseLabel, setTouchbaseLabel], ["Follow-up", followupLabel, setFollowupLabel]].map(([lbl, val, setter]: any) => (
                    <div key={lbl} className="flex items-center gap-2"><span className="w-24 text-xs text-gray-500 flex-shrink-0">{lbl}</span><input value={val} onChange={e => setter(e.target.value)} className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300" /></div>
                  ))}
                </div>
                <hr className="border-gray-100" />
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"><Tag className="w-3.5 h-3.5" /><span>Status Labels</span></div>
                  {[["✓ Success", successLabel, setSuccessLabel], ["✗ Fail", failLabel, setFailLabel]].map(([lbl, val, setter]: any) => (
                    <div key={lbl} className="flex items-center gap-2"><span className="w-24 text-xs text-gray-500 flex-shrink-0">{lbl}</span><input value={val} onChange={e => setter(e.target.value)} className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300" /></div>
                  ))}
                </div>
                <hr className="border-gray-100" />
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider"><Columns3 className="w-3.5 h-3.5" /><span>Column Visibility</span></div>
                  <div className="space-y-1">
                    {ALL_COLS.map(({ key, label, group }) => {
                      const visible = cv(key); const accent = group === "tb" ? "bg-amber-50 border-amber-200 text-amber-700" : group === "fu" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-600";
                      return <button key={key} onClick={() => toggleCol(key)} className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${visible ? accent : "bg-gray-100 border-gray-100 text-gray-400"}`}><span>{label}</span>{visible ? <Eye className="w-3 h-3 flex-shrink-0" /> : <EyeOff className="w-3 h-3 flex-shrink-0 text-gray-400" />}</button>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          {visibleStats.length === 0
            ? <div className="flex items-center justify-center py-10 text-xs text-gray-400">{statsByAgent.length === 0 ? "No outbound records found." : "All agents hidden. Show agents in Customize → Agent Visibility."}</div>
            : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 text-[11px] border-b-0">
                      <TableHead className="text-gray-500" rowSpan={2}>Agent</TableHead>
                      {(cv("tbTotal") || cv("tbSuccess") || cv("tbFail")) && <TableHead className="text-center text-amber-600 bg-amber-50 border-l" colSpan={[cv("tbTotal"), cv("tbSuccess"), cv("tbFail")].filter(Boolean).length}>{touchbaseLabel}</TableHead>}
                      {(cv("fuTotal") || cv("fuSuccess") || cv("fuFail")) && <TableHead className="text-center text-blue-600 bg-blue-50 border-l" colSpan={[cv("fuTotal"), cv("fuSuccess"), cv("fuFail")].filter(Boolean).length}>{followupLabel}</TableHead>}
                      {cv("subtotal") && <TableHead className="text-center text-gray-500 bg-gray-100 border-l" rowSpan={2}>Subtotal</TableHead>}
                    </TableRow>
                    <TableRow className="bg-gray-50 text-[11px]">
                      {cv("tbTotal")   && <TableHead className="text-center text-gray-500 bg-amber-50 border-l">Total</TableHead>}
                      {cv("tbSuccess") && <TableHead className="text-center text-green-600 bg-amber-50">✓ {successLabel}</TableHead>}
                      {cv("tbFail")    && <TableHead className="text-center text-red-500 bg-amber-50">✗ {failLabel}</TableHead>}
                      {cv("fuTotal")   && <TableHead className="text-center text-gray-500 bg-blue-50 border-l">Total</TableHead>}
                      {cv("fuSuccess") && <TableHead className="text-center text-green-600 bg-blue-50">✓ {successLabel}</TableHead>}
                      {cv("fuFail")    && <TableHead className="text-center text-red-500 bg-blue-50">✗ {failLabel}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleStats.map(stat => {
                      const info = agentMap.get(stat.agentID)!;
                      return (
                        <TableRow key={stat.agentID} className="text-xs hover:bg-gray-50/50 font-mono">
                          <TableCell><div className="flex items-center gap-2">{info?.picture ? <img src={info.picture} alt={info.name} className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0" /> : <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{info.name[0]}</div>}<span className="capitalize text-gray-700">{info.name}</span></div></TableCell>
                          {cv("tbTotal")   && <TableCell className="text-center font-semibold text-amber-700 bg-amber-50/40 border-l">{stat.tb}</TableCell>}
                          {cv("tbSuccess") && <TableCell className="text-center text-green-600 font-semibold bg-amber-50/40">{stat.tbS}</TableCell>}
                          {cv("tbFail")    && <TableCell className="text-center text-red-500 font-semibold bg-amber-50/40">{stat.tbF}</TableCell>}
                          {cv("fuTotal")   && <TableCell className="text-center font-semibold text-blue-700 bg-blue-50/40 border-l">{stat.fu}</TableCell>}
                          {cv("fuSuccess") && <TableCell className="text-center text-green-600 font-semibold bg-blue-50/40">{stat.fuS}</TableCell>}
                          {cv("fuFail")    && <TableCell className="text-center text-red-500 font-semibold bg-blue-50/40">{stat.fuF}</TableCell>}
                          {cv("subtotal")  && <TableCell className="text-center font-bold text-gray-800 bg-gray-50 border-l">{stat.tb + stat.fu}</TableCell>}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="text-xs font-semibold font-mono">
                      <TableCell className="text-gray-700">Total</TableCell>
                      {cv("tbTotal")   && <TableCell className="text-center text-amber-700 bg-amber-50 border-l">{grandTotals.tb}</TableCell>}
                      {cv("tbSuccess") && <TableCell className="text-center text-green-600 bg-amber-50">{grandTotals.tbS}</TableCell>}
                      {cv("tbFail")    && <TableCell className="text-center text-red-500 bg-amber-50">{grandTotals.tbF}</TableCell>}
                      {cv("fuTotal")   && <TableCell className="text-center text-blue-700 bg-blue-50 border-l">{grandTotals.fu}</TableCell>}
                      {cv("fuSuccess") && <TableCell className="text-center text-green-600 bg-blue-50">{grandTotals.fuS}</TableCell>}
                      {cv("fuFail")    && <TableCell className="text-center text-red-500 bg-blue-50">{grandTotals.fuF}</TableCell>}
                      {cv("subtotal")  && <TableCell className="text-center font-bold text-gray-800 bg-gray-100 border-l">{grandTotals.subtotal}</TableCell>}
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-400 italic">Total call duration: <span className="font-medium text-gray-600">{formatDurationMs(totalDurationMs)}</span></p>
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">Total Outbound: {grandTotals.subtotal}</span>
          </div>
          {showComputation && (
            <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
              <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
              <p><strong>{touchbaseLabel}:</strong> <code>source = "Outbound - Touchbase"</code></p>
              <p><strong>{followupLabel}:</strong> <code>source = "Outbound - Follow-up"</code></p>
              <p><strong>Success / Fail:</strong> Based on <code>call_status</code> field.</p>
              <p><strong>Duration:</strong> Sum of <code>end_date - start_date</code> for <code>type_activity = "Outbound Calls"</code>.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function ObBreakdownContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const [activeTab, setActiveTab] = useState<TabKey>("ob_calls");
  const [tsm,       setTsm]       = useState("");
  const [manager,   setManager]   = useState("");
  const [year,      setYear]      = useState(new Date().getFullYear().toString());

  // ── OB Calls tab state (year view, successful only from tsm-agent-ob) ────────
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [obMap,     setObMap]     = useState<Record<string, Record<string, number>>>({});
  const [loadingOb, setLoadingOb] = useState(false);

  // ── Target tab state — shares agents list ────────────────────────────────────
  const [targets,       setTargets]       = useState<Record<string, Record<string, number>>>({});
  const [loadingTarget, setLoadingTarget] = useState(false);

  // ── Touchbase / Outbound History tabs — single shared fetch ─────────────────
  // Both tabs use the SAME outboundHistory data from ONE route:
  // /api/tsm-agent-outbound-history (returns all history rows for the date range).
  // Touchbase tab filters to source="Outbound - Touchbase" + call_status="Successful".
  // Outbound History tab counts all Touchbase + Follow-up rows.
  // No separate fetches per tab = no tally mismatch.
  const [outboundHistory,   setOutboundHistory]   = useState<HistoryItem[]>([]);
  const [outboundAgents,    setOutboundAgents]     = useState<Agent[]>([]);
  const [loadingOutbound,   setLoadingOutbound]    = useState(false);

  // ── Use global date context (set via GlobalTopBar date picker) ───────────────
  const { dateRange: globalDateRange } = useGlobalDate();
  const outboundDateRange = useMemo(() => {
    if (globalDateRange?.from && globalDateRange?.to) {
      return { from: globalDateRange.from, to: globalDateRange.to };
    }
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
  }, [globalDateRange]);

  // ── Fetch user ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.ReferenceID) { setTsm(data.ReferenceID); setManager(data.Manager || ""); } })
      .catch(() => {});
  }, [userId]);

  // ── Fetch OB Calls (year breakdown, successful only) ─────────────────────────
  const fetchObCalls = useCallback(() => {
    if (!tsm) return;
    setLoadingOb(true);
    fetch(`/api/tsm-agent-ob?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success) {
          setAgents((data.agents ?? []).map((a: any) => ({ referenceid: a.referenceid, name: a.name, picture: "" })));
          setObMap(data.obMap ?? {});
        }
      })
      .catch(() => {})
      .finally(() => setLoadingOb(false));
  }, [tsm, year]);

  // ── Fetch Targets ─────────────────────────────────────────────────────────────
  const fetchTargets = useCallback(() => {
    if (!tsm) return;
    setLoadingTarget(true);
    fetch(`/api/tsm-agent-ob-target?tsm=${encodeURIComponent(tsm)}&year=${year}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success) {
          if (data.agents?.length) setAgents((data.agents as any[]).map(a => ({ referenceid: a.referenceid, name: a.name, picture: "" })));
          setTargets(data.targets ?? {});
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTarget(false));
  }, [tsm, year]);

  useEffect(() => { fetchObCalls(); fetchTargets(); }, [fetchObCalls, fetchTargets]);

  // ── Fetch Outbound History (single fetch, shared by Touchbase + Outbound History tabs) ──
  const fetchOutboundHistory = useCallback(() => {
    if (!tsm) return;
    setLoadingOutbound(true);
    const from = outboundDateRange.from.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const to   = outboundDateRange.to.toLocaleDateString("en-CA",   { timeZone: "Asia/Manila" });
    fetch(`/api/tsm-agent-outbound-history?tsm=${encodeURIComponent(tsm)}&from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : { history: [], agents: [] })
      .then(data => {
        setOutboundHistory(data.history ?? []);
        setOutboundAgents((data.agents ?? []).map((a: any) => ({ referenceid: a.ReferenceID, name: `${a.Firstname} ${a.Lastname}`.trim(), picture: a.profilePicture ?? "" })));
      })
      .catch(() => {})
      .finally(() => setLoadingOutbound(false));
  }, [tsm, outboundDateRange]);

  // Always fetch when tsm or dateRange changes — data is ready before the user switches tabs
  useEffect(() => { fetchOutboundHistory(); }, [fetchOutboundHistory]);

  // ── Optimistic target update ──────────────────────────────────────────────────
  const handleTargetUpdate = (referenceid: string, month: string, value: number) => {
    setTargets(prev => ({ ...prev, [referenceid]: { ...(prev[referenceid] ?? {}), [month]: value } }));
  };

  // ── Per-agent targets for Touchbase tab ──────────────────────────────────────
  const perAgentTargets = useMemo(() => {
    const from = new Date(outboundDateRange.from), to = new Date(outboundDateRange.to);
    const result: Record<string, number> = {};
    for (const agent of agents) {
      const id = agent.referenceid.toLowerCase();
      let total = 0;
      const cur = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cur <= to) { total += targets[agent.referenceid]?.[MONTHS[cur.getMonth()]] ?? 0; cur.setMonth(cur.getMonth() + 1); }
      result[id] = total;
    }
    return result;
  }, [agents, targets, outboundDateRange]);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        {/* Header */}
        <GlobalTopBar
          title="OB Calls Breakdown"
          extra={
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors ml-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          }
          rightExtra={
            (activeTab === "ob_calls" || activeTab === "target") ? (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 font-medium">Year:</label>
                <select value={year} onChange={e => setYear(e.target.value)} className="h-7 text-xs border border-gray-200 rounded px-2 bg-white">
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </div>
            ) : undefined
          }
        />

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        <main className="overflow-auto">
          {activeTab === "ob_calls" && (
            <ObCallsTab agents={agents} obMap={obMap} year={year} loading={loadingOb} />
          )}
          {activeTab === "target" && (
            <TargetTab agents={agents} targets={targets} year={year} tsm={tsm} manager={manager} loading={loadingTarget} onTargetUpdate={handleTargetUpdate} />
          )}
          {activeTab === "touchbase" && (
            loadingOutbound
              ? <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Spinner className="w-4 h-4" /> Loading...</div>
              : <TouchbaseTab history={outboundHistory} agents={outboundAgents} dateRange={outboundDateRange} perAgentTargets={perAgentTargets} />
          )}
          {activeTab === "outbound_history" && (
            loadingOutbound
              ? <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Spinner className="w-4 h-4" /> Loading...</div>
              : <OutboundHistoryTab history={outboundHistory} agents={outboundAgents} dateRange={outboundDateRange} />
          )}
        </main>

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
          <Suspense fallback={<div>Loading...</div>}>
            <ObBreakdownContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
