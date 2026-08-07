"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Link as LinkIcon, CalendarCheck, FileText, ClipboardList } from "lucide-react";
import { sileo } from "sileo";
import {
  Meeting, MEETING_OUTCOMES, STATUS_COLORS, TYPE_COLORS,
  fmtManila, fmtManilaDate, utcToManilaInput, localInputToUTC,
} from "@/types/meetings";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MeetingDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  onUpdated: (updated: Meeting) => void;
}

type DrawerTab = "details" | "outcome" | "followup";

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingDetailDrawer({ open, onClose, meeting, onUpdated }: MeetingDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("details");
  const [outcome, setOutcome] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate when meeting changes
  React.useEffect(() => {
    if (!meeting) return;
    setOutcome(meeting.outcome ?? "");
    setOutcomeNotes(meeting.outcome_notes ?? "");
    setFollowUpDate(meeting.follow_up_date ? utcToManilaInput(meeting.follow_up_date) : "");
    setFollowUpNotes(meeting.follow_up_notes ?? "");
    setActiveTab("details");
  }, [meeting?.id]);

  const save = async (payload: Record<string, any>) => {
    if (!meeting) return;
    setSaving(true);
    try {
      // Use Supabase directly — no API route, no ID routing issues
      const { data, error } = await supabase
        .from("meetings")
        .update(payload)
        .eq("id", meeting.id)
        .select()
        .single();

      if (error) throw error;
      onUpdated(data as Meeting);
      sileo.success({ title: "Saved", description: "Meeting updated.", duration: 2500, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch (err: any) {
      sileo.error({ title: "Error", description: err.message, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setSaving(false);
    }
  };

  const saveOutcome = () => save({
    outcome,
    outcome_notes: outcomeNotes,
    status: "Completed",
    conversion_score_delta: ({
      "Quotation Requested": 15, "Proposal Sent": 10, "Interested": 8,
      "No Decision": 0, "Closed Won": 40, "Not Interested": -20,
      "Rescheduled": -5, "Referred Lead": 10, "No Show": 0,
    } as Record<string, number>)[outcome] ?? 0,
  });
  const saveFollowUp = () => save({
    follow_up_date: followUpDate ? localInputToUTC(followUpDate) : null,
    follow_up_notes: followUpNotes,
  });

  if (!meeting) return null;

  const statusCls = STATUS_COLORS[meeting.status ?? "Scheduled"] ?? STATUS_COLORS["Scheduled"];
  const typeCls   = TYPE_COLORS[meeting.type_activity] ?? TYPE_COLORS["Client Meeting"];

  const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { key: "details",  label: "Details",   icon: <FileText className="w-3.5 h-3.5" /> },
    { key: "outcome",  label: "Outcome",   icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { key: "followup", label: "Follow-Up", icon: <CalendarCheck className="w-3.5 h-3.5" /> },
  ];

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-[420px] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b bg-gray-50 shrink-0">
          <SheetTitle className="text-sm font-bold text-gray-800 leading-tight">
            {meeting.type_activity}
            {meeting.company_name && (
              <span className="ml-2 text-gray-500 font-normal">· {meeting.company_name}</span>
            )}
          </SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", typeCls)}>
              {meeting.type_activity}
            </span>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", statusCls)}>
              {meeting.status ?? "Scheduled"}
            </span>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── Details tab ── */}
          {activeTab === "details" && (
            <div className="space-y-4">
              <DetailRow label="Date" value={fmtManilaDate(meeting.start_date)} />
              <DetailRow label="Start" value={fmtManila(meeting.start_date, { hour: "numeric", minute: "2-digit", hour12: true })} />
              <DetailRow label="End"   value={fmtManila(meeting.end_date, { hour: "numeric", minute: "2-digit", hour12: true })} />
              {meeting.company_name && <DetailRow label="Company" value={meeting.company_name} />}
              {meeting.location && (
                <DetailRow label="Location" icon={<MapPin className="w-3 h-3 text-gray-400" />} value={meeting.location} />
              )}
              {meeting.meeting_link && (
                <div className="flex items-start gap-2">
                  <LinkIcon className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 underline break-all"
                  >
                    {meeting.meeting_link}
                  </a>
                </div>
              )}
              {meeting.remarks && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Notes / Agenda</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{meeting.remarks}</p>
                </div>
              )}
              {meeting.cancellation_reason && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Cancellation Reason</p>
                  <p className="text-xs text-red-700">{meeting.cancellation_reason}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Outcome tab ── */}
          {activeTab === "outcome" && (
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Meeting Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Select outcome..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_OUTCOMES.map(o => (
                      <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Outcome Notes</Label>
                <Textarea
                  value={outcomeNotes}
                  onChange={e => setOutcomeNotes(e.target.value)}
                  rows={4}
                  placeholder="What happened? Key discussion points..."
                  className="text-xs resize-none"
                />
              </div>
              {meeting.conversion_score_delta !== null && meeting.conversion_score_delta !== undefined && (
                <div className={cn(
                  "text-xs rounded-lg px-3 py-2 font-semibold",
                  meeting.conversion_score_delta > 0 ? "bg-emerald-50 text-emerald-700" :
                  meeting.conversion_score_delta < 0 ? "bg-red-50 text-red-700" :
                  "bg-gray-50 text-gray-600"
                )}>
                  Conversion Score: {meeting.conversion_score_delta > 0 ? "+" : ""}{meeting.conversion_score_delta}
                </div>
              )}
              <Button
                className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white h-9"
                onClick={saveOutcome}
                disabled={saving || !outcome}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Save Outcome
              </Button>
            </div>
          )}

          {/* ── Follow-Up tab ── */}
          {activeTab === "followup" && (
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Follow-Up Date</Label>
                <Input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-semibold">Follow-Up Notes</Label>
                <Textarea
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  rows={4}
                  placeholder="What's the next step?"
                  className="text-xs resize-none"
                />
              </div>
              <Button
                className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white h-9"
                onClick={saveFollowUp}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Save Follow-Up
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {icon ?? <div className="w-3 h-3" />}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-0.5">{label}</span>
        <span className="text-xs text-gray-800">{value}</span>
      </div>
    </div>
  );
}
