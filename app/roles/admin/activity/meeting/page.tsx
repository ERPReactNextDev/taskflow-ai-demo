"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, CalendarClock, RefreshCw } from "lucide-react";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { MeetingFormModal } from "@/components/meetings/meeting-form-modal";
import { MeetingDetailDrawer } from "@/components/meetings/meeting-detail-drawer";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { Meeting } from "@/types/meetings";
import { cn } from "@/lib/utils";
import { sileo } from "sileo";

type Tab = "upcoming" | "all" | "past" | "noshow";
const TABS: { key: Tab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "all",      label: "All Meetings" },
  { key: "past",     label: "Past" },
  { key: "noshow",   label: "No Show / Cancelled" },
];

function MeetingsContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const [userDetails, setUserDetails] = useState({ referenceid: "", tsm: "", manager: "", role: "" });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);

  const queryId = searchParams?.get("id") ?? "";
  useEffect(() => { if (queryId && queryId !== userId) setUserId(queryId); }, [queryId, userId, setUserId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => setUserDetails({ referenceid: d.ReferenceID ?? "", tsm: d.TSM ?? "", manager: d.Manager ?? "", role: d.Role ?? "" }))
      .catch(() => {});
  }, [userId]);

  const fetchMeetings = useCallback(async (soft = false) => {
    if (!userDetails.referenceid) return;
    soft ? setRefreshing(true) : setLoading(true);
    try {
      // TSM sees their own meetings + all agents under them
      const params = new URLSearchParams({ limit: "500" });
      const res = await fetch(`/api/meetings?${params}`);
      const d = await res.json();
      if (d.success) setMeetings(d.data ?? []);
    } catch {
      sileo.error({ title: "Error", description: "Failed to load meetings.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setLoading(false); setRefreshing(false); }
  }, [userDetails.referenceid]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const now = new Date().toISOString();
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return meetings.filter(m => {
      if (q) {
        const h = [m.company_name, m.type_activity, m.remarks, m.referenceid].filter(Boolean).join(" ").toLowerCase();
        if (!h.includes(q)) return false;
      }
      switch (activeTab) {
        case "upcoming": return !m.is_cancelled && m.start_date >= now;
        case "past":     return !m.is_cancelled && m.end_date < now;
        case "noshow":   return m.is_cancelled || m.outcome === "No Show";
        default:         return true;
      }
    }).sort((a, b) => activeTab === "upcoming" ? a.start_date.localeCompare(b.start_date) : b.start_date.localeCompare(a.start_date));
  }, [meetings, activeTab, search, now]);

  const counts = useMemo(() => ({
    upcoming: meetings.filter(m => !m.is_cancelled && m.start_date >= now).length,
    all:      meetings.length,
    past:     meetings.filter(m => !m.is_cancelled && m.end_date < now).length,
    noshow:   meetings.filter(m => m.is_cancelled || m.outcome === "No Show").length,
  }), [meetings, now]);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">
        <GlobalTopBar title="All Meetings" rightExtra={
          <Button size="sm" className="text-xs h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Schedule Meeting
          </Button>
        } />
        <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
          <div className="flex border-b bg-white shrink-0 px-4">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cn("flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px",
                  activeTab === tab.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-700")}>
                {tab.label}
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeTab === tab.key ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500")}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50/50 shrink-0">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search meetings or agent..." className="pl-8 h-8 text-xs" />
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-gray-500" onClick={() => fetchMeetings(true)} disabled={refreshing}>
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} /> Refresh
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading...</span></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300"><CalendarClock className="w-12 h-12" /><p className="text-sm text-gray-400">No meetings in this view</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map(m => (
                  <MeetingCard key={m.id} meeting={m} onClick={() => setDetailMeeting(m)} onEdit={() => setEditMeeting(m)} />
                ))}
              </div>
            )}
          </div>
        </div>
        <MeetingFormModal open={createOpen} onClose={() => setCreateOpen(false)}
          onSaved={m => setMeetings(prev => [m, ...prev])}
          defaults={{ referenceid: userDetails.referenceid, tsm: userDetails.tsm, manager: userDetails.manager }}
          canOverrideConflict />
        <MeetingFormModal open={!!editMeeting} onClose={() => setEditMeeting(null)}
          onSaved={updated => { setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m)); setEditMeeting(null); }}
          editMeeting={editMeeting} canOverrideConflict />
        <MeetingDetailDrawer open={!!detailMeeting} onClose={() => setDetailMeeting(null)} meeting={detailMeeting}
          onUpdated={updated => { setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m)); setDetailMeeting(updated); }} />
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function Page() {
  return (
    <UserProvider><FormatProvider><SidebarProvider>
      <Suspense fallback={<div className="flex items-center justify-center h-screen gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading...</span></div>}>
        <MeetingsContent />
      </Suspense>
    </SidebarProvider></FormatProvider></UserProvider>
  );
}
