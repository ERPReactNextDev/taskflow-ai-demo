"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Info, Download, Settings2, X, Eye, EyeOff, Tag, Columns3, Users } from "lucide-react";
import ExcelJS from "exceljs";

/* ================= TYPES ================= */

interface HistoryItem {
  referenceid: string;
  source: string;
  call_status: string;
  type_activity: string;
  start_date: string;
  end_date: string;
  date_created: string;
}

interface Agent {
  ReferenceID: string;
  Firstname: string;
  Lastname: string;
  profilePicture: string;
}

interface OutboundCardProps {
  history?: HistoryItem[];
  agents?: Agent[];
  /** When provided, self-fetches data using tsm-agent-ob API (no row limit) */
  tsm?: string;
  dateRange?: { from?: Date; to?: Date };
}

/* ================= CONSTANTS ================= */

const ALL_COLUMNS = [
  { key: "tbTotal",   label: "Touchbase Total",   group: "touchbase" },
  { key: "tbSuccess", label: "Touchbase Success",  group: "touchbase" },
  { key: "tbFail",    label: "Touchbase Fail",     group: "touchbase" },
  { key: "fuTotal",   label: "Follow-up Total",    group: "followup"  },
  { key: "fuSuccess", label: "Follow-up Success",  group: "followup"  },
  { key: "fuFail",    label: "Follow-up Fail",     group: "followup"  },
  { key: "subtotal",  label: "Subtotal",           group: "misc"      },
] as const;

type ColKey = typeof ALL_COLUMNS[number]["key"];

/* ================= HELPERS ================= */

function formatDurationMs(ms: number) {
  if (ms <= 0) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ") || "0s";
}

/* ================= SETTINGS PANEL ================= */

interface SettingsPanelProps {
  onClose: () => void;

  // Agent visibility
  agentList: { id: string; name: string }[];
  hiddenAgents: Set<string>;
  onToggleAgent: (id: string) => void;
  onShowAllAgents: () => void;
  onHideAllAgents: () => void;

  // Source labels
  touchbaseLabel: string;
  followupLabel: string;
  onTouchbaseLabel: (v: string) => void;
  onFollowupLabel: (v: string) => void;

  // Status labels
  successLabel: string;
  failLabel: string;
  onSuccessLabel: (v: string) => void;
  onFailLabel: (v: string) => void;

  // Column visibility
  hiddenCols: Set<ColKey>;
  onToggleCol: (k: ColKey) => void;
}

function SettingsPanel({
  onClose,
  agentList, hiddenAgents, onToggleAgent, onShowAllAgents, onHideAllAgents,
  touchbaseLabel, followupLabel, onTouchbaseLabel, onFollowupLabel,
  successLabel, failLabel, onSuccessLabel, onFailLabel,
  hiddenCols, onToggleCol,
}: SettingsPanelProps) {

  const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );

  const LabelField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-gray-500 flex-shrink-0">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
    </div>
  );

  return (
    <div className="absolute top-0 right-0 z-20 w-72 h-full bg-white border-l border-gray-200 shadow-xl rounded-r-xl flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">Customize View</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 transition-colors">
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* 1. Agent Visibility */}
        <Section icon={<Users className="w-3.5 h-3.5" />} title="Agent Visibility">
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={onShowAllAgents}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-500"
            >
              Show All
            </button>
            <button
              onClick={onHideAllAgents}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50 text-gray-500"
            >
              Hide All
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {agentList.map(({ id, name }) => {
              const hidden = hiddenAgents.has(id);
              return (
                <button
                  key={id}
                  onClick={() => onToggleAgent(id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    hidden
                      ? "bg-gray-100 text-gray-400"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="capitalize truncate">{name}</span>
                  {hidden ? (
                    <EyeOff className="w-3 h-3 flex-shrink-0 text-gray-400" />
                  ) : (
                    <Eye className="w-3 h-3 flex-shrink-0 text-blue-400" />
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        <hr className="border-gray-100" />

        {/* 2. Source Labels */}
        <Section icon={<Tag className="w-3.5 h-3.5" />} title="Source Labels">
          <LabelField label="Touchbase" value={touchbaseLabel} onChange={onTouchbaseLabel} />
          <LabelField label="Follow-up"  value={followupLabel}  onChange={onFollowupLabel}  />
        </Section>

        <hr className="border-gray-100" />

        {/* 3. Status Labels */}
        <Section icon={<Tag className="w-3.5 h-3.5" />} title="Status Labels">
          <LabelField label="✓ Success" value={successLabel} onChange={onSuccessLabel} />
          <LabelField label="✗ Fail"    value={failLabel}    onChange={onFailLabel}    />
        </Section>

        <hr className="border-gray-100" />

        {/* 4. Column Visibility */}
        <Section icon={<Columns3 className="w-3.5 h-3.5" />} title="Column Visibility">
          <div className="space-y-1">
            {ALL_COLUMNS.map(({ key, label, group }) => {
              const visible = !hiddenCols.has(key);
              const accent =
                group === "touchbase" ? "bg-amber-50 border-amber-200 text-amber-700"
                : group === "followup" ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-gray-50 border-gray-200 text-gray-600";
              return (
                <button
                  key={key}
                  onClick={() => onToggleCol(key)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    visible ? accent : "bg-gray-100 border-gray-100 text-gray-400"
                  }`}
                >
                  <span>{label}</span>
                  {visible ? (
                    <Eye className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <EyeOff className="w-3 h-3 flex-shrink-0 text-gray-400" />
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ================= MAIN COMPONENT ================= */

export function OutboundCard({ history: historyProp = [], agents: agentsProp = [], tsm, dateRange }: OutboundCardProps) {
  const [showComputation, setShowComputation] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // ── Self-fetch mode (used in ob-breakdown page) ─────────────────────────
  const [selfAgents,  setSelfAgents]  = useState<Agent[]>([]);
  const [selfCounts,  setSelfCounts]  = useState<Record<string, { tb: number; tbSuccess: number; tbFail: number; fu: number; fuSuccess: number; fuFail: number }>>({});
  const [selfLoading, setSelfLoading] = useState(false);

  const fetchSelfData = useCallback(async () => {
    if (!tsm) return;
    setSelfLoading(true);
    try {
      const refDate = dateRange?.from ?? new Date();
      const from = refDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
      const to   = (dateRange?.to ?? refDate).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

      // Fetch agents and outbound history in parallel
      // Use the same API + date format as outbound-touchbase-count (tsm-history-outbound)
      const [agentsRes, histRes] = await Promise.all([
        fetch(`/api/fetch-all-user?id=${encodeURIComponent(tsm)}`),
        // Use tsm-agent-outbound-history which queries history table only,
        // by referenceid IN agentIds, with Manila +08:00 bounds — same as tsm-history-outbound
        fetch(`/api/tsm-agent-outbound-history?tsm=${encodeURIComponent(tsm)}&from=${from}&to=${to}`),
      ]);

      const agentsData: Agent[] = agentsRes.ok ? await agentsRes.json() : [];
      setSelfAgents(Array.isArray(agentsData) ? agentsData : []);

      const histData = histRes.ok ? await histRes.json() : { history: [] };
      const rows: HistoryItem[] = histData.history ?? [];

      // Aggregate counts per agent from history table rows only
      const counts: typeof selfCounts = {};
      for (const item of rows) {
        const id = item.referenceid?.toLowerCase();
        if (!id) continue;
        if (!counts[id]) counts[id] = { tb: 0, tbSuccess: 0, tbFail: 0, fu: 0, fuSuccess: 0, fuFail: 0 };
        if (item.source === "Outbound - Touchbase") {
          counts[id].tb++;
          if (item.call_status === "Successful") counts[id].tbSuccess++;
          else counts[id].tbFail++;
        } else if (item.source === "Outbound - Follow-up") {
          counts[id].fu++;
          if (item.call_status === "Successful") counts[id].fuSuccess++;
          else counts[id].fuFail++;
        }
      }
      setSelfCounts(counts);
    } catch (err) {
      console.error("OutboundCard self-fetch error:", err);
    } finally {
      setSelfLoading(false);
    }
  }, [tsm, dateRange]);

  useEffect(() => { fetchSelfData(); }, [fetchSelfData]);

  // Use self-fetched data when tsm prop provided, otherwise fall back to props
  const agents  = tsm ? selfAgents  : agentsProp;
  const history = tsm ? [] : historyProp; // history only used for prop-mode duration calc

  // --- Customization state ---
  const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set());
  const [touchbaseLabel, setTouchbaseLabel] = useState("Touchbase");
  const [followupLabel,  setFollowupLabel]  = useState("Follow-up");
  const [successLabel,   setSuccessLabel]   = useState("Success");
  const [failLabel,      setFailLabel]      = useState("Fail");
  const [hiddenCols, setHiddenCols] = useState<Set<ColKey>>(new Set());

  /* ---- Agent map ---- */
  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; picture: string }>();
    agents.forEach((a) =>
      map.set(a.ReferenceID.toLowerCase(), {
        name: `${a.Firstname} ${a.Lastname}`,
        picture: a.profilePicture,
      })
    );
    return map;
  }, [agents]);

  /* ---- Per-agent stats ---- */
  const statsByAgent = useMemo(() => {
    type AgentStats = {
      agentID: string;
      touchbaseCount: number;
      touchbaseSuccessful: number;
      touchbaseUnsuccessful: number;
      followupCount: number;
      followupSuccessful: number;
      followupUnsuccessful: number;
    };

    if (tsm) {
      // Self-fetch mode — use pre-aggregated selfCounts
      return Object.entries(selfCounts).map(([agentID, c]) => ({
        agentID,
        touchbaseCount:        c.tb,
        touchbaseSuccessful:   c.tbSuccess,
        touchbaseUnsuccessful: c.tbFail,
        followupCount:         c.fu,
        followupSuccessful:    c.fuSuccess,
        followupUnsuccessful:  c.fuFail,
      }));
    }

    // Prop mode — derive from raw history
    const map = new Map<string, AgentStats>();
    historyProp.forEach((item) => {
      const agentID = item.referenceid?.toLowerCase();
      if (!agentID) return;
      if (!map.has(agentID)) {
        map.set(agentID, {
          agentID,
          touchbaseCount: 0, touchbaseSuccessful: 0, touchbaseUnsuccessful: 0,
          followupCount: 0,  followupSuccessful: 0,  followupUnsuccessful: 0,
        });
      }
      const stat = map.get(agentID)!;
      if (item.source === "Outbound - Touchbase") {
        stat.touchbaseCount++;
        if (item.call_status === "Successful") stat.touchbaseSuccessful++;
        else stat.touchbaseUnsuccessful++;
      } else if (item.source === "Outbound - Follow-up") {
        stat.followupCount++;
        if (item.call_status === "Successful") stat.followupSuccessful++;
        else stat.followupUnsuccessful++;
      }
    });
    return Array.from(map.values());
  }, [tsm, selfCounts, historyProp]);

  /* ---- Visible agents list (for settings panel + table) ---- */
  const agentList = useMemo(
    () =>
      statsByAgent
        .filter((s) => agentMap.has(s.agentID))
        .map((s) => ({ id: s.agentID, name: agentMap.get(s.agentID)!.name })),
    [statsByAgent, agentMap]
  );

  const visibleStats = useMemo(
    () => statsByAgent.filter((s) => agentMap.has(s.agentID) && !hiddenAgents.has(s.agentID)),
    [statsByAgent, agentMap, hiddenAgents]
  );

  /* ---- Duration (prop mode only) ---- */
  const outboundCalls = useMemo(
    () => historyProp.filter((item) => item.type_activity === "Outbound Calls"),
    [historyProp]
  );

  const totalOutboundDurationMs = useMemo(() => {
    return outboundCalls.reduce((total, item) => {
      if (!item.start_date || !item.end_date) return total;
      const start = new Date(item.start_date.replace(" ", "T")).getTime();
      const end   = new Date(item.end_date.replace(" ", "T")).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) return total + (end - start);
      return total;
    }, 0);
  }, [outboundCalls]);

  /* ---- Grand totals (visible agents only) ---- */
  const grandTotals = useMemo(() => {
    // Only include agents with name info in totals
    const visibleAgents = statsByAgent.filter((s) => agentMap.has(s.agentID));
    const t = {
      touchbaseCount: 0,
      touchbaseSuccessful: 0,
      touchbaseUnsuccessful: 0,
      followupCount: 0,
      followupSuccessful: 0,
      followupUnsuccessful: 0,
    };
    visibleStats.forEach((s) => {
      t.touchbaseCount        += s.touchbaseCount;
      t.touchbaseSuccessful   += s.touchbaseSuccessful;
      t.touchbaseUnsuccessful += s.touchbaseUnsuccessful;
      t.followupCount         += s.followupCount;
      t.followupSuccessful    += s.followupSuccessful;
      t.followupUnsuccessful  += s.followupUnsuccessful;
    });
    return { ...t, subtotal: t.touchbaseCount + t.followupCount };
  }, [visibleStats]);

  /* ---- Helpers ---- */
  const colVisible = (k: ColKey) => !hiddenCols.has(k);

  const toggleAgent  = (id: string)  => setHiddenAgents((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const showAllAgents = ()            => setHiddenAgents(new Set());
  const hideAllAgents = ()            => setHiddenAgents(new Set(agentList.map((a) => a.id)));
  const toggleCol    = (k: ColKey)   => setHiddenCols((prev)   => { const next = new Set(prev); next.has(k) ? next.delete(k) : next.add(k); return next; });

  /* ---- Export ---- */
  const exportToExcel = async () => {
    if (visibleStats.length === 0) return;
    try {
      const workbook  = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Outbound History");

      const cols = [
        { header: "Agent",                       key: "agent",     width: 25 },
        ...(colVisible("tbTotal")   ? [{ header: `${touchbaseLabel} Total`,   key: "tbTotal",   width: 18 }] : []),
        ...(colVisible("tbSuccess") ? [{ header: `${touchbaseLabel} ${successLabel}`, key: "tbSuccess", width: 20 }] : []),
        ...(colVisible("tbFail")    ? [{ header: `${touchbaseLabel} ${failLabel}`,    key: "tbFail",    width: 18 }] : []),
        ...(colVisible("fuTotal")   ? [{ header: `${followupLabel} Total`,    key: "fuTotal",   width: 18 }] : []),
        ...(colVisible("fuSuccess") ? [{ header: `${followupLabel} ${successLabel}`, key: "fuSuccess", width: 20 }] : []),
        ...(colVisible("fuFail")    ? [{ header: `${followupLabel} ${failLabel}`,    key: "fuFail",    width: 18 }] : []),
        ...(colVisible("subtotal")  ? [{ header: "Subtotal",                  key: "subtotal",  width: 15 }] : []),
      ];
      worksheet.columns = cols;

      const headerRow = worksheet.getRow(1);
      headerRow.font      = { bold: true };
      headerRow.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      visibleStats.forEach((stat) => {
        const info     = agentMap.get(stat.agentID)!;
        const subtotal = stat.touchbaseCount + stat.followupCount;
        const row: Record<string, unknown> = { agent: info.name };
        if (colVisible("tbTotal"))   row.tbTotal   = stat.touchbaseCount;
        if (colVisible("tbSuccess")) row.tbSuccess = stat.touchbaseSuccessful;
        if (colVisible("tbFail"))    row.tbFail    = stat.touchbaseUnsuccessful;
        if (colVisible("fuTotal"))   row.fuTotal   = stat.followupCount;
        if (colVisible("fuSuccess")) row.fuSuccess = stat.followupSuccessful;
        if (colVisible("fuFail"))    row.fuFail    = stat.followupUnsuccessful;
        if (colVisible("subtotal"))  row.subtotal  = subtotal;
        worksheet.addRow(row);
      });

      const totalRow = worksheet.addRow({
        agent: "TOTAL",
        ...(colVisible("tbTotal")   ? { tbTotal:   grandTotals.touchbaseCount }        : {}),
        ...(colVisible("tbSuccess") ? { tbSuccess: grandTotals.touchbaseSuccessful }   : {}),
        ...(colVisible("tbFail")    ? { tbFail:    grandTotals.touchbaseUnsuccessful } : {}),
        ...(colVisible("fuTotal")   ? { fuTotal:   grandTotals.followupCount }         : {}),
        ...(colVisible("fuSuccess") ? { fuSuccess: grandTotals.followupSuccessful }    : {}),
        ...(colVisible("fuFail")    ? { fuFail:    grandTotals.followupUnsuccessful }  : {}),
        ...(colVisible("subtotal")  ? { subtotal:  grandTotals.subtotal }              : {}),
      });
      totalRow.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = window.URL.createObjectURL(blob);
      const link   = document.createElement("a");
      link.href    = url;
      link.download = `TSM_Outbound_History_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  if (!tsm && statsByAgent.length === 0 && historyProp.length === 0) return null;

  if (selfLoading) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="flex items-center justify-center py-16">
          <Spinner className="w-5 h-5" />
        </CardContent>
      </Card>
    );
  }

  /* ---- Active customizations badge count ---- */
  const activeCustomizations =
    hiddenAgents.size +
    hiddenCols.size +
    (touchbaseLabel !== "Touchbase" ? 1 : 0) +
    (followupLabel  !== "Follow-up" ? 1 : 0) +
    (successLabel   !== "Success"   ? 1 : 0) +
    (failLabel      !== "Fail"      ? 1 : 0);

  return (
    <Card className="rounded-xl border shadow-sm">
      {/* Header */}
      <CardHeader className="px-5 pt-5 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Outbound History</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="font-medium text-gray-500">{touchbaseLabel}</span> and{" "}
              <span className="font-medium text-gray-500">{followupLabel}</span> outbound calls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              disabled={visibleStats.length === 0}
              className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 border-green-200 bg-green-50/50 hover:bg-green-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComputation(!showComputation)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800"
            >
              <Info className="w-3.5 h-3.5" />
              {showComputation ? "Hide" : "Details"}
            </Button>
            {/* Settings button with badge */}
            <Button
              variant={showSettings ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className={`relative flex items-center gap-1.5 text-xs ${
                showSettings
                  ? "bg-gray-800 text-white hover:bg-gray-700"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Customize
              {activeCustomizations > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeCustomizations}
                </span>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Body — relative so the settings panel overlays correctly */}
      <CardContent className="p-4 relative">
        {/* Settings Slide-in Panel */}
        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            agentList={agentList}
            hiddenAgents={hiddenAgents}
            onToggleAgent={toggleAgent}
            onShowAllAgents={showAllAgents}
            onHideAllAgents={hideAllAgents}
            touchbaseLabel={touchbaseLabel}
            followupLabel={followupLabel}
            onTouchbaseLabel={setTouchbaseLabel}
            onFollowupLabel={setFollowupLabel}
            successLabel={successLabel}
            failLabel={failLabel}
            onSuccessLabel={setSuccessLabel}
            onFailLabel={setFailLabel}
            hiddenCols={hiddenCols}
            onToggleCol={toggleCol}
          />
        )}

        {visibleStats.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-gray-400">
            {statsByAgent.length === 0
              ? "No outbound records found."
              : "All agents are hidden. Show agents in Customize → Agent Visibility."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                {/* Group row */}
                <TableRow className="bg-gray-50 text-[11px] border-b-0">
                  <TableHead className="text-gray-500" rowSpan={2}>Agent</TableHead>

                  {/* Touchbase group — only render if at least one TB col is visible */}
                  {(colVisible("tbTotal") || colVisible("tbSuccess") || colVisible("tbFail")) && (
                    <TableHead
                      className="text-center text-amber-600 bg-amber-50 border-l"
                      colSpan={
                        [colVisible("tbTotal"), colVisible("tbSuccess"), colVisible("tbFail")].filter(Boolean).length
                      }
                    >
                      {touchbaseLabel}
                    </TableHead>
                  )}

                  {/* Follow-up group */}
                  {(colVisible("fuTotal") || colVisible("fuSuccess") || colVisible("fuFail")) && (
                    <TableHead
                      className="text-center text-blue-600 bg-blue-50 border-l"
                      colSpan={
                        [colVisible("fuTotal"), colVisible("fuSuccess"), colVisible("fuFail")].filter(Boolean).length
                      }
                    >
                      {followupLabel}
                    </TableHead>
                  )}

                  {colVisible("subtotal") && (
                    <TableHead className="text-center text-gray-500 bg-gray-100 border-l" rowSpan={2}>
                      Subtotal
                    </TableHead>
                  )}
                </TableRow>

                <TableRow className="bg-gray-50 text-[11px]">
                  {colVisible("tbTotal")   && <TableHead className="text-center text-gray-500 bg-amber-50 border-l">Total</TableHead>}
                  {colVisible("tbSuccess") && <TableHead className="text-center text-green-600 bg-amber-50">✓ {successLabel}</TableHead>}
                  {colVisible("tbFail")    && <TableHead className="text-center text-red-500 bg-amber-50">✗ {failLabel}</TableHead>}
                  {colVisible("fuTotal")   && <TableHead className="text-center text-gray-500 bg-blue-50 border-l">Total</TableHead>}
                  {colVisible("fuSuccess") && <TableHead className="text-center text-green-600 bg-blue-50">✓ {successLabel}</TableHead>}
                  {colVisible("fuFail")    && <TableHead className="text-center text-red-500 bg-blue-50">✗ {failLabel}</TableHead>}
                </TableRow>
              </TableHeader>

              <TableBody>
                {visibleStats.map((stat) => {
                  const info     = agentMap.get(stat.agentID)!;
                  const subtotal = stat.touchbaseCount + stat.followupCount;

                  return (
                    <TableRow key={stat.agentID} className="text-xs hover:bg-gray-50/50 font-mono">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {info?.picture ? (
                            <img
                              src={info.picture}
                              alt={info.name}
                              className="w-7 h-7 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                              {info.name[0]}
                            </div>
                          )}
                          <span className="capitalize text-gray-700">{info.name}</span>
                        </div>
                      </TableCell>

                      {colVisible("tbTotal")   && <TableCell className="text-center font-semibold text-amber-700 bg-amber-50/40 border-l">{stat.touchbaseCount}</TableCell>}
                      {colVisible("tbSuccess") && <TableCell className="text-center text-green-600 font-semibold bg-amber-50/40">{stat.touchbaseSuccessful}</TableCell>}
                      {colVisible("tbFail")    && <TableCell className="text-center text-red-500 font-semibold bg-amber-50/40">{stat.touchbaseUnsuccessful}</TableCell>}
                      {colVisible("fuTotal")   && <TableCell className="text-center font-semibold text-blue-700 bg-blue-50/40 border-l">{stat.followupCount}</TableCell>}
                      {colVisible("fuSuccess") && <TableCell className="text-center text-green-600 font-semibold bg-blue-50/40">{stat.followupSuccessful}</TableCell>}
                      {colVisible("fuFail")    && <TableCell className="text-center text-red-500 font-semibold bg-blue-50/40">{stat.followupUnsuccessful}</TableCell>}
                      {colVisible("subtotal")  && <TableCell className="text-center font-bold text-gray-800 bg-gray-50 border-l">{subtotal}</TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableFooter>
                <TableRow className="text-xs font-semibold font-mono">
                  <TableCell className="text-gray-700">Total</TableCell>
                  {colVisible("tbTotal")   && <TableCell className="text-center text-amber-700 bg-amber-50 border-l">{grandTotals.touchbaseCount}</TableCell>}
                  {colVisible("tbSuccess") && <TableCell className="text-center text-green-600 bg-amber-50">{grandTotals.touchbaseSuccessful}</TableCell>}
                  {colVisible("tbFail")    && <TableCell className="text-center text-red-500 bg-amber-50">{grandTotals.touchbaseUnsuccessful}</TableCell>}
                  {colVisible("fuTotal")   && <TableCell className="text-center text-blue-700 bg-blue-50 border-l">{grandTotals.followupCount}</TableCell>}
                  {colVisible("fuSuccess") && <TableCell className="text-center text-green-600 bg-blue-50">{grandTotals.followupSuccessful}</TableCell>}
                  {colVisible("fuFail")    && <TableCell className="text-center text-red-500 bg-blue-50">{grandTotals.followupUnsuccessful}</TableCell>}
                  {colVisible("subtotal")  && <TableCell className="text-center font-bold text-gray-800 bg-gray-100 border-l">{grandTotals.subtotal}</TableCell>}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}

        {/* Duration + summary */}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-gray-400 italic">
            Total call duration:{" "}
            <span className="font-medium text-gray-600">{formatDurationMs(totalOutboundDurationMs)}</span>
          </p>
          <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
            Total Outbound: {grandTotals.subtotal}
          </span>
        </div>

        {/* Computation details */}
        {showComputation && (
          <div className="mt-3 p-4 rounded-xl border border-blue-100 bg-blue-50 text-xs text-blue-900 space-y-1.5">
            <p className="font-semibold text-blue-800 mb-1">Computation Details</p>
            <p><strong>{touchbaseLabel}:</strong> Activities where <code>source = "Outbound - Touchbase"</code>.</p>
            <p><strong>{followupLabel}:</strong> Activities where <code>source = "Outbound - Follow-up"</code>.</p>
            <p><strong>{successLabel} / {failLabel}:</strong> Based on <code>call_status</code> field.</p>
            <p><strong>Subtotal:</strong> {touchbaseLabel} count + {followupLabel} count per agent.</p>
            <p><strong>Duration:</strong> Sum of <code>end_date - start_date</code> for all <code>type_activity = "Outbound Calls"</code> records.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
