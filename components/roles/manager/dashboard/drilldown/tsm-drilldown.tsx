"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Settings, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  ManagerKpiWeightedScores,
  computeKpi,
  barColor,
  scoreLabel,
  type AgentKpiData,
} from "@/components/roles/manager/dashboard/card/kpi-weighted-scores";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TsmDrilldownProps {
  manager: string;
  dateRange?: { from?: Date; to?: Date };
}

const HIDDEN_TSM_KEY = "manager-drilldown-hidden-tsm";
function loadHiddenTsm(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_TSM_KEY) ?? "[]")); } catch { return new Set(); }
}
function saveHiddenTsm(s: Set<string>) {
  try { localStorage.setItem(HIDDEN_TSM_KEY, JSON.stringify([...s])); } catch {}
}

// ── TSM Summary Card — exact same style as AgentSummaryCard ──────────────────

function TsmCard({ tsmCode, tsmName, agentCount, avgKpi, onClick, onHide }: {
  tsmCode: string; tsmName: string; agentCount: number; avgKpi: number;
  onClick: () => void; onHide: () => void;
}) {
  const color   = barColor(avgKpi);
  const { label: statusLabel, color: statusColor } = scoreLabel(avgKpi);
  const fillPct = (avgKpi / 5) * 100;

  return (
    <button type="button" onClick={onClick}
      className="w-full text-left bg-white border border-gray-100 rounded-xl shadow-sm p-3 flex flex-col gap-2 hover:shadow-md hover:border-gray-200 transition-all group relative">
      <button type="button" onClick={(e) => { e.stopPropagation(); onHide(); }}
        className="absolute top-1.5 right-1.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-600 z-10">
        <X className="w-3 h-3" />
      </button>
      <p className="text-[11px] uppercase font-bold text-gray-900 truncate leading-tight pr-4" title={tsmCode}>{tsmName}</p>
      <p className="text-[9px] text-gray-400 -mt-1 truncate font-mono">{tsmCode}</p>
      <div className="flex items-end justify-between gap-1">
        <span className="text-2xl font-extrabold leading-none" style={{ color }}>{avgKpi.toFixed(2)}</span>
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 group-hover:bg-gray-900 group-hover:text-white text-gray-500 text-[9px] font-black uppercase tracking-wider transition-colors">
          View →
        </span>
      </div>
      <div className="w-full bg-gray-100 h-1 rounded-full">
        <div className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(fillPct, 100)}%`, backgroundColor: color }} />
      </div>
      <p className={`text-[9px] font-bold truncate ${statusColor}`}>{statusLabel}</p>
      <p className="text-[9px] text-gray-400 mt-0.5">{agentCount} agent{agentCount !== 1 ? "s" : ""} under this TSM</p>
    </button>
  );
}

// ── Main Drilldown Component ──────────────────────────────────────────────────

export function TsmDrilldown({ manager, dateRange }: TsmDrilldownProps) {
  const [level,           setLevel]           = useState<1 | 2 | 3>(1);
  const [selectedTsmCode, setSelectedTsmCode] = useState<string | null>(null);
  const [selectedTsmName, setSelectedTsmName] = useState<string>("");
  const [selectedAgent,   setSelectedAgent]   = useState<AgentKpiData | null>(null);

  // ── Agent data + loading ─────────────────────────────────────────────────
  const [allAgents,     setAllAgents]     = useState<AgentKpiData[]>([]);
  const [hasFetched,    setHasFetched]    = useState(false);
  const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set());
  const fetchIdRef = useRef(0);

  const toDateStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const triggerGenerate = useCallback(async () => {
    if (!manager) return;
    const fetchId = ++fetchIdRef.current;
    setAllAgents([]);
    setHasFetched(false);
    setLoadingAgents(new Set());

    const base = new URLSearchParams({ manager });
    if (dateRange?.from) base.append("from", toDateStr(dateRange.from));
    if (dateRange?.to)   base.append("to",   toDateStr(dateRange.to));

    try {
      // Step 1: get agent stubs
      const listParams = new URLSearchParams(base);
      listParams.set("listOnly", "true");
      const listRes = await fetch(`/api/manager-kpi?${listParams}`);
      if (!listRes.ok || fetchId !== fetchIdRef.current) return;
      const listData = await listRes.json();
      if (!listData.success) return;

      const stubs: { referenceid: string; name: string; tsm: string; tsm_code: string; tsm_full_name: string }[] = listData.agents ?? [];
      if (stubs.length === 0) { setHasFetched(true); return; }

      setLoadingAgents(new Set(stubs.map((s) => s.referenceid)));

      // Step 2: fetch each agent's KPI sequentially
      for (const stub of stubs) {
        if (fetchId !== fetchIdRef.current) return;
        const agentParams = new URLSearchParams(base);
        agentParams.set("referenceid", stub.referenceid);
        try {
          const res = await fetch(`/api/manager-kpi?${agentParams}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (!data.success || !data.agents?.length || fetchId !== fetchIdRef.current) continue;
          const agentData: AgentKpiData = data.agents[0];
          setAllAgents((prev) => {
            const idx = prev.findIndex((a) => a.referenceid === agentData.referenceid);
            if (idx >= 0) { const n = [...prev]; n[idx] = agentData; return n; }
            return [...prev, agentData];
          });
        } catch { /* silent */ }
        setLoadingAgents((prev) => { const n = new Set(prev); n.delete(stub.referenceid); return n; });
      }
    } catch { /* silent */ }

    if (fetchId === fetchIdRef.current) setHasFetched(true);
  }, [manager, dateRange]);
  const [hiddenTsm,    setHiddenTsm]    = useState<Set<string>>(() => loadHiddenTsm());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const hideTsm = (code: string) => setHiddenTsm((prev) => {
    const n = new Set(prev); n.add(code); saveHiddenTsm(n); return n;
  });
  const toggleTsm = (code: string) => setHiddenTsm((prev) => {
    const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); saveHiddenTsm(n); return n;
  });

  // ── TSM grouping + average KPI ───────────────────────────────────────────
  const tsmSummaries = useMemo(() => {
    if (allAgents.length === 0) return [];
    const groups = new Map<string, { tsm_code: string; tsm_full_name: string; agents: AgentKpiData[] }>();
    for (const agent of allAgents) {
      const code     = agent.tsm_code || agent.tsm;
      const fullName = agent.tsm_full_name || agent.tsm || code;
      if (!code) continue;
      if (!groups.has(code)) groups.set(code, { tsm_code: code, tsm_full_name: fullName, agents: [] });
      groups.get(code)!.agents.push(agent);
    }
    return [...groups.values()]
      .map(({ tsm_code, tsm_full_name, agents }) => {
        const scores = agents.map((a) => computeKpi(a).totalScore);
        const avgKpi = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
        return { tsm_code, tsm_name: tsm_full_name.toUpperCase(), agentCount: agents.length, avgKpi: Number(avgKpi.toFixed(2)) };
      })
      .sort((a, b) => b.avgKpi - a.avgKpi);
  }, [allAgents]);

  const isLoading = loadingAgents.size > 0;

  const goToLevel2 = (tsmCode: string, tsmName: string) => {
    setSelectedTsmCode(tsmCode); setSelectedTsmName(tsmName); setSelectedAgent(null); setLevel(2);
  };
  const goToLevel3 = (agent: AgentKpiData) => { setSelectedAgent(agent); setLevel(3); };
  const goBack = () => {
    if (level === 3) { setSelectedAgent(null); setLevel(2); }
    else             { setSelectedTsmCode(null); setSelectedTsmName(""); setLevel(1); }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border px-6 py-8">

      {/* ── LEVEL 1: TSM LIST ───────────────────────────────────────────── */}
      {level === 1 && (
        <>
          {/* Header with Generate Data + Settings */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
                KPI Weighted Scores — Team View (out of 5.0)
              </p>
              {hasFetched && tsmSummaries.length > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {tsmSummaries.length} TSM{tsmSummaries.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSettingsOpen(true)}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                title="Show/hide TSMs">
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={triggerGenerate}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase rounded-md transition-colors">
                Generate Data
              </button>
              {isLoading && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Spinner className="w-3.5 h-3.5" />
                  <span>{loadingAgents.size} agent{loadingAgents.size !== 1 ? "s" : ""} remaining…</span>
                </div>
              )}
            </div>
          </div>

          {/* Settings panel */}
          {settingsOpen && tsmSummaries.length > 0 && (
            <div className="fixed inset-0 z-[200] flex justify-end">
              <div className="absolute inset-0 bg-black/20" onClick={() => setSettingsOpen(false)} />
              <div className="relative w-72 h-full bg-white shadow-2xl flex flex-col z-10">
                <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-700">TSM Visibility</span>
                  </div>
                  <button onClick={() => setSettingsOpen(false)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Toggle to show / hide each TSM</p>
                  {tsmSummaries.map((tsm) => {
                    const hidden = hiddenTsm.has(tsm.tsm_code);
                    return (
                      <div key={tsm.tsm_code} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className={`text-xs flex-1 pr-2 truncate ${hidden ? "text-gray-400 line-through" : "text-gray-700"}`}>{tsm.tsm_name}</span>
                        <button onClick={() => toggleTsm(tsm.tsm_code)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${hidden ? "bg-gray-100 text-gray-400 hover:bg-blue-50 hover:text-blue-600" : "bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500"}`}>
                          {hidden ? "Show" : "Hide"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-3 border-t">
                  <button onClick={() => { setHiddenTsm(new Set()); saveHiddenTsm(new Set()); }}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                    Show all TSMs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty / loading states */}
          {!hasFetched && !isLoading && (
            <p className="text-xs text-gray-400 text-center py-8">Click "Generate Data" to load KPI data.</p>
          )}

          {/* TSM cards grid */}
          {hasFetched && (
            <>
              {tsmSummaries.filter((t) => !hiddenTsm.has(t.tsm_code)).length === 0 ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-8 text-center text-xs text-gray-400">
                  No active TSMs found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {tsmSummaries
                    .filter((t) => !hiddenTsm.has(t.tsm_code))
                    .map((tsm) => (
                      <TsmCard key={tsm.tsm_code} tsmCode={tsm.tsm_code} tsmName={tsm.tsm_name}
                        agentCount={tsm.agentCount} avgKpi={tsm.avgKpi}
                        onClick={() => goToLevel2(tsm.tsm_code, tsm.tsm_name)}
                        onHide={() => hideTsm(tsm.tsm_code)}
                      />
                    ))}
                </div>
              )}
              {hiddenTsm.size > 0 && (
                <p className="text-[10px] text-gray-400 mt-1 text-right">
                  {hiddenTsm.size} TSM{hiddenTsm.size !== 1 ? "s" : ""} hidden —{" "}
                  <button onClick={() => { setHiddenTsm(new Set()); saveHiddenTsm(new Set()); }} className="underline hover:text-gray-600">show all</button>
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* ── LEVEL 2: AGENTS UNDER TSM ──────────────────────────────────── */}
      {level === 2 && selectedTsmCode && (
        <ManagerKpiWeightedScores manager={manager} dateRange={dateRange}
          tsm={selectedTsmCode} mode="tsm" showBack onBack={goBack}
          autoFetch hideGenerate onAgentClick={goToLevel3} />
      )}

      {/* ── LEVEL 3: SINGLE AGENT ──────────────────────────────────────── */}
      {level === 3 && selectedAgent && (
        <ManagerKpiWeightedScores manager={manager} dateRange={dateRange}
          tsm={selectedTsmCode ?? undefined} referenceid={selectedAgent.referenceid}
          mode="agent" showBack onBack={goBack} autoFetch hideGenerate />
      )}
    </div>
  );
}
