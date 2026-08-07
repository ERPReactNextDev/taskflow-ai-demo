"use client";

import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw, Building2, MapPin, Phone, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { ConversionStatusBadge, ConversionProgressBar, type ConversionStatus } from "./conversion-status-badge";
import { ActivityTimeline } from "./activity-timeline";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  account_reference_number: string;
  company_name: string;
  type_client: string;
  industry: string;
  region: string;
  status: string;
  conversion_status: ConversionStatus;
  conversion_probability: number;
  pipeline_stage: string;
  conversion_flags: string | null;
  date_created: string;
  date_updated: string;
  contact_person: string;
  contact_number: string;
}

interface PipelineBoardProps {
  referenceid: string;
}

const COLUMNS: { key: ConversionStatus; label: string; color: string; headerColor: string }[] = [
  { key: "NEW LEAD",           label: "New Leads",           color: "bg-gray-50 border-gray-200",    headerColor: "bg-gray-100 border-gray-200 text-gray-700" },
  { key: "PROSPECT",           label: "Prospects",           color: "bg-blue-50 border-blue-100",    headerColor: "bg-blue-100 border-blue-200 text-blue-800" },
  { key: "QUALIFIED PROSPECT", label: "Qualified",           color: "bg-amber-50 border-amber-100",  headerColor: "bg-amber-100 border-amber-200 text-amber-800" },
  { key: "COMMITTED PROSPECT", label: "Committed",           color: "bg-orange-50 border-orange-100",headerColor: "bg-orange-100 border-orange-200 text-orange-800" },
  { key: "OFFICIAL CLIENT",    label: "Official Clients",    color: "bg-emerald-50 border-emerald-100",headerColor: "bg-emerald-100 border-emerald-200 text-emerald-800" },
];

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onRunConversion }: { lead: Lead; onRunConversion: (ref: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const flags = lead.conversion_flags ? lead.conversion_flags.split(", ").filter(Boolean) : [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-800 leading-tight truncate">{lead.company_name}</p>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{lead.account_reference_number}</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-gray-500">
          {lead.industry && (
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{lead.industry}</span>
          )}
          {lead.region && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.region}</span>
          )}
          {lead.contact_number && (
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.contact_number}</span>
          )}
        </div>

        {/* Probability bar */}
        <div className="mt-2">
          <ConversionProgressBar
            probability={lead.conversion_probability}
            status={lead.conversion_status}
          />
        </div>

        {/* Flags */}
        {flags.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {flags.map(f => (
              <span key={f} className="text-[9px] flex items-center gap-0.5 text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                <AlertTriangle className="w-2.5 h-2.5" /> {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded: Activity Timeline */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3 bg-gray-50/50 rounded-b-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Activity Timeline</p>
          <ActivityTimeline accountReferenceNumber={lead.account_reference_number} />

          <button
            onClick={(e) => { e.stopPropagation(); onRunConversion(lead.account_reference_number); }}
            className="mt-3 w-full text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded py-1.5 transition-colors"
          >
            🔄 Re-check Conversion Status
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pipeline Board ───────────────────────────────────────────────────────────

export function PipelineBoard({ referenceid }: PipelineBoardProps) {
  const [grouped, setGrouped] = useState<Record<string, Lead[]>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchPipeline = useCallback(async () => {
    if (!referenceid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lead-conversion/pipeline?referenceid=${encodeURIComponent(referenceid)}`);
      const d = await res.json();
      if (d.success) { setGrouped(d.grouped); setTotals(d.totals); }
    } finally {
      setLoading(false);
    }
  }, [referenceid]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  const runConversionAll = async () => {
    setRunning(true);
    try {
      await fetch("/api/lead-conversion/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid }),
      });
      await fetchPipeline();
    } finally {
      setRunning(false);
    }
  };

  const runConversionOne = async (ref: string) => {
    await fetch("/api/lead-conversion/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_reference_number: ref }),
    });
    await fetchPipeline();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading pipeline...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-800">Lead Pipeline</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Auto-updated from activity history · {Object.values(totals).reduce((a, b) => a + b, 0)} total records
          </p>
        </div>
        <button
          onClick={runConversionAll}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", running && "animate-spin")} />
          {running ? "Updating..." : "Run Conversion Engine"}
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
        {COLUMNS.map(col => {
          const leads = (grouped[col.key] ?? []) as Lead[];
          return (
            <div key={col.key} className="flex flex-col min-w-[220px] w-[220px] shrink-0">
              {/* Column header */}
              <div className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg border mb-2",
                col.headerColor
              )}>
                <span className="text-[11px] font-black uppercase tracking-wide">{col.label}</span>
                <span className="text-[11px] font-bold tabular-nums bg-white/60 rounded-full px-1.5 py-0.5">
                  {totals[col.key] ?? 0}
                </span>
              </div>

              {/* Cards */}
              <div className={cn(
                "flex-1 rounded-lg border p-2 space-y-2 overflow-y-auto max-h-[600px]",
                col.color
              )}>
                {leads.length === 0 ? (
                  <p className="text-[10px] text-gray-300 text-center py-4">No records</p>
                ) : (
                  leads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onRunConversion={runConversionOne} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
