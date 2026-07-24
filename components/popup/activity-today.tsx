"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { CalendarCheck, CheckCheck, X, Building2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  scheduled_date: string;
  account_reference_number: string;
  company_name: string;
  status: string;
  date_updated: string;
  activity_reference_number: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_STATUSES   = ["Assisted", "Quote-Done"];
const DISMISSED_KEY      = "dismissedActivities";
const SHOWN_KEY          = "activityShownDate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isToday = (dateStr: string) => {
  const today = new Date();
  const d     = new Date(dateStr);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth()    === today.getMonth()    &&
    d.getDate()     === today.getDate()
  );
};

const getDismissed = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]");
  } catch {
    localStorage.removeItem(DISMISSED_KEY);
    return [];
  }
};

const hasShownToday = (): boolean => {
  if (typeof window === "undefined") return false;
  const lastShown = localStorage.getItem(SHOWN_KEY);
  if (!lastShown) return false;
  const today = new Date().toISOString().split('T')[0];
  return lastShown === today;
};

const markShownToday = () => {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().split('T')[0];
  try {
    localStorage.setItem(SHOWN_KEY, today);
  } catch {
    // Quota exceeded — clear old activity keys and retry
    try {
      localStorage.removeItem(SHOWN_KEY);
      localStorage.removeItem(DISMISSED_KEY);
      localStorage.setItem(SHOWN_KEY, today);
    } catch {}
  }
};

const STATUS_STYLES: Record<string, string> = {
  "Assisted":   "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Quote-Done": "bg-indigo-50  text-indigo-700  border-indigo-200",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityToday() {
  const searchParams  = useSearchParams();
  const { userId, user, setUserId } = useUser();

  const [referenceid,  setReferenceid]  = useState("");
  const [activities,   setActivities]   = useState<Activity[]>([]);
  const [open,         setOpen]         = useState(false);
  const [confirmOpen,  setConfirmOpen]  = useState(false);

  const queryUserId = searchParams?.get("id") ?? "";

  // ── Sync userId from URL ───────────────────────────────────────────────────
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // ── Update referenceid from user context ───────────────────────────────────
  useEffect(() => {
    if (user) {
      setReferenceid(user.ReferenceID || "");
    } else {
      setReferenceid("");
    }
  }, [user]);

  // ── Fetch activities ───────────────────────────────────────────────────────
  const fetchActivities = useCallback(async () => {
    if (!referenceid) return;
    try {
      const res  = await fetch(
        `/api/act-fetch-activity?referenceid=${encodeURIComponent(referenceid)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = await res.json();
      setActivities(json.data || []);
    } catch {/* silently fail */}
  }, [referenceid]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!referenceid) return;

    fetchActivities();

    const channel = supabase
      .channel(`activity-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity", filter: `referenceid=eq.${referenceid}` },
        fetchActivities
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid, fetchActivities]);

  // ── Filter activities ──────────────────────────────────────────────────────
  const filtered = activities
    .filter((a) => isToday(a.scheduled_date))
    .filter((a) => ALLOWED_STATUSES.includes(a.status))
    .filter((a) => !getDismissed().includes(a.id));

  // ── Auto-open when new activities appear (Once per day) ────────────────────
  useEffect(() => {
    if (filtered.length > 0 && !hasShownToday()) {
      setOpen(true);
      markShownToday();
    }
  }, [filtered.length]);

  // ── Dismiss ────────────────────────────────────────────────────────────────
  const confirmDismiss = () => {
    const prev    = getDismissed();
    const updated = Array.from(new Set([...prev, ...filtered.map((a) => a.id)]));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(updated));
    // Clear shown date so dismissed items won't trigger popup again today
    localStorage.removeItem(SHOWN_KEY);
    setConfirmOpen(false);
    setOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 shrink-0">
                <CalendarCheck size={15} className="text-indigo-500" />
              </span>
              {filtered.length} {filtered.length === 1 ? "Activity" : "Activities"} Scheduled Today
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              The following {filtered.length === 1 ? "activity requires" : "activities require"} your attention today.
            </DialogDescription>
          </DialogHeader>

          {/* Activity list */}
          <div className="max-h-[320px] overflow-y-auto space-y-2 mt-1 pr-0.5">
            {filtered.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 size={12} className="text-slate-400 shrink-0" />
                    <p className="text-xs font-bold text-slate-800 truncate uppercase">
                      {a.company_name || "No company name"}
                    </p>
                  </div>
                  {/* Status badge */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0
                    ${STATUS_STYLES[a.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Ref: <span className="font-medium text-slate-600">{a.activity_reference_number || "—"}</span>
                </p>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-2">
            <Button
              size="sm"
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 rounded-xl"
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCheck size={13} /> Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm dismiss dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm w-full">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 border border-amber-100 shrink-0">
                <X size={14} className="text-amber-500" />
              </span>
              Confirm Dismiss
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              This alert will only reappear if new activities are scheduled for today.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              onClick={confirmDismiss}
            >
              <CheckCheck size={12} /> Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}