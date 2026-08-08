"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2Icon, Trash, Check, LoaderPinwheel,
  PhoneOutgoing, PackageCheck, ReceiptText, Activity,
  MoreVertical, MessageSquare, Ban, Mail,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { sileo } from "sileo";
import { supabase } from "@/utils/supabase";
import { DeleteDialog } from "./dialog/delete";
import { DoneDialog } from "../dialog/done";
import { CreateActivityDialog } from "../dialog/create";
import { DeliveredDialog } from "../dialog/delivered";
import { CancelledDialog } from "../dialog/cancelled";
import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { PendingEmailActivityPayload } from "@/components/email/email-quotation-dialog";

// ─── Interfaces (unchanged) ───────────────────────────────────────────────────
interface SupervisorDetails {
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  profilePicture: string | null;
  signatureImage: string | null;
  contact: string | null;
}

interface Activity {
  id: string;
  referenceid: string;
  target_quota?: string;
  tsm: string;
  manager: string;
  activity_reference_number: string;
  account_reference_number: string;
  ticket_reference_number: string;
  agent: string;
  status: string;
  date_updated: string;
  scheduled_date: string;
  date_created: string;
  company_name: string;
  contact_number: string;
  type_client: string;
  email_address: string;
  address: string;
  contact_person: string;
  signature: string | null;
  source_email_message_id?: string | null;
}

interface HistoryItem {
  id: string;
  activity_reference_number: string;
  callback?: string | null;
  date_followup?: string | null;
  quotation_number?: string | null;
  quotation_amount?: number | null;
  so_number?: string | null;
  so_amount?: number | null;
  call_type?: string;
  ticket_reference_number?: string;
  source?: string;
  call_status?: string;
  type_activity: string;
  tsm_approved_status: string;
  tsm_approved_remarks?: string | null;
  quotation_status: string;
  quotation_status_sub: string;
  status?: string;
}

interface NewTaskProps {
  referenceid: string;
  target_quota?: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  managername: string;
  tsm?: string;
  manager?: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;
  onCountChange?: (count: number) => void;
  // Injected from email module — renders a pinned row at top of In Progress
  pendingEmailActivity?: PendingEmailActivityPayload | null;
}

const EXCLUDED_STATUSES = ["Completed", "Delivered"];

export const Progress: React.FC<NewTaskProps> = ({
  referenceid,
  target_quota,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  tsm,
  manager,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  tsmDetails,
  managerDetails,
  signature,
  onCountChange,
  pendingEmailActivity,
}) => {
  // ─── Accumulated data from all fetched pages ─────────────────────────────
  const [activities, setActivities] = useState<Activity[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ─── Pagination state ────────────────────────────────────────────────────
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // ─── Loading states ──────────────────────────────────────────────────────
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ─── Dialog states ────────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<string | null>(null);
  const [dialogDeliveredOpen, setDialogDeliveredOpen] = useState(false);
  const [dialogCancelOpen, setDialogCancelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  // ─── Search & filter ─────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tsmFeedbackOpen, setTsmFeedbackOpen] = useState<string | null>(null);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ─── Build fetch URL ──────────────────────────────────────────────────────
  const buildUrl = useCallback(
    (offset: number) => {
      const isSearching = debouncedSearchTerm.trim().length > 0;
      const url = new URL(
        isSearching
          ? "/api/activity/tsa/planner/search"
          : "/api/activity/tsa/planner/fetch-onprogress",
        window.location.origin,
      );

      url.searchParams.append("referenceid", referenceid);

      if (isSearching) {
        url.searchParams.append("search", debouncedSearchTerm);
      } else {
        url.searchParams.append("offset", String(offset));
      }

      const from = dateCreatedFilterRange?.from
        ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
        : null;
      const to = dateCreatedFilterRange?.to
        ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
        : null;

      if (from && to) {
        url.searchParams.append("from", from);
        url.searchParams.append("to", to);
      }

      return url.toString();
    },
    [referenceid, debouncedSearchTerm, dateCreatedFilterRange],
  );

  // ─── Initial load / reset — fetches page 0 ───────────────────────────────
  const fetchInitial = useCallback(() => {
    if (!referenceid) return;

    setInitialLoading(true);
    setError(null);
    setActivities([]);
    setHistory([]);
    setNextOffset(0);
    setHasMore(false);

    fetch(buildUrl(0))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setActivities(data.activities ?? []);
        setHistory(data.history ?? []);
        setHasMore(data.has_more ?? false);
        setNextOffset(data.next_offset ?? (data.activities?.length ?? 0));
      })
      .catch((err) => setError(err.message))
      .finally(() => setInitialLoading(false));
  }, [referenceid, buildUrl]);

  // ─── Load More — fetches next page and APPENDS ────────────────────────────
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    fetch(buildUrl(nextOffset))
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        setActivities((prev) => [...prev, ...(data.activities ?? [])]);
        setHistory((prev) => [...prev, ...(data.history ?? [])]);
        setHasMore(data.has_more ?? false);
        setNextOffset(data.next_offset ?? nextOffset + (data.activities?.length ?? 0));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextOffset, buildUrl]);

  // ─── Ref for realtime subscriptions ──────────────────────────────────────
  const fetchInitialRef = useRef(fetchInitial);
  useEffect(() => { fetchInitialRef.current = fetchInitial; }, [fetchInitial]);

  // ─── Realtime subscriptions ───────────────────────────────────────────────
  useEffect(() => {
    if (!referenceid) return;

    fetchInitialRef.current();

    const activityChannel = supabase
      .channel(`activity-${referenceid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "activity",
        filter: `referenceid=eq.${referenceid}`,
      }, () => fetchInitialRef.current())
      .subscribe();

    const historyChannel = supabase
      .channel(`history-${referenceid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "history",
        filter: `referenceid=eq.${referenceid}`,
      }, () => fetchInitialRef.current())
      .subscribe();

    return () => {
      activityChannel.unsubscribe();
      supabase.removeChannel(activityChannel);
      historyChannel.unsubscribe();
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid]);

  // ─── Re-fetch from page 0 when search/date filter changes ─────────────────
  useEffect(() => {
    if (referenceid) fetchInitial();
  }, [debouncedSearchTerm, dateCreatedFilterRange, referenceid]); // eslint-disable-line

  // ─── Helper: is today ─────────────────────────────────────────────────────
  const isToday = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // ─── Merge + filter ───────────────────────────────────────────────────────
  const mergedData = activities
    .filter((a) => {
      if (EXCLUDED_STATUSES.includes(a.status)) return false;
      if (a.status === "Quote-Done" && a.scheduled_date && isToday(a.scheduled_date)) return false;
      return true;
    })
    .map((activity) => ({
      ...activity,
      relatedHistoryItems: history.filter(
        (h) => h.activity_reference_number === activity.activity_reference_number,
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime(),
    );

  // Status filter is still client-side (fast, no extra requests needed)
  const filteredData = mergedData.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  useEffect(() => {
    onCountChange?.(filteredData.length);
  }, [filteredData.length]); // eslint-disable-line

  // ─── Dialog handlers (unchanged) ─────────────────────────────────────────
  const openDoneDialog = (id: string) => { setSelectedActivityId(id); setDialogOpen(true); };
  const openDeleteDialog = (id: string) => { setSelectedDeleteId(id); setDeleteDialogOpen(true); };
  const openDeliveredDialog = (id: string) => { setSelectedActivityId(id); setDialogDeliveredOpen(true); };
  const openCancelDialog = (id: string) => { setSelectedActivityId(id); setDialogCancelOpen(true); };

  const handleConfirmDone = async () => {
    if (!selectedActivityId) return;
    try {
      setUpdatingId(selectedActivityId);
      const res = await fetch("/api/act-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok) { toast.error(`Failed to update status: ${result.error || "Unknown error"}`); return; }
      setDialogOpen(false);
      await fetchInitial();
      window.location.reload();
      toast.success("Transaction marked as Done.");
    } catch { toast.error("An error occurred while updating status."); }
    finally { setUpdatingId(null); setSelectedActivityId(null); }
  };

  const handleConfirmDelete = async () => {
    if (!selectedDeleteId) return;
    try {
      setUpdatingId(selectedDeleteId);
      setDeleteDialogOpen(false);
      const res = await fetch("/api/activity/tsa/planner/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [Number(selectedDeleteId)] }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || "Delete failed");
      await fetchInitial();
      toast.success("Activity deleted successfully.");
    } catch (err: any) { toast.error(err.message || "An error occurred while deleting."); }
    finally { setUpdatingId(null); setSelectedDeleteId(null); }
  };

  const handleConfirmDelivered = async () => {
    if (!selectedActivityId) return;
    try {
      setUpdatingId(selectedActivityId);
      const res = await fetch("/api/act-update-status-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: `Failed to update status: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }
      setDialogDeliveredOpen(false);
      await fetchInitial();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Done.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "An error occurred while updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setUpdatingId(null); setSelectedActivityId(null); }
  };

  const handleConfirmCancel = async (remarks: string) => {
    if (!selectedActivityId) return;
    try {
      setUpdatingId(selectedActivityId);
      const res = await fetch("/api/act-update-status-cancelled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, remarks }),
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: `Failed to cancel: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }
      setDialogCancelOpen(false);
      await fetchInitial();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Cancelled.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "An error occurred while cancelling transaction.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally { setUpdatingId(null); setSelectedActivityId(null); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex gap-2 mb-2">
        <Input
          type="search"
          placeholder="Search..."
          className="text-xs grow rounded-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search accounts"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] text-xs rounded-none">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Assisted">Assisted</SelectItem>
            <SelectItem value="On-Progress">On-Progress</SelectItem>
            <SelectItem value="SO-Done">SO-Done</SelectItem>
            <SelectItem value="Quote-Done">Quote-Done</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Pending Email Activity Row ────────────────────────────────────────
          Injected at the top of In Progress when user arrives from email module.
          Renders a highlighted card with 🔗 badge + pre-filled Create button.
      ── */}
      {pendingEmailActivity && (
        <div className="mb-3 border-2 border-blue-400 rounded-none bg-blue-50 shadow-sm">
          {/* Header row */}
          <div className="flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold font-mono uppercase truncate text-blue-900">
                {pendingEmailActivity.company_name}
              </span>
              {/* 🔗 Email badge with tooltip */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-blue-200 text-blue-700 text-[10px] font-bold border border-blue-300 hover:bg-blue-300 transition-colors cursor-default shrink-0"
                    title="View source email details"
                  >
                    <Mail className="w-3 h-3" />
                    <span>Email</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 rounded-none text-xs p-3" align="start">
                  <p className="font-bold text-blue-700 mb-1.5">📧 Source Email</p>
                  <div className="space-y-1 text-gray-700">
                    <div>
                      <span className="font-semibold">Subject: </span>
                      <span className="break-words">{pendingEmailActivity.source_email_subject || "(no subject)"}</span>
                    </div>
                    <div>
                      <span className="font-semibold">From: </span>
                      <span className="break-all">{pendingEmailActivity.source_email_from}</span>
                    </div>
                    {pendingEmailActivity.source_email_date && (
                      <div>
                        <span className="font-semibold">Date: </span>
                        <span>{new Date(pendingEmailActivity.source_email_date).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-blue-600 italic">
                    Click "+ Create" to start the Quotation Preparation activity.
                  </p>
                </PopoverContent>
              </Popover>
            </div>

            {/* Create button — pre-fills Quotation Preparation */}
            <div className="ml-3 shrink-0">
              <CreateActivityDialog
                firstname={firstname}
                lastname={lastname}
                target_quota={target_quota}
                email={email}
                contact={contact}
                tsmname={tsmname}
                managername={managername}
                referenceid={referenceid}
                tsm={tsm ?? ""}
                manager={manager ?? ""}
                type_client={pendingEmailActivity.type_client || ""}
                contact_number={pendingEmailActivity.contact_number || ""}
                email_address={pendingEmailActivity.email_address || ""}
                activityReferenceNumber={undefined}
                ticket_reference_number="-"
                agent={referenceid}
                company_name={pendingEmailActivity.company_name}
                contact_person={pendingEmailActivity.contact_person || ""}
                address={pendingEmailActivity.address || ""}
                accountReferenceNumber={pendingEmailActivity.account_reference_number}
                onCreated={fetchInitial}
                managerDetails={managerDetails ?? null}
                tsmDetails={tsmDetails ?? null}
                signature={signature}
                emailPrefill={{
                  source_email_message_id: pendingEmailActivity.source_email_message_id,
                  source_email_subject: pendingEmailActivity.source_email_subject,
                  source_email_from: pendingEmailActivity.source_email_from,
                  autoOpen: false,
                }}
              />
            </div>
          </div>

          {/* Sub-info strip */}
          <div className="px-3 pb-2 flex flex-wrap gap-1 text-[10px] text-blue-700">
            <Badge className="text-[8px] bg-blue-100 text-blue-700 border-blue-300 uppercase">
              {pendingEmailActivity.type_client || "Account"}
            </Badge>
            <span className="text-blue-500">
              Click + Create → Quotation Preparation will be auto-selected
            </span>
          </div>
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">
        {initialLoading ? (
          <div className="flex justify-center items-center h-40">
            <Spinner className="size-8" />
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {filteredData.map((item) => {
              let badgeClass = "bg-gray-200 text-gray-800";
              let cardBgClass = "bg-gray-100";

              if (item.status === "Assisted" || item.status === "On-Progress") {
                badgeClass = "bg-orange-400 text-white";
                cardBgClass = "bg-orange-100";
              } else if (item.status === "SO-Done") {
                badgeClass = "bg-yellow-400 text-black";
                cardBgClass = "bg-yellow-100";
              } else if (item.status === "Quote-Done") {
                badgeClass = "bg-blue-500 text-white";
                cardBgClass = "bg-blue-100";
              } else if (item.status === "Pending") {
                badgeClass = "bg-purple-500 text-white";
                cardBgClass = "bg-purple-100";
              } else if (item.status === "Cancelled") {
                badgeClass = "bg-red-600 text-white";
                cardBgClass = "bg-red-100";
              }

              return (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className={`w-full border rounded-none ${cardBgClass} shadow-sm mt-2`}
                >
                  <div className="p-2 select-none">
                    <div className="flex justify-between items-center">
                      <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono">
                        {item.company_name}
                      </AccordionTrigger>

                      <div className="flex gap-2 ml-4">
                        <CreateActivityDialog
                          firstname={firstname}
                          lastname={lastname}
                          target_quota={target_quota}
                          email={email}
                          contact={contact}
                          tsmname={tsmname}
                          managername={managername}
                          referenceid={item.referenceid}
                          tsm={item.tsm}
                          manager={item.manager}
                          type_client={item.type_client}
                          contact_number={item.contact_number}
                          email_address={item.email_address}
                          activityReferenceNumber={item.activity_reference_number}
                          ticket_reference_number={item.ticket_reference_number}
                          agent={item.agent}
                          company_name={item.company_name}
                          contact_person={item.contact_person}
                          address={item.address}
                          accountReferenceNumber={item.account_reference_number}
                          onCreated={fetchInitial}
                          managerDetails={managerDetails ?? null}
                          tsmDetails={tsmDetails ?? null}
                          signature={signature}
                        />

                        {item.relatedHistoryItems.some(
                          (h) => h.tsm_approved_status && h.tsm_approved_status !== "-",
                        ) && (() => {
                          const feedbackItems = item.relatedHistoryItems.filter(
                            (h) => h.tsm_approved_status && h.tsm_approved_status !== "-",
                          );
                          return (
                            <Popover
                              open={tsmFeedbackOpen === item.id}
                              onOpenChange={(open) => setTsmFeedbackOpen(open ? item.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 relative"
                                  title="TSM Feedback"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  <Badge
                                    variant="destructive"
                                    className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-[10px]"
                                  >
                                    {feedbackItems.length}
                                  </Badge>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 rounded-none">
                                <div className="space-y-2">
                                  <p className="text-xs font-bold uppercase text-gray-700">TSM Feedback</p>
                                  <div className="text-xs space-y-2 max-h-60 overflow-y-auto">
                                    {feedbackItems.map((h, idx) => (
                                      <div key={idx} className="border-b pb-2 last:border-0">
                                        <div className="font-semibold text-blue-600 uppercase py-1">
                                          {h.tsm_approved_status}
                                        </div>
                                        <div className="space-y-1 text-gray-600">
                                          {h.type_activity && h.type_activity !== "-" && (
                                            <div><span className="font-medium">Type:</span> {h.type_activity}</div>
                                          )}
                                          {h.quotation_number && h.quotation_number !== "-" && (
                                            <div><span className="font-medium">Quotation #:</span> {h.quotation_number}</div>
                                          )}
                                          {h.so_number && h.so_number !== "-" && (
                                            <div><span className="font-medium">SO #:</span> {h.so_number}</div>
                                          )}
                                          {h.call_type && h.call_type !== "-" && (
                                            <div><span className="font-medium">Call Type:</span> {h.call_type}</div>
                                          )}
                                          {h.tsm_approved_remarks && h.tsm_approved_remarks !== "-" && (
                                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                                              <div className="flex items-center gap-1 text-blue-600 font-medium mb-1">
                                                <MessageSquare className="h-3 w-3" />
                                                Remarks:
                                              </div>
                                              <div className="text-gray-700 italic">{h.tsm_approved_remarks}</div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          );
                        })()}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              disabled={updatingId === item.id}
                              className="cursor-pointer rounded-none"
                            >
                              Actions <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              disabled={updatingId === item.id}
                              onClick={(e) => { e.stopPropagation(); openDeliveredDialog(item.id); }}
                            >
                              <Check className="mr-2 h-4 w-4 text-green-600" />
                              Mark as Completed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={updatingId === item.id}
                              onClick={(e) => { e.stopPropagation(); openCancelDialog(item.id); }}
                            >
                              <Ban className="mr-2 h-4 w-4 text-red-600" />
                              Mark as Cancelled
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); openDeleteDialog(item.id); }}
                            >
                              <Trash className="mr-2 text-red-600" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="ml-1 flex flex-wrap gap-1 uppercase">
                      <Badge
                        className={`${badgeClass} rounded-sm shadow-md p-2 font-mono flex items-center gap-2 whitespace-nowrap text-[10px]`}
                      >
                        <LoaderPinwheel size={14} className="animate-spin" />
                        {item.status.replace("-", " ")}
                      </Badge>

                      {item.relatedHistoryItems.some(
                        (h) => !!h.type_activity && h.type_activity !== "-" && h.type_activity.trim() !== "",
                      ) &&
                        Array.from(
                          new Set(
                            item.relatedHistoryItems
                              .map((h) => h.type_activity?.trim() ?? "")
                              .filter((v) => v && v !== "-"),
                          ),
                        ).map((activity) => {
                          const getIcon = (act: string) => {
                            const lowerAct = act.toLowerCase();
                            if (lowerAct.includes("outbound") || lowerAct.includes("call")) return <PhoneOutgoing />;
                            if (lowerAct.includes("sales order") || lowerAct.includes("so prep")) return <PackageCheck />;
                            if (lowerAct.includes("quotation") || lowerAct.includes("quote")) return <ReceiptText />;
                            return <Activity />;
                          };
                          return (
                            <Badge
                              key={activity}
                              variant="outline"
                              className="flex items-center justify-center w-8 h-8 p-0"
                              title={activity.toUpperCase()}
                            >
                              {getIcon(activity)}
                            </Badge>
                          );
                        })}
                    </div>
                  </div>

                  <AccordionContent className="text-xs px-4 py-2 uppercase">
                    <p><strong>Contact Number:</strong> {item.contact_number || "-"}</p>
                    <p><strong>Contact Person:</strong> {item.contact_person || "-"}</p>
                    <p><strong>Email Address:</strong> {item.email_address || "-"}</p>
                    <p><strong>Address:</strong> {item.address || "-"}</p>

                    <Separator className="mb-2 mt-2" />

                    {item.relatedHistoryItems.length === 0 ? (
                      <p>No quotation or SO history available.</p>
                    ) : (
                      <>
                        {item.relatedHistoryItems.some((h) => h.ticket_reference_number && h.ticket_reference_number !== "-") && (
                          <p>
                            <strong>Ticket Reference Number:</strong>{" "}
                            {Array.from(new Set(item.relatedHistoryItems.map((h) => h.ticket_reference_number ?? "-").filter((v) => v !== "-"))).join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.call_type && h.call_type !== "-") && (
                          <p>
                            <strong>Type:</strong>{" "}
                            {item.relatedHistoryItems.map((h) => h.call_type ?? "-").filter((v) => v !== "-").join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.type_activity && h.type_activity !== "-") && (
                          <p>
                            <strong>Type of Activity:</strong>{" "}
                            {Array.from(new Set(item.relatedHistoryItems.map((h) => h.type_activity ?? "-").filter((v) => v !== "-"))).join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.source && h.source !== "-") && (
                          <p>
                            <strong>Source:</strong>{" "}
                            {Array.from(new Set(item.relatedHistoryItems.map((h) => h.source ?? "-").filter((v) => v !== "-"))).join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.quotation_number && h.quotation_number !== "-") && (
                          <p>
                            <strong>Quotation Number:</strong>{" "}
                            {item.relatedHistoryItems.map((h) => h.quotation_number ?? "-").filter((v) => v !== "-").join(", ")}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.quotation_amount !== null && h.quotation_amount !== undefined) && (
                          <p>
                            <strong>Total Quotation Amount:</strong>{" "}
                            {item.relatedHistoryItems.reduce((total, h) => total + (h.quotation_amount ?? 0), 0)
                              .toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.so_number && h.so_number !== "-") && (
                          <p>
                            <strong>SO Number:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems.map((h) => h.so_number ?? "-").filter((v) => v !== "-").join(", ")}
                            </span>
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.so_amount !== null && h.so_amount !== undefined) && (
                          <p>
                            <strong>Total SO Amount:</strong>{" "}
                            {item.relatedHistoryItems.reduce((total, h) => total + (h.so_amount ?? 0), 0)
                              .toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.call_status && h.call_status !== "-") && (
                          <p>
                            <strong>Call Status:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems.map((h) => h.call_status ?? "-").filter((v) => v !== "-").join(", ")}
                            </span>
                          </p>
                        )}
                        {item.relatedHistoryItems.some((h) => h.quotation_status && h.quotation_status !== "-") && (
                          <p>
                            <strong>Quotation Status:</strong>{" "}
                            <span className="uppercase">
                              {Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_status ?? "-").filter((v) => v !== "-"))).join(", ")}
                              {item.relatedHistoryItems.some((h) => h.quotation_status_sub && h.quotation_status_sub !== "-") && (
                                <span className="ml-1 text-blue-600">
                                  ({Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_status_sub ?? "-").filter((v) => v !== "-"))).join(", ")})
                                </span>
                              )}
                            </span>
                          </p>
                        )}
                        <Separator className="mb-2 mt-2" />
                        {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status !== "-") && (
                          <p>
                            <strong>TSM Feedback:</strong>{" "}
                            <span className="uppercase">
                              {item.relatedHistoryItems.map((h) => h.tsm_approved_status ?? "-").filter((v) => v !== "-").join(", ")}
                            </span>
                          </p>
                        )}
                      </>
                    )}

                    <p><strong>Date Created:</strong> {new Date(item.date_created).toLocaleDateString()}</p>
                    <p><strong>Date Updated:</strong> {new Date(item.date_updated).toLocaleDateString()}</p>

                    {/* ── Source Email block — shown when activity was created from email ── */}
                    {item.source_email_message_id && (
                      <>
                        <Separator className="mb-2 mt-2" />
                        <div className="flex items-center gap-1.5 text-blue-600 font-semibold mb-1">
                          <Mail className="w-3 h-3" />
                          <span>Source: Email</span>
                        </div>
                        <div className="pl-4 space-y-0.5 text-[10px] text-gray-500">
                          <p className="font-mono text-gray-400">{item.source_email_message_id}</p>
                          <a
                            href={`/general/email`}
                            className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open Email Module →
                          </a>
                        </div>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* ─── Load More: fetches next 10 from server ─── */}
        {hasMore && !initialLoading && (
          <div className="flex justify-center py-4 mt-4">
            <Button
              variant="outline"
              className="rounded-none text-xs"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <LoaderPinwheel className="animate-spin h-3 w-3" />
                  Loading...
                </span>
              ) : (
                `Load More (${50 - nextOffset} remaining of 50 max)`
              )}
            </Button>
          </div>
        )}
      </div>

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        loading={updatingId !== null}
        title="Delete Activity"
        description="Are you sure you want to delete this activity? This action cannot be undone."
      />
      <DeliveredDialog
        open={dialogDeliveredOpen}
        onOpenChange={setDialogDeliveredOpen}
        onConfirm={handleConfirmDelivered}
        loading={updatingId !== null}
      />
      <CancelledDialog
        open={dialogCancelOpen}
        onOpenChange={setDialogCancelOpen}
        onConfirm={handleConfirmCancel}
        loading={updatingId !== null}
      />
      <DoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmDone}
        loading={updatingId !== null}
      />
    </>
  );
};