"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertCircleIcon, CheckCircle2Icon, MoreVertical, LoaderPinwheel, Clock, Plus } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgingStatus = "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "FOLLOWED_UP" | "CONVERTED" | "DISMISSED";

interface AgingRow {
  id: number;
  activity_id: number;
  quotation_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  company_name: string;
  quotation_amount: number;
  tsm_approval_date: string;
  agent_name: string | null;
  tsm_name: string | null;
  aging_days: number;
  reminder_note: string | null;
  follow_up_date: string | null;
  status: string;
  last_follow_up_date: string | null;
  last_follow_up_note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // computed
  days_aging: number;
  days_remaining: number;
  aging_status: AgingStatus;
}

interface Summary {
  total: number;
  overdue_count: number;
  due_soon_count: number;
  on_track_count: number;
  converted_count: number;
  total_amount: number;
  overdue_amount: number;
}

interface QuotationAgingProps {
  referenceid: string;
  tsmname?: string;
}

// ── Status badge helper ───────────────────────────────────────────────────────

const STATUS_STYLES: Record<AgingStatus, string> = {
  OVERDUE:    "bg-red-100 text-red-700",
  DUE_SOON:   "bg-amber-100 text-amber-700",
  ON_TRACK:   "bg-green-100 text-green-700",
  FOLLOWED_UP:"bg-blue-100 text-blue-700",
  CONVERTED:  "bg-emerald-100 text-emerald-700",
  DISMISSED:  "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<AgingStatus, string> = {
  OVERDUE:    "Overdue",
  DUE_SOON:   "Due Soon",
  ON_TRACK:   "On Track",
  FOLLOWED_UP:"Followed Up",
  CONVERTED:  "Converted",
  DISMISSED:  "Dismissed",
};

function fmtPHP(n: number) {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit" });
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "DUE_SOON", label: "Due Soon" },
  { key: "ON_TRACK", label: "On Track" },
  { key: "FOLLOWED_UP", label: "Followed Up" },
  { key: "CONVERTED", label: "Converted" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const QuotationAging: React.FC<QuotationAgingProps> = ({ referenceid, tsmname }) => {
  const [rows,       setRows]       = useState<AgingRow[]>([]);
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab,  setActiveTab]  = useState("ALL");

  // ── Dialogs ────────────────────────────────────────────────────────────────
  const [editOpen,    setEditOpen]    = useState(false);
  const [editRow,     setEditRow]     = useState<AgingRow | null>(null);
  const [followOpen,  setFollowOpen]  = useState(false);
  const [followRow,   setFollowRow]   = useState<AgingRow | null>(null);
  const [confirmRow,  setConfirmRow]  = useState<AgingRow | null>(null);
  const [confirmType, setConfirmType] = useState<"CONVERTED_TO_SO" | "DISMISSED" | "DELETE" | null>(null);
  const [saving,      setSaving]      = useState(false);

  // Edit form state
  const [editDays,    setEditDays]    = useState(7);
  const [editNote,    setEditNote]    = useState("");
  const [editFollowDt,setEditFollowDt]= useState("");

  // Follow-up form state
  const [followNote,  setFollowNote]  = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRows = useCallback(async (search = "") => {
    if (!referenceid) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ referenceid });
      if (search) params.append("search", search);
      const res  = await fetch(`/api/quotation-aging?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRows(data.data ?? []);
      setSummary(data.summary ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [referenceid]);

  const handleSearch = useCallback(() => fetchRows(searchTerm), [fetchRows, searchTerm]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel(`quotation-aging-${referenceid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quotation_aging", filter: `tsm=eq.${referenceid}` }, () => fetchRows())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [referenceid, fetchRows]);

  // ── Filtered rows by tab ───────────────────────────────────────────────────
  const displayed = useMemo(() => activeTab === "ALL" ? rows : rows.filter(r => r.aging_status === activeTab), [rows, activeTab]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const openEdit = (r: AgingRow) => {
    setEditRow(r); setEditDays(r.aging_days); setEditNote(r.reminder_note ?? "");
    setEditFollowDt(r.follow_up_date ? r.follow_up_date.slice(0, 16) : "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    await fetch("/api/quotation-aging", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editRow.id, aging_days: editDays, reminder_note: editNote || null, follow_up_date: editFollowDt || null }) });
    setSaving(false); setEditOpen(false); fetchRows();
  };

  const openFollow = (r: AgingRow) => { setFollowRow(r); setFollowNote(""); setFollowOpen(true); };

  const saveFollow = async () => {
    if (!followRow || !followNote.trim()) return;
    setSaving(true);
    await fetch("/api/quotation-aging", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: followRow.id, status: "FOLLOWED_UP", last_follow_up_date: new Date().toISOString(), last_follow_up_note: followNote }) });
    setSaving(false); setFollowOpen(false); fetchRows();
  };

  const openConfirm = (r: AgingRow, type: typeof confirmType) => { setConfirmRow(r); setConfirmType(type); };

  const runConfirm = async () => {
    if (!confirmRow || !confirmType) return;
    setSaving(true);
    if (confirmType === "DELETE") {
      await fetch(`/api/quotation-aging?id=${confirmRow.id}`, { method: "DELETE" });
    } else {
      await fetch("/api/quotation-aging", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmRow.id, status: confirmType }) });
    }
    setSaving(false); setConfirmRow(null); setConfirmType(null); fetchRows();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="border p-3 rounded-none bg-white">
            <p className="text-[10px] uppercase font-bold text-gray-500">Total Aging Quotes</p>
            <p className="text-xl font-black tabular-nums">{summary.total}</p>
            <p className="text-xs text-gray-400 tabular-nums">{fmtPHP(summary.total_amount)}</p>
          </div>
          <div className="border p-3 rounded-none bg-red-50">
            <p className="text-[10px] uppercase font-bold text-red-600">Overdue</p>
            <p className="text-xl font-black tabular-nums text-red-700">{summary.overdue_count}</p>
            <p className="text-xs text-red-500 tabular-nums">{fmtPHP(summary.overdue_amount)}</p>
          </div>
          <div className="border p-3 rounded-none bg-amber-50">
            <p className="text-[10px] uppercase font-bold text-amber-600">Due Soon (≤2 days)</p>
            <p className="text-xl font-black tabular-nums text-amber-700">{summary.due_soon_count}</p>
          </div>
          <div className="border p-3 rounded-none bg-emerald-50">
            <p className="text-[10px] uppercase font-bold text-emerald-600">Converted to SO</p>
            <p className="text-xl font-black tabular-nums text-emerald-700">{summary.converted_count}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Input type="text" placeholder="Search by quote #, company, agent..."
            className="rounded-none pl-9 text-xs"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSearch(); }} />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <Button onClick={handleSearch} disabled={loading}
          className="h-9 px-4 rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium">
          {loading ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "Search"}
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="mb-3 flex gap-1 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1 text-xs font-bold uppercase border rounded-none transition-colors ${
              activeTab === tab.key ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-300 hover:border-zinc-500"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs mb-3">
          <div className="flex items-center space-x-3">
            <AlertCircleIcon className="h-6 w-6 text-red-600" />
            <div>
              <AlertTitle>Error loading aging data</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </div>
          </div>
        </Alert>
      )}

      {/* Record count */}
      {displayed.length > 0 && (
        <div className="mb-2 text-xs font-bold">Showing {displayed.length} record{displayed.length !== 1 ? "s" : ""}</div>
      )}

      {/* Empty state */}
      {!loading && !error && displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Clock className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-semibold">No aging quotes found</p>
          <p className="text-xs mt-1">Add approved quotes to the aging tracker from the Approved Quotations page.</p>
        </div>
      )}

      {/* Table */}
      {displayed.length > 0 && (
        <div className="overflow-auto custom-scrollbar">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px] text-center">Tools</TableHead>
                <TableHead>Quotation #</TableHead>
                <TableHead>Company / Project</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Approved Date</TableHead>
                <TableHead className="text-center">Aging (days)</TableHead>
                <TableHead className="text-center">Threshold</TableHead>
                <TableHead className="text-center">Days Left</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Next Follow-Up</TableHead>
                <TableHead>Last Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map(row => {
                const rowDimmed = row.aging_status === "DISMISSED" || row.aging_status === "CONVERTED";
                const isToday = row.follow_up_date
                  ? new Date(row.follow_up_date).toDateString() === new Date().toDateString()
                  : false;
                return (
                  <TableRow key={row.id} className={rowDimmed ? "opacity-50" : ""}>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className="rounded-none flex items-center gap-1 text-xs h-8 px-2">
                            Actions <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none text-xs">
                          <DropdownMenuItem onClick={() => openEdit(row)} className="cursor-pointer">✏️ Edit Aging</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openFollow(row)} className="cursor-pointer">📝 Log Follow-Up</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openConfirm(row, "CONVERTED_TO_SO")} className="cursor-pointer text-emerald-700">✅ Mark as Converted</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openConfirm(row, "DISMISSED")} className="cursor-pointer text-gray-500">🚫 Mark as Dismissed</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openConfirm(row, "DELETE")} className="cursor-pointer text-red-600">🗑️ Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="font-mono uppercase font-bold">{row.quotation_number || "-"}</TableCell>
                    <TableCell>
                      <span className="font-semibold">{row.company_name}</span>
                      {row.activity_id && <><br /><span className="text-[10px] italic text-gray-400">#{row.activity_id}</span></>}
                    </TableCell>
                    <TableCell className="uppercase">{row.agent_name || "-"}</TableCell>
                    <TableCell className="tabular-nums font-mono">{fmtPHP(Number(row.quotation_amount) || 0)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(row.tsm_approval_date)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`text-lg font-black tabular-nums ${row.days_aging > row.aging_days ? "text-red-700" : "text-gray-800"}`}>{row.days_aging}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono">{row.aging_days}</TableCell>
                    <TableCell className="text-center font-black tabular-nums">
                      <span className={row.days_remaining < 0 ? "text-red-700" : row.days_remaining <= 2 ? "text-amber-600" : "text-green-700"}>
                        {row.days_remaining < 0 ? `${row.days_remaining}` : `+${row.days_remaining}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[row.aging_status]}`}>
                        {STATUS_LABELS[row.aging_status]}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.follow_up_date ? (
                        <span className={`flex items-center gap-1 ${isToday ? "font-bold text-amber-700" : ""}`}>
                          {isToday && <Clock className="w-3 h-3" />}
                          {fmtDateTime(row.follow_up_date)}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-[10px] whitespace-nowrap text-gray-500">
                      {row.last_follow_up_date ? (
                        <><span>{fmtDate(row.last_follow_up_date)}</span><br /><span className="italic">{row.last_follow_up_note}</span></>
                      ) : fmtDate(row.updated_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Aging Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="uppercase text-sm font-black">Edit Aging Settings</DialogTitle></DialogHeader>
          {editRow && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 border p-3 text-gray-600">
                <div><p className="font-bold uppercase">Quote #</p><p className="font-mono">{editRow.quotation_number}</p></div>
                <div><p className="font-bold uppercase">Company</p><p>{editRow.company_name}</p></div>
                <div><p className="font-bold uppercase">Amount</p><p className="tabular-nums">{fmtPHP(Number(editRow.quotation_amount))}</p></div>
                <div><p className="font-bold uppercase">Approved</p><p>{fmtDate(editRow.tsm_approval_date)}</p></div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase">Aging Threshold (days)</label>
                <Input type="number" min={1} value={editDays} onChange={e => setEditDays(Number(e.target.value))} className="rounded-none mt-1 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase">Reminder Note</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={3}
                  className="w-full mt-1 border text-xs p-2 rounded-none resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400" placeholder="Optional note..." />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase">Next Follow-Up Date</label>
                <input type="datetime-local" value={editFollowDt} onChange={e => setEditFollowDt(e.target.value)}
                  className="w-full mt-1 border text-xs p-2 rounded-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-none text-xs">Cancel</Button>
            <Button onClick={saveEdit} disabled={saving} className="rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs">
              {saving ? <LoaderPinwheel className="w-3 h-3 animate-spin mr-1" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Follow-Up Dialog */}
      <Dialog open={followOpen} onOpenChange={setFollowOpen}>
        <DialogContent className="rounded-none max-w-md">
          <DialogHeader><DialogTitle className="uppercase text-sm font-black">Log Follow-Up</DialogTitle></DialogHeader>
          {followRow && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 border p-3 text-gray-600">
                <div><p className="font-bold uppercase">Quote #</p><p className="font-mono">{followRow.quotation_number}</p></div>
                <div><p className="font-bold uppercase">Company</p><p>{followRow.company_name}</p></div>
                <div><p className="font-bold uppercase">Aging</p><p className="font-black text-red-600">{followRow.days_aging} days</p></div>
                <div><p className="font-bold uppercase">Status</p><span className={`px-2 py-0.5 ${STATUS_STYLES[followRow.aging_status]}`}>{STATUS_LABELS[followRow.aging_status]}</span></div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase">Follow-Up Notes <span className="text-red-500">*</span></label>
                <textarea value={followNote} onChange={e => setFollowNote(e.target.value)} rows={4} required
                  className="w-full mt-1 border text-xs p-2 rounded-none resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400" placeholder="Describe the follow-up action taken..." />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFollowOpen(false)} className="rounded-none text-xs">Cancel</Button>
            <Button onClick={saveFollow} disabled={saving || !followNote.trim()} className="rounded-none bg-zinc-900 hover:bg-zinc-800 text-white text-xs">
              {saving ? <LoaderPinwheel className="w-3 h-3 animate-spin mr-1" /> : null} Mark as Followed Up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmRow} onOpenChange={v => { if (!v) { setConfirmRow(null); setConfirmType(null); } }}>
        <DialogContent className="rounded-none max-w-sm">
          <DialogHeader><DialogTitle className="uppercase text-sm font-black">
            {confirmType === "DELETE" ? "Delete Entry" : confirmType === "CONVERTED_TO_SO" ? "Mark as Converted" : "Mark as Dismissed"}
          </DialogTitle></DialogHeader>
          <p className="text-xs text-gray-600">
            {confirmType === "DELETE" ? `Remove "${confirmRow?.quotation_number}" from the aging tracker?` :
             confirmType === "CONVERTED_TO_SO" ? `Mark "${confirmRow?.quotation_number}" as converted to Sales Order?` :
             `Dismiss "${confirmRow?.quotation_number}" from the aging tracker?`}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmRow(null); setConfirmType(null); }} className="rounded-none text-xs">Cancel</Button>
            <Button onClick={runConfirm} disabled={saving}
              className={`rounded-none text-white text-xs ${confirmType === "DELETE" ? "bg-red-700 hover:bg-red-800" : "bg-zinc-900 hover:bg-zinc-800"}`}>
              {saving ? <LoaderPinwheel className="w-3 h-3 animate-spin mr-1" /> : null} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
