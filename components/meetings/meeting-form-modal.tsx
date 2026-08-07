import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Calendar } from "lucide-react";
import { sileo } from "sileo";
import {
  Meeting, MEETING_TYPES, localInputToUTC, utcToManilaInput, fmtManila,
} from "@/types/meetings";
import { supabase } from "@/utils/supabase";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MeetingFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
  /** When set, modal is in EDIT mode */
  editMeeting?: Meeting | null;
  /** Pre-fill for create mode */
  defaults?: {
    referenceid: string;
    tsm: string;
    manager: string;
  };
  /** Can override conflict (managers only) */
  canOverrideConflict?: boolean;
}

interface ConflictInfo {
  id: number;
  start_date: string;
  end_date: string;
  type_activity: string;
  company_name: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingFormModal({
  open, onClose, onSaved, editMeeting, defaults, canOverrideConflict = false,
}: MeetingFormModalProps) {
  const isEdit = !!editMeeting;

  const [typeActivity, setTypeActivity] = useState("Client Meeting");
  const [companyName, setCompanyName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo[] | null>(null);
  const [companies, setCompanies] = useState<string[]>([]);

  // Reset / populate on open
  useEffect(() => {
    if (!open) return;
    if (isEdit && editMeeting) {
      setTypeActivity(editMeeting.type_activity ?? "Client Meeting");
      setCompanyName(editMeeting.company_name ?? "");
      setRemarks(editMeeting.remarks ?? "");
      setStartDate(utcToManilaInput(editMeeting.start_date));
      setEndDate(utcToManilaInput(editMeeting.end_date));
      setLocation(editMeeting.location ?? "");
      setMeetingLink(editMeeting.meeting_link ?? "");
    } else {
      setTypeActivity("Client Meeting");
      setCompanyName("");
      setRemarks("");
      setStartDate("");
      setEndDate("");
      setLocation("");
      setMeetingLink("");
    }
    setConflict(null);
  }, [open, isEdit, editMeeting]);

  // Fetch companies for the agent
  useEffect(() => {
    if (!open || !defaults?.referenceid) return;
    fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(defaults.referenceid)}`)
      .then(r => r.json())
      .then(d => setCompanies((d.data ?? []).map((c: any) => c.company_name as string)))
      .catch(() => {});
  }, [open, defaults?.referenceid]);

  const handleSubmit = async (overrideConflict = false) => {
    if (!startDate || !endDate) {
      sileo.warning({ title: "Required", description: "Start and end date are required.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      sileo.warning({ title: "Invalid", description: "End date must be after start date.", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }

    setSaving(true);
    try {
      const startUTC = localInputToUTC(startDate);
      const endUTC   = localInputToUTC(endDate);
      const payload  = {
        type_activity: typeActivity,
        company_name:  companyName || null,
        remarks:       remarks || "No remarks",
        start_date:    startUTC,
        end_date:      endUTC,
        location:      location || null,
        meeting_link:  meetingLink || null,
      };

      if (isEdit && editMeeting) {
        // ── Edit: direct Supabase update ──────────────────────────────────
        const { data, error } = await supabase
          .from("meetings")
          .update(payload)
          .eq("id", editMeeting.id)
          .select()
          .single();
        if (error) throw error;
        sileo.success({ title: "Updated", description: "Meeting updated successfully!", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        onSaved(data as Meeting);
        onClose();
      } else {
        // ── Create: conflict check then insert ────────────────────────────
        if (!overrideConflict) {
          const { data: conflicts } = await supabase
            .from("meetings")
            .select("id, start_date, end_date, type_activity, company_name")
            .eq("referenceid", defaults?.referenceid ?? "")
            .neq("is_cancelled", true)
            .lt("start_date", endUTC)
            .gt("end_date", startUTC);

          if (conflicts && conflicts.length > 0) {
            setConflict(conflicts as any[]);
            setSaving(false);
            return;
          }
        }

        const { data, error } = await supabase
          .from("meetings")
          .insert([{
            ...payload,
            referenceid:  defaults?.referenceid,
            tsm:          defaults?.tsm,
            manager:      defaults?.manager,
            status:       "Scheduled",
            is_cancelled: false,
          }])
          .select()
          .single();
        if (error) throw error;
        sileo.success({ title: "Created", description: "Meeting scheduled successfully!", duration: 3000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        onSaved(data as Meeting);
        onClose();
      }
    } catch (err: any) {
      sileo.error({ title: "Error", description: err.message ?? "Failed to save meeting.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            {isEdit ? "Edit Meeting" : "Schedule Meeting"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            All times are in Asia/Manila timezone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Type */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Meeting Type *</Label>
            <Select value={typeActivity} onValueChange={setTypeActivity}>
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_TYPES.map(t => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company */}
          {typeActivity === "Client Meeting" && (
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Company</Label>
              <Input
                list="company-list"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Search or type company name..."
                className="text-xs h-9"
              />
              <datalist id="company-list">
                {companies.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">Start Date & Time *</Label>
              <Input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs h-9" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold">End Date & Time *</Label>
              <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs h-9" />
            </div>
          </div>

          {/* Location */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Location</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Office, client site, virtual..." className="text-xs h-9" />
          </div>

          {/* Meeting Link */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Meeting Link</Label>
            <Input value={meetingLink} onChange={e => setMeetingLink(e.target.value)} placeholder="https://zoom.us/..." className="text-xs h-9" />
          </div>

          {/* Remarks */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold">Remarks / Agenda</Label>
            <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Add agenda, notes..." className="text-xs resize-none" />
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold">Scheduling Conflict Detected</span>
              </div>
              {conflict.map(c => (
                <div key={c.id} className="text-xs text-amber-700 pl-6">
                  <span className="font-semibold">{c.type_activity}</span>
                  {c.company_name && <span> · {c.company_name}</span>}
                  <br />
                  <span className="text-amber-600">{fmtManila(c.start_date)} – {fmtManila(c.end_date)}</span>
                </div>
              ))}
              {canOverrideConflict && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => { setConflict(null); handleSubmit(true); }}
                >
                  Override & Schedule Anyway (Manager)
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => handleSubmit(false)}
            disabled={saving}
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...</>
              : isEdit ? "Save Changes" : "Schedule Meeting"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
