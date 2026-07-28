"use client";

import React, { useState, useEffect } from "react";
import { MeetingDialog } from "./dialog/meeting";
import { Plus, Trash2, List, Pencil, CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/utils/supabase";
import { sileo } from "sileo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingItem {
  id: number;
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;
  remarks: string;
  start_date: string;
  end_date: string;
  date_created: string;
  date_updated: string | null;
}

interface MeetingProps {
  referenceid: string;
  tsm: string;
  manager: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const datePart = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${datePart} · ${h}:${min} ${ampm}`;
}

// Convert UTC ISO string from DB → "YYYY-MM-DDTHH:MM" for datetime-local input (local time)
function toInputValue(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  // Convert UTC to local time for the input field
  const result = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  console.log(`[toInputValue] Input (UTC): ${dateStr} -> Output (local): ${result}`);
  return result;
}

// Convert datetime-local value (local time) → UTC ISO string for PostgreSQL timestamp
// datetime-local format: "YYYY-MM-DDTHH:MM"
function toUTCISOString(dateStr: string) {
  if (!dateStr) return "";

  // Parse the datetime-local string components (local time)
  const [datePart, timePart] = dateStr.split('T');
  if (!datePart || !timePart) return "";

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  // Create date object assuming LOCAL time
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (isNaN(localDate.getTime())) return "";

  // Convert to UTC by subtracting timezone offset
  const tzOffset = localDate.getTimezoneOffset() * 60000; // offset in milliseconds
  const utcDate = new Date(localDate.getTime() - tzOffset);

  // Return UTC ISO string
  const result = utcDate.toISOString();
  console.log(`[toUTCISOString] Input (local): ${dateStr} -> Output (UTC): ${result}`);
  return result;
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditMeetingDialog({
  open,
  onClose,
  meeting,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  meeting: MeetingItem | null;
  onUpdated: (updated: MeetingItem) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate fields when meeting changes
  useEffect(() => {
    if (meeting) {
      console.log(`[useEffect] Loading meeting data:`, meeting);
      const startInput = toInputValue(meeting.start_date);
      const endInput = toInputValue(meeting.end_date);
      console.log(`[useEffect] Set input values - start: ${startInput}, end: ${endInput}`);
      setStartDate(startInput);
      setEndDate(endInput);
      setRemarks(meeting.remarks || "");
      setError(null);
    }
  }, [meeting]);

  const handleSave = async () => {
    if (!meeting) return;

    // Basic validation
    if (!startDate || !endDate) {
      setError("Start date and end date are required.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date cannot be later than end date.");
      return;
    }

    setSaving(true);
    setError(null);

    console.log(`[handleSave] Saving meeting - startDate input: ${startDate}, endDate input: ${endDate}`);

    try {
      const startIso = toUTCISOString(startDate);
      const endIso = toUTCISOString(endDate);

      console.log(`[handleSave] Converted to UTC ISO - start: ${startIso}, end: ${endIso}`);

      const { data, error: supaErr } = await supabase
        .from("meetings")
        .update({
          start_date: startIso,
          end_date: endIso,
          remarks,
          date_updated: new Date().toISOString(),
        })
        .eq("id", meeting.id)
        .select()
        .single();

      if (supaErr) throw supaErr;

      onUpdated(data as MeetingItem);
      onClose();

      sileo.success({
        title: "Updated",
        description: "Meeting updated successfully!",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch (err: any) {
      setError(err.message || "Failed to update meeting.");
      sileo.error({
        title: "Failed",
        description: "Failed to update meeting, try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setSaving(false);
    }
  };

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Pencil size={14} className="text-indigo-500" />
            Edit Meeting
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update the schedule and remarks for{" "}
            <span className="font-semibold uppercase">{meeting.type_activity}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* Start Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Start Date & Time</Label>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">End Date & Time</Label>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
            />
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add notes or remarks..."
              rows={3}
              className="text-xs resize-none border-slate-200 bg-slate-50 focus:ring-indigo-400 focus:border-indigo-400"
            />
          </div>

          {/* Validation error */}
          {error && (
            <p className="text-[11px] text-red-500 font-medium">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Meeting Card ─────────────────────────────────────────────────────────────

function MeetingCard({
  meeting,
  onDelete,
  onEdit,
}: {
  meeting: MeetingItem;
  onDelete: (id: number) => void;
  onEdit: (meeting: MeetingItem) => void;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-lg">
      <CardHeader className="flex flex-row items-start justify-between pb-2 pt-4 px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 shrink-0">
            <CalendarClock size={14} className="text-indigo-500" />
          </span>
          <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wide truncate">
            {meeting.type_activity}
          </CardTitle>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Edit button */}
          <button
            onClick={() => onEdit(meeting)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all"
            title="Edit meeting"
          >
            <Pencil size={13} />
          </button>

          {/* Delete button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                title="Delete meeting"
              >
                <Trash2 size={13} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Meeting?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The meeting will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={() => onDelete(meeting.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="text-[11px] space-y-1.5 px-4 pb-4 text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 w-10 shrink-0">Start</span>
          <span>{formatDateTime(meeting.start_date)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-500 w-10 shrink-0">End</span>
          <span>{formatDateTime(meeting.end_date)}</span>
        </div>
        {meeting.remarks && (
          <div className="flex items-start gap-1.5 pt-0.5">
            <span className="font-semibold text-slate-500 w-10 shrink-0 pt-px">Note</span>
            <span className="capitalize text-slate-500 leading-relaxed">{meeting.remarks}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Meeting({ referenceid, tsm, manager }: MeetingProps) {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MeetingItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("*")
          .eq("referenceid", referenceid)
          .order("date_created", { ascending: false });
        if (error) throw error;
        setMeetings(data || []);
      } catch {
        sileo.error({ title: "Failed", description: "Failed to load meetings.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, [referenceid]);

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      sileo.success({ title: "Deleted", description: "Meeting deleted successfully!", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Failed to delete meeting, try again.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  };
  const handleEdit = (meeting: MeetingItem) => {
    setEditTarget(meeting);
    setEditOpen(true);
  };

  const handleUpdated = (updated: MeetingItem) => {
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleMeetingCreated = (newMeeting: MeetingItem) => {
    setMeetings((prev) => [newMeeting, ...prev]);
  };

  const latest = meetings.slice(0, 1);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Meetings</h2>
        <MeetingDialog
          referenceid={referenceid}
          tsm={tsm}
          manager={manager}
          onMeetingCreated={handleMeetingCreated}
        >
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 rounded-lg">
            <Plus size={13} /> Create
          </Button>
        </MeetingDialog>
      </div>

      <Separator />

      {/* Content */}
      {loading ? (
        <p className="text-xs text-slate-400 py-4 text-center">Loading meetings...</p>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-300">
          <CalendarClock size={32} strokeWidth={1} />
          <p className="text-xs font-medium">No meetings yet</p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* View All button */}
          {meetings.length > 1 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5 rounded-lg"
                onClick={() => setViewAllOpen(true)}
              >
                <List size={13} /> View All ({meetings.length})
              </Button>
            </div>
          )}

          {/* Latest meeting */}
          {latest.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* ── View All Dialog ── */}
      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="max-w-lg w-full max-h-[80vh] overflow-auto rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800">
              All Meetings
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} found.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onDelete={handleDelete}
                onEdit={(m) => {
                  setViewAllOpen(false);  // close view all, open edit
                  handleEdit(m);
                }}
              />
            ))}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="text-xs rounded-lg"
              onClick={() => setViewAllOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <EditMeetingDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        meeting={editTarget}
        onUpdated={handleUpdated}
      />
    </div>
  );
}