"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { LoaderPinwheel, CheckCircle2, AlertCircle, PhoneOutgoing, PackageCheck, ReceiptText, Activity, ThumbsUp, Check, Repeat, MoreVertical, ThumbsDown, Dot, Filter, MessageSquare, Lock, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { sileo } from "sileo";

import { CreateActivityDialog } from "../dialog/create";
import { CancelledDialog } from "../dialog/cancelled";
import { DeliveredDialog } from "../dialog/delivered";
import { TransferDialog } from "../dialog/transfer";

import { type DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// ─── Helpers (stable, outside component) ──────────────────────────────────────

function toLocalDateString(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA");
}

function normalizeDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateActivityRef(companyName: string, region: string): string {
  const words = companyName.trim().split(" ");
  const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
  const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";
  const uniqueNumber = String(Date.now()).slice(-10);
  return `${firstInitial}${lastInitial}-${region}-${uniqueNumber}`;
}

function fmtPeso(n: number): string {
  return n.toLocaleString("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
}

// ─── Top 50 Forecast types ─────────────────────────────────────────────────────

interface Top50Account {
  account_reference_number: string;
  company_name: string;
  type_client: string;
  status: string;
}

interface ForecastEntry {
  latestSale: number;
  forecastAmount: number;
  currentMonthSales: number;
}

interface Top50StatusData {
  top50Accounts: Top50Account[];
  pendingTop50: Top50Account[];
  allClearTop50: boolean;
  forecastMap: Record<string, ForecastEntry>;
}

function getStatusStyles(status: string, isFutureDate: boolean) {
  switch (status) {
    case "Assisted":
    case "On-Progress":
      return { badgeClass: "bg-orange-500 text-white", bgClass: "bg-orange-100" };
    case "SO-Done":
      return { badgeClass: "bg-yellow-400 text-white", bgClass: "bg-yellow-100" };
    case "Quote-Done":
      return {
        badgeClass: isFutureDate ? "bg-blue-800 text-white" : "bg-blue-500 text-white",
        bgClass: "bg-blue-100",
      };
    case "Cancelled":
      return { badgeClass: "bg-red-600 text-white", bgClass: "bg-red-100" };
    default:
      return { badgeClass: "", bgClass: "bg-white" };
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_STATUSES = ["Assisted", "Quote-Done", "On-Progress"];
const SCHEDULED_BATCH_SIZE = 10;
const CLUSTER_BATCH_SIZE = 5;

const CLUSTER_ORDER = [
  "top 50",
  "next 30",
  "balance 20",
  "tsa client",
  "new client",
  "csr client",
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SupervisorDetails {
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  profilePicture: string | null;
  signatureImage: string | null;
  contact: string | null;
}

interface ActivityItem {
  id: string;
  referenceid: string;
  target_quota?: string;
  tsm: string;
  manager: string;
  activity_reference_number: string;
  account_reference_number: string;
  ticket_reference_number: string;
  ticket_remarks: string;
  status: string;
  agent: string;
  date_updated: string;
  scheduled_date: string;
  date_created: string;
  company_name: string;
  contact_number: string;
  type_client: string;
  email_address: string;
  address: string;
  contact_person: string;
}

interface Account {
  id: string;
  tsm: string;
  manager: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  type_client: string;
  address: string;
  region: string;
  account_reference_number: string;
  next_available_date?: string | null;
  status: string;
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
  tsm_approved_status: string;
  type_activity: string;
  quotation_status: string;
  status?: string;
}

interface ScheduledProps {
  referenceid: string;
  target_quota?: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  tsm: string;
  managername: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
  signature: string | null;
  onCountChange?: (count: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const Scheduled: React.FC<ScheduledProps> = ({
  referenceid,
  tsm,
  target_quota,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  tsmDetails,
  managerDetails,
  signature,
  onCountChange,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDeliveredOpen, setDialogDeliveredOpen] = useState(false);
  const [dialogTransferOpen, setDialogTransferOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [tsmFeedbackOpen, setTsmFeedbackOpen] = useState<string | null>(null);
  const [displayedScheduledCount, setDisplayedScheduledCount] = useState(SCHEDULED_BATCH_SIZE);
  const [displayedTodayCount, setDisplayedTodayCount] = useState(CLUSTER_BATCH_SIZE);
  const [displayedAvailableCount, setDisplayedAvailableCount] = useState(CLUSTER_BATCH_SIZE);

  // ─── Top 50 Priority State ────────────────────────────────────────────────
  const [top50Status, setTop50Status] = useState<Top50StatusData | null>(null);
  const [loadingTop50, setLoadingTop50] = useState(false);

  const fetchTop50Status = useCallback(async () => {
    if (!referenceid) return;
    setLoadingTop50(true);
    try {
      const res = await fetch(
        `/api/activity/tsa/planner/top50-status?referenceid=${encodeURIComponent(referenceid)}`
      );
      if (!res.ok) throw new Error("Failed to fetch Top 50 status");
      const data: Top50StatusData = await res.json();
      setTop50Status(data);
    } catch (err) {
      console.error("[Top50Status]", err);
    } finally {
      setLoadingTop50(false);
    }
  }, [referenceid]);

  const todayStr = toLocalDateString(new Date());

  // ─── Debounce search ───────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ─── URL builder ───────────────────────────────────────────────────────────

  const buildActivitiesUrl = useCallback(
    (offset: number) => {
      const isSearching = debouncedSearchTerm.trim().length > 0;
      const url = new URL(
        isSearching
          ? "/api/activity/tsa/planner/search"
          : "/api/activity/tsa/planner/fetch-scheduled",
        window.location.origin,
      );
      url.searchParams.append("referenceid", referenceid);
      if (isSearching) {
        url.searchParams.append("search", debouncedSearchTerm);
      } else {
        url.searchParams.append("offset", String(offset));
      }
      return url.toString();
    },
    [referenceid, debouncedSearchTerm],
  );

  // ─── Fetch activities ──────────────────────────────────────────────────────

  const fetchActivities = useCallback(() => {
    if (!referenceid) return;

    setInitialLoading(true);
    setError(null);
    setActivities([]);
    setHistory([]);
    setNextOffset(0);
    setHasMore(false);

    fetch(buildActivitiesUrl(0))
      .then((res) => { if (!res.ok) throw new Error("Failed to fetch"); return res.json(); })
      .then((data) => {
        setActivities(data.activities ?? []);
        setHistory(data.history ?? []);
        setHasMore(data.has_more ?? false);
        setNextOffset(data.next_offset ?? (data.activities?.length ?? 0));
      })
      .catch((err) => setError(err.message))
      .finally(() => setInitialLoading(false));
  }, [referenceid, buildActivitiesUrl]);

  const loadMoreActivities = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    fetch(buildActivitiesUrl(nextOffset))
      .then((res) => { if (!res.ok) throw new Error("Failed to fetch"); return res.json(); })
      .then((data) => {
        setActivities((prev) => [...prev, ...(data.activities ?? [])]);
        setHistory((prev) => [...prev, ...(data.history ?? [])]);
        setHasMore(data.has_more ?? false);
        setNextOffset(data.next_offset ?? nextOffset + (data.activities?.length ?? 0));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, nextOffset, buildActivitiesUrl]);

  // Stable ref so realtime callbacks never go stale
  const fetchActivitiesRef = useRef(fetchActivities);
  useEffect(() => { fetchActivitiesRef.current = fetchActivities; }, [fetchActivities]);

  // ─── Fetch accounts ────────────────────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    if (!referenceid) { setAccounts([]); return; }
    try {
      const response = await fetch(
        `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`
      );
      if (!response.ok) { setError("Failed to fetch accounts"); return; }
      const data = await response.json();
      setAccounts(data.data || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  }, [referenceid]);

  // ─── Initial load + realtime subscriptions ─────────────────────────────────

  useEffect(() => {
    if (!referenceid) return;

    fetchActivitiesRef.current();
    fetchAccounts();
    fetchTop50Status();

    const activityChannel = supabase
      .channel(`activity-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity", filter: `referenceid=eq.${referenceid}` },
        () => fetchActivitiesRef.current(),
      )
      .subscribe();

    const historyChannel = supabase
      .channel(`history-${referenceid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "history", filter: `referenceid=eq.${referenceid}` },
        () => { fetchActivitiesRef.current(); fetchTop50Status(); },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activityChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [referenceid, fetchAccounts, fetchTop50Status]);

  // Re-fetch when search term changes
  useEffect(() => {
    if (referenceid) fetchActivitiesRef.current();
  }, [debouncedSearchTerm, referenceid]);

  // ─── Cluster grouping ──────────────────────────────────────────────────────

  const filteredAccounts = useMemo(() =>
    accounts.filter(({ status }) => {
      const s = status?.toLowerCase();
      return s !== "subject for transfer" && s !== "removed" && s !== "approved for deletion";
    }),
    [accounts],
  );

  const groupByCluster = useCallback(
    (dateCondition: (date: string | null) => boolean) => {
      const grouped: Record<string, Account[]> = {};
      for (const cluster of CLUSTER_ORDER) {
        grouped[cluster] = filteredAccounts.filter(
          (acc) =>
            acc.type_client?.toLowerCase() === cluster &&
            dateCondition(normalizeDate(acc.next_available_date)) &&
            acc.status?.toLowerCase() !== "pending",
        );
      }
      return grouped;
    },
    [filteredAccounts],
  );

  const groupedToday = useMemo(() => groupByCluster((d) => d === todayStr), [groupByCluster, todayStr]);
  const groupedNull = useMemo(() => groupByCluster((d) => d === null), [groupByCluster]);

  const firstNonEmptyCluster = (grouped: Record<string, Account[]>) => {
    for (const cluster of CLUSTER_ORDER) {
      if (grouped[cluster]?.length) return cluster;
    }
    return null;
  };

  const firstTodayCluster = useMemo(() => firstNonEmptyCluster(groupedToday), [groupedToday]);
  const firstAvailableCluster = useMemo(() => firstNonEmptyCluster(groupedNull), [groupedNull]);

  const totalTodayCount = useMemo(
    () => Object.values(groupedToday).reduce((sum, arr) => sum + arr.length, 0),
    [groupedToday],
  );
  const totalAvailableCount = useMemo(
    () => Object.values(groupedNull).reduce((sum, arr) => sum + arr.length, 0),
    [groupedNull],
  );

  // ─── Activity filtering ────────────────────────────────────────────────────

  const mergedActivities = useMemo(() =>
    activities
      .filter((a) => ALLOWED_STATUSES.includes(a.status))
      .map((activity) => ({
        ...activity,
        relatedHistoryItems: history.filter(
          (h) => h.activity_reference_number === activity.activity_reference_number,
        ),
      }))
      .filter((activity) => {
        const itemScheduledDate = toLocalDateString(activity.scheduled_date);
        
        // If status is "Assisted", only show if it has "For Sched" call_type and scheduled_date is today
        if (activity.status === "Assisted") {
          return activity.relatedHistoryItems.some(
            (h) => h.call_type === "For Sched"
          ) && itemScheduledDate === todayStr;
        }
        // If status is "Quote-Done", show if scheduled_date is today
        if (activity.status === "Quote-Done") {
          return itemScheduledDate === todayStr;
        }
        // For other statuses, only show if they have "For Sched" call_type and scheduled_date is today
        return activity.relatedHistoryItems.some(
          (h) => h.call_type === "For Sched"
        ) && itemScheduledDate === todayStr;
      }),
    [activities, history, todayStr],
  );

  const filteredActivities = useMemo(() =>
    mergedActivities
      .filter((item) => {
        const itemScheduledDate = toLocalDateString(item.scheduled_date);

        if (dateCreatedFilterRange?.from) {
          const fromDate = toLocalDateString(dateCreatedFilterRange.from);
          const toDate = dateCreatedFilterRange.to
            ? toLocalDateString(dateCreatedFilterRange.to)
            : fromDate;
          if (itemScheduledDate < todayStr) return false;
          if (itemScheduledDate < fromDate || itemScheduledDate > toDate) return false;
        } else {
          if (itemScheduledDate !== todayStr) return false;
        }

        if (statusFilter !== "All" && item.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime()),
    [mergedActivities, dateCreatedFilterRange, todayStr, statusFilter],
  );

  const displayedScheduledData = filteredActivities.slice(0, displayedScheduledCount);

  // ─── Side-effect: reset pagination on filter/search change ────────────────

  useEffect(() => {
    setDisplayedScheduledCount(SCHEDULED_BATCH_SIZE);
  }, [debouncedSearchTerm, statusFilter]);

  useEffect(() => {
    setDisplayedTodayCount(CLUSTER_BATCH_SIZE);
    setDisplayedAvailableCount(CLUSTER_BATCH_SIZE);
  }, [accounts]);

  useEffect(() => {
    onCountChange?.(filteredActivities.length);
  }, [filteredActivities, onCountChange]);

  // ─── Cluster activity creation ─────────────────────────────────────────────

  const createActivityHandler = useCallback(
    (account: Account) => async () => {
      const now = new Date();
      const newDate =
        account.type_client.toLowerCase() === "top 50"
          ? new Date(now.setDate(now.getDate() + 14))
          : new Date(now.setMonth(now.getMonth() + 1));

      try {
        await fetch("/api/act-update-account-next-date", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: account.id,
            next_available_date: newDate.toISOString().split("T")[0],
          }),
        });
        setAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
        fetchActivitiesRef.current();
        // Re-check Top 50 status after creating an activity for a Top 50 account
        fetchTop50Status();
      } catch (err) {
        console.error("Error updating next available date:", err);
      }
    },
    [fetchTop50Status],
  );

  // ─── Dialog handlers ───────────────────────────────────────────────────────

  const openCancelledDialog = (id: string) => { setSelectedActivityId(id); setDialogOpen(true); };
  const openDeliveredDialog = (id: string) => { setSelectedActivityId(id); setDialogDeliveredOpen(true); };
  const openTransferDialog = (id: string) => { setSelectedActivityId(id); setDialogTransferOpen(true); };

  const handleConfirmCancelled = async (cancellationRemarks: string) => {
    if (!selectedActivityId || !cancellationRemarks) return;

    setUpdatingId(selectedActivityId);
    setDialogOpen(false);

    try {
      const res = await fetch("/api/act-cancelled-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, cancellation_remarks: cancellationRemarks }),
      });

      if (!res.ok) {
        const result = await res.json();
        sileo.error({ title: "Failed", description: `Failed to update: ${result.error || "Unknown error"}`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }

      fetchActivitiesRef.current();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Cancelled.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Error updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!selectedActivityId) return;

    setUpdatingId(selectedActivityId);

    try {
      const res = await fetch("/api/act-update-status-delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId }),
      });

      if (!res.ok) {
        const result = await res.json();
        sileo.error({ title: "Failed", description: result.error || "Failed to update", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }

      setDialogDeliveredOpen(false);
      fetchActivitiesRef.current();
      window.location.reload();
      sileo.success({ title: "Success", description: "Transaction marked as Completed.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Error updating status.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  const handleConfirmTransfer = async (selectedUserReferenceID: string | undefined) => {
    if (!selectedActivityId || !selectedUserReferenceID) {
      sileo.error({ title: "Failed", description: "Please select a user.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }

    setUpdatingId(selectedActivityId);
    setDialogTransferOpen(false);

    try {
      const res = await fetch("/api/act-transfer-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedActivityId, newReferenceID: selectedUserReferenceID }),
      });

      if (!res.ok) {
        const result = await res.json();
        sileo.error({ title: "Failed", description: result.error || "Failed to transfer", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }

      fetchActivitiesRef.current();
      sileo.success({ title: "Success", description: "Transaction transferred.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } catch {
      sileo.error({ title: "Failed", description: "Error transferring.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setUpdatingId(null);
      setSelectedActivityId(null);
    }
  };

  // ─── Derived dialog state ──────────────────────────────────────────────────

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedTicketReferenceNumber = selectedActivity?.ticket_reference_number ?? null;

  const activeDateLabel = dateCreatedFilterRange?.from
    ? (() => {
        const from = toLocalDateString(dateCreatedFilterRange.from);
        const to = dateCreatedFilterRange.to ? toLocalDateString(dateCreatedFilterRange.to) : from;
        return from === to ? `Scheduled: ${from}` : `Scheduled: ${from} → ${to}`;
      })()
    : `Scheduled today: ${todayStr}`;

  // ─── Render helpers ────────────────────────────────────────────────────────

  const getActivityIcon = (act: string) => {
    const lowerAct = act.toLowerCase();
    if (lowerAct.includes("outbound") || lowerAct.includes("call")) return <PhoneOutgoing size={14} />;
    if (lowerAct.includes("sales order") || lowerAct.includes("so prep")) return <PackageCheck size={14} />;
    if (lowerAct.includes("quotation") || lowerAct.includes("quote")) return <ReceiptText size={14} />;
    return <Activity size={14} />;
  };

  // ─── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Search and Filter */}
      <div className="flex items-center gap-2 w-full mb-2">
        <Input
          type="search"
          placeholder="Search..."
          className="text-xs grow rounded-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="whitespace-nowrap rounded-none">
              {statusFilter === "All" ? <Filter /> : statusFilter} Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setStatusFilter("All")}>
              <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" />
              All
            </DropdownMenuItem>
            {ALLOWED_STATUSES.map((status) => {
              const { badgeClass } = getStatusStyles(status, false);
              return (
                <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${badgeClass}`} />
                  <span className="capitalize">{status}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-[10px] text-muted-foreground mb-1 px-1">{activeDateLabel}</p>

      <div className="max-h-[70vh] overflow-auto space-y-6 custom-scrollbar">
        {/* ─── Scheduled Activities ──────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold mb-4">Scheduled Activities ({filteredActivities.length})</h2>

          {initialLoading ? (
            <div className="flex justify-center items-center h-20">
              <Spinner className="size-6" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <p className="text-muted-foreground text-xs px-2">No scheduled activities found.</p>
          ) : (
            <>
              <Accordion type="single" collapsible className="w-full">
                {displayedScheduledData.map((item) => {
                  const itemDate = toLocalDateString(item.scheduled_date);
                  const isFutureDate = itemDate > todayStr;
                  const { badgeClass, bgClass } = getStatusStyles(item.status, isFutureDate);

                  const feedbackItems = item.relatedHistoryItems.filter(
                    (h) => h.tsm_approved_status && h.tsm_approved_status !== "-",
                  );

                  const uniqueActivityTypes = Array.from(
                    new Set(
                      item.relatedHistoryItems
                        .map((h) => h.type_activity?.trim() ?? "")
                        .filter((v) => v && v !== "-"),
                    ),
                  );

                  const tsmStatuses = Array.from(
                    new Set(
                      item.relatedHistoryItems
                        .map((h) => h.tsm_approved_status?.trim().toLowerCase() ?? "")
                        .filter((v) => v && v !== "-" && v !== "pending"),
                    ),
                  );

                  return (
                    <AccordionItem key={item.id} value={item.id} className={`w-full border rounded-none shadow-sm mt-2 ${bgClass}`}>
                      <div className="p-2 select-none">
                        <div className="flex justify-between items-center">
                          <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer">
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
                              onCreated={() => fetchActivitiesRef.current()}
                              managerDetails={managerDetails ?? null}
                              tsmDetails={tsmDetails ?? null}
                              signature={signature}
                            />

                            {feedbackItems.length > 0 && (
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
                                          <div className="font-semibold text-blue-600 uppercase py-1">{h.tsm_approved_status}</div>
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
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button className="cursor-pointer rounded-none">Actions <MoreVertical /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    disabled={updatingId === item.id}
                                    onClick={(e) => { e.stopPropagation(); openDeliveredDialog(item.id); }}
                                  >
                                    <Check className="mr-2 h-4 w-4 text-green-600" /> Mark as Completed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={updatingId === item.id}
                                    onClick={(e) => { e.stopPropagation(); openCancelledDialog(item.id); }}
                                  >
                                    <AlertCircle className="mr-2 h-4 w-4 text-red-600" /> Cancel
                                  </DropdownMenuItem>
                                  {item.ticket_remarks === "Reassigned" && (
                                    <DropdownMenuItem
                                      disabled={updatingId === item.id}
                                      onClick={(e) => { e.stopPropagation(); openTransferDialog(item.id); }}
                                    >
                                      <Repeat className="mr-2 h-4 w-4 text-blue-600" /> Transfer
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="ml-1 flex flex-wrap gap-1 uppercase">
                          {!["assisted", "not assisted"].includes(item.status.toLowerCase()) && (
                            <Badge
                              variant="secondary"
                              className={`font-mono rounded-sm shadow-md p-2 border-none text-[10px] ${badgeClass}`}
                            >
                              <CheckCircle2 />
                              {item.status.replace("-", " ")} /
                              {item.relatedHistoryItems.some((h) => h.quotation_status && h.quotation_status !== "-") && (
                                <span className="uppercase ml-1">
                                  {Array.from(
                                    new Set(
                                      item.relatedHistoryItems
                                        .map((h) => h.quotation_status ?? "-")
                                        .filter((v) => v !== "-"),
                                    ),
                                  ).join(", ")}
                                </span>
                              )}
                            </Badge>
                          )}

                          {uniqueActivityTypes.map((activity) => (
                            <HoverCard key={activity}>
                              <HoverCardTrigger asChild>
                                <Badge variant="outline" className="flex items-center justify-center w-8 h-8 p-0 cursor-default">
                                  {getActivityIcon(activity)}
                                </Badge>
                              </HoverCardTrigger>
                              <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">
                                {activity.toUpperCase()}
                              </HoverCardContent>
                            </HoverCard>
                          ))}

                          {tsmStatuses.length > 0 && (() => {
                            const isDeclined = tsmStatuses.some((s) => s === "decline");
                            return (
                              <HoverCard>
                                <HoverCardTrigger asChild>
                                  <Badge className={`cursor-default font-mono text-[10px] flex items-center gap-1 ${isDeclined ? "bg-red-600 text-white" : "bg-blue-900 text-white"}`}>
                                    {isDeclined ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}
                                  </Badge>
                                </HoverCardTrigger>
                                <HoverCardContent side="top" align="center" className="text-xs font-medium px-3 py-2 w-auto">
                                  {isDeclined ? "Declined by TSM" : "Approved by TSM"}
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })()}
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
                              <p><strong>Ticket Reference Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.ticket_reference_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.so_number && h.so_number !== "-") && (
                              <p><strong>Sales Order Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.so_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.quotation_number && h.quotation_number !== "-") && (
                              <p><strong>Quotation Number:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.quotation_number ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.call_type && h.call_type !== "-") && (
                              <p><strong>Type:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.call_type ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.source && h.source !== "-") && (
                              <p><strong>Source:</strong> <span className="uppercase">{Array.from(new Set(item.relatedHistoryItems.map((h) => h.source ?? "-").filter((v) => v !== "-"))).join(", ")}</span></p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.quotation_amount != null) && (
                              <p><strong>Total Quotation Amount:</strong> {item.relatedHistoryItems.reduce((total, h) => total + (h.quotation_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                            )}
                            {item.relatedHistoryItems.some((h) => h.so_amount != null) && (
                              <p><strong>Total SO Amount:</strong> {item.relatedHistoryItems.reduce((total, h) => total + (h.so_amount ?? 0), 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" })}</p>
                            )}
                            <Separator className="mb-2 mt-2" />
                            {item.relatedHistoryItems.some((h) => h.tsm_approved_status && h.tsm_approved_status !== "-") && (
                              <p><strong>TSM Feedback:</strong> <span className="uppercase">{item.relatedHistoryItems.map((h) => h.tsm_approved_status ?? "-").filter((v) => v !== "-").join(", ")}</span></p>
                            )}
                          </>
                        )}

                        <p><strong>Date Scheduled:</strong> {new Date(item.scheduled_date).toLocaleDateString()}</p>
                        <div className="flex items-center gap-1 text-xs font-semibold">
                          <Dot />
                          <span className="text-[10px]">{item.activity_reference_number}</span>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              {hasMore && (
                <div className="flex justify-center py-4 mt-4">
                  <Button
                    variant="outline"
                    className="rounded-none text-xs"
                    onClick={loadMoreActivities}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <LoaderPinwheel className="animate-spin h-3 w-3" /> Loading...
                      </span>
                    ) : (
                      `Load More (${50 - nextOffset} remaining of 50 max)`
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <Separator className="my-4" />

        {/* ─── TOP 50 PRIORITY LOCK BANNER ────────────────────────────────── */}
        {loadingTop50 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
            <Spinner className="w-3 h-3" /> Checking Top 50 priority status...
          </div>
        )}

        {!loadingTop50 && top50Status && !top50Status.allClearTop50 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-none">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-red-600 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-red-700">
                Top 50 Priority Lock Active
              </span>
              <Badge className="bg-red-600 text-white text-[9px]">
                {top50Status.pendingTop50.length} pending
              </Badge>
            </div>
            <p className="text-[11px] text-red-600">
              You have {top50Status.pendingTop50.length} Top 50 client{top50Status.pendingTop50.length !== 1 ? "s" : ""} with no Outbound Call this month.
              Process them first — other clusters are hidden until all Top 50 are cleared.
            </p>
          </div>
        )}

        {!loadingTop50 && top50Status?.allClearTop50 && top50Status.top50Accounts.length > 0 && (
          <div className="mb-4 p-2.5 bg-green-50 border border-green-200 rounded-none flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-xs font-semibold text-green-700">
              ✅ All Top 50 clients processed this month — all clusters available
            </span>
          </div>
        )}

        {/* ─── TOP 50 PENDING ROWS (Priority Lock — shown first) ───────────── */}
        {!loadingTop50 && top50Status && !top50Status.allClearTop50 && top50Status.pendingTop50.length > 0 && (() => {
          const pendingRefs = new Set(top50Status.pendingTop50.map((a) => a.account_reference_number));
          // Match pending Top 50 against loaded accounts for the Create button
          const pendingAccounts = accounts.filter(
            (acc) => acc.type_client?.toLowerCase() === "top 50" &&
              acc.account_reference_number && pendingRefs.has(acc.account_reference_number)
          );
          // Fall back to top50Status data if accounts hasn't loaded yet
          const pendingRows = pendingAccounts.length > 0
            ? pendingAccounts
            : top50Status.pendingTop50.map((p) => ({ ...p, id: p.account_reference_number, contact_number: "", email_address: "", contact_person: "", address: "", region: "NCR", next_available_date: null, tsm: "", manager: "" } as Account));

          return (
            <section className="mb-6">
              <h2 className="text-xs font-black mb-3 text-red-700 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Top 50 — Pending Outbound Call ({pendingRows.length})
              </h2>

              <Accordion type="single" collapsible className="w-full space-y-1">
                {pendingRows.map((account) => {
                  const forecast = top50Status.forecastMap[account.account_reference_number];
                  const forecastPct = forecast && forecast.forecastAmount > 0
                    ? Math.min(Math.round((forecast.currentMonthSales / forecast.forecastAmount) * 100), 100)
                    : 0;

                  return (
                    <AccordionItem
                      key={account.account_reference_number}
                      value={account.account_reference_number}
                      className="border-2 border-red-400 rounded-none bg-red-50"
                    >
                      <div className="flex justify-between items-start p-2 select-none gap-2">
                        <AccordionTrigger className="flex-1 text-xs font-bold font-mono text-red-800 text-left">
                          <div className="flex flex-col gap-1 text-left">
                            <span>{account.company_name}</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              <Badge className="bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5">
                                TOP 50
                              </Badge>
                              <Badge className="bg-red-100 text-red-700 border border-red-300 text-[8px] px-1.5 py-0.5">
                                ⚠️ NO OUTBOUND CALL THIS MONTH — TOP 50 PRIORITY
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="shrink-0 mt-1">
                          {"contact_number" in account && (account as Account).id ? (
                            <CreateActivityDialog
                              firstname={firstname}
                              lastname={lastname}
                              target_quota={target_quota}
                              email={email}
                              contact={contact}
                              tsmname={tsmname}
                              managername={managername}
                              referenceid={referenceid}
                              tsm={(account as Account).tsm ?? ""}
                              manager={(account as Account).manager ?? ""}
                              type_client="top 50"
                              contact_number={(account as Account).contact_number}
                              email_address={(account as Account).email_address}
                              activityReferenceNumber={generateActivityRef(account.company_name, (account as Account).region || "NCR")}
                              ticket_reference_number="-"
                              agent={`${firstname} ${lastname}`}
                              company_name={account.company_name}
                              contact_person={(account as Account).contact_person}
                              address={(account as Account).address}
                              accountReferenceNumber={account.account_reference_number}
                              onCreated={createActivityHandler(account as Account)}
                              managerDetails={managerDetails ?? null}
                              tsmDetails={tsmDetails ?? null}
                              signature={signature}
                            />
                          ) : (
                            <span className="text-[10px] text-red-400 italic">Load account to create</span>
                          )}
                        </div>
                      </div>

                      <AccordionContent className="px-3 pb-3 text-xs space-y-2">
                        {/* Forecast section */}
                        {forecast ? (
                          <div className="bg-white border border-red-200 rounded-none p-2.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-600">
                              <TrendingUp className="w-3 h-3" /> Sales Forecast
                            </div>
                            {forecast.latestSale > 0 ? (
                              <>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-gray-500">Latest Sale:</span>
                                  <span className="font-semibold text-gray-800">{fmtPeso(forecast.latestSale)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-gray-500">Forecast (this month):</span>
                                  <span className="font-bold text-blue-700">{fmtPeso(forecast.forecastAmount)}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-gray-500">Achieved so far:</span>
                                  <span className="font-semibold text-green-700">{fmtPeso(forecast.currentMonthSales)}</span>
                                </div>
                                <div className="mt-1">
                                  <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                    <span>Progress to forecast</span>
                                    <span>{forecastPct}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 h-1.5 rounded-full">
                                    <div
                                      className="h-1.5 rounded-full transition-all"
                                      style={{
                                        width: `${forecastPct}%`,
                                        backgroundColor: forecastPct >= 100 ? "#16a34a" : forecastPct >= 50 ? "#3b82f6" : "#f59e0b",
                                      }}
                                    />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="text-[10px] text-gray-400 italic">No prior sales — forecast = ₱0</p>
                            )}
                          </div>
                        ) : null}

                        {"contact_number" in account && (
                          <>
                            <p><strong>Contact:</strong> {(account as Account).contact_number || "—"}</p>
                            <p><strong>Email:</strong> {(account as Account).email_address || "—"}</p>
                            <p><strong>Address:</strong> {(account as Account).address || "—"}</p>
                          </>
                        )}
                        <p className="text-[9px] font-mono text-gray-400">{account.account_reference_number}</p>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </section>
          );
        })()}

        {/* ─── OB Calls Account for Today ─────────────────────────────────── */}
        {/* HIDDEN when Top 50 lock is active */}
        {(!top50Status || top50Status.allClearTop50) && totalTodayCount > 0 && firstTodayCluster && (() => {
          const todayAccounts = groupedToday[firstTodayCluster];
          const displayed = todayAccounts.slice(0, displayedTodayCount);
          return (
            <section>
              <h2 className="text-xs font-bold mb-4">OB Calls Account for Today ({todayAccounts.length})</h2>
              <Alert className="font-mono rounded-xl shadow-lg mb-2">
                <CheckCircle2 />
                <AlertTitle className="text-xs font-bold">CLUSTER SERIES: {firstTodayCluster.toUpperCase()}</AlertTitle>
                <AlertDescription className="text-xs italic">
                  {todayAccounts.length} account{todayAccounts.length !== 1 ? "s" : ""} scheduled for today
                </AlertDescription>
              </Alert>

              <Accordion type="single" collapsible className="w-full">
                {displayed.map((account) => (
                  <AccordionItem key={account.id} value={account.id} className="border border-green-300 rounded-sm mb-2 uppercase">
                    <div className="flex justify-between items-center p-2 select-none">
                      <AccordionTrigger className="flex-1 text-xs font-semibold font-mono">
                        {account.company_name}
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
                          referenceid={referenceid}
                          tsm={account.tsm}
                          manager={account.manager}
                          type_client={account.type_client}
                          contact_number={account.contact_number}
                          email_address={account.email_address}
                          activityReferenceNumber={generateActivityRef(account.company_name, account.region || "NCR")}
                          ticket_reference_number="-"
                          agent={`${firstname} ${lastname}`}
                          company_name={account.company_name}
                          contact_person={account.contact_person}
                          address={account.address}
                          accountReferenceNumber={account.account_reference_number}
                          onCreated={createActivityHandler(account)}
                          managerDetails={managerDetails ?? null}
                          tsmDetails={tsmDetails ?? null}
                          signature={signature}
                        />
                      </div>
                    </div>
                    <AccordionContent className="flex flex-col gap-2 p-3 text-xs">
                      <p><strong>Contact:</strong> {account.contact_number}</p>
                      <p><strong>Email:</strong> {account.email_address}</p>
                      <p><strong>Client Type:</strong> {account.type_client}</p>
                      <p><strong>Address:</strong> {account.address}</p>
                      <p className="text-[8px]">{account.account_reference_number}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {todayAccounts.length > displayedTodayCount && (
                <div className="flex justify-center py-3 mt-2">
                  <Button
                    variant="outline"
                    className="rounded-none text-xs"
                    onClick={() => setDisplayedTodayCount((p) => p + CLUSTER_BATCH_SIZE)}
                  >
                    Load More ({todayAccounts.length - displayedTodayCount} remaining)
                  </Button>
                </div>
              )}
            </section>
          );
        })()}

        {/* ─── Available OB Calls ──────────────────────────────────────────── */}
        {/* HIDDEN when Top 50 lock is active — show lock message instead */}
        {top50Status && !top50Status.allClearTop50 && totalAvailableCount > 0 && (
          <section>
            <h2 className="text-xs font-bold mb-3 text-gray-600">Available OB Calls</h2>
            <div className="flex items-center gap-2 p-3 bg-gray-100 border border-gray-300 rounded-none text-xs text-gray-600">
              <Lock className="w-3.5 h-3.5 shrink-0 text-gray-500" />
              🔒 Clusters hidden — finish all pending Top 50 in the list above first
            </div>
          </section>
        )}

        {(!top50Status || top50Status.allClearTop50) && totalAvailableCount > 0 && firstAvailableCluster && (() => {
          const availableAccounts = groupedNull[firstAvailableCluster];
          const displayed = availableAccounts.slice(0, displayedAvailableCount);
          return (
            <section>
              <h2 className="text-xs font-bold mb-4">Available OB Calls ({availableAccounts.length})</h2>
              <Alert className="font-mono rounded-xl shadow-lg mb-2">
                <CheckCircle2 />
                <AlertTitle className="text-xs font-bold">CLUSTER SERIES: {firstAvailableCluster.toUpperCase()}</AlertTitle>
                <AlertDescription className="text-xs italic">Available accounts ready for scheduling</AlertDescription>
              </Alert>

              <Accordion type="single" collapsible className="w-full border rounded-none shadow-sm border-blue-200 uppercase">
                {displayed.map((account) => (
                  <AccordionItem key={account.id} value={account.id}>
                    <div className="flex justify-between items-center p-2 select-none">
                      <AccordionTrigger className="flex-1 text-xs font-semibold font-mono">
                        {account.company_name}
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
                          referenceid={referenceid}
                          tsm={account.tsm}
                          manager={account.manager}
                          type_client={account.type_client}
                          contact_number={account.contact_number}
                          email_address={account.email_address}
                          activityReferenceNumber={generateActivityRef(account.company_name, account.region || "NCR")}
                          ticket_reference_number="-"
                          agent={`${firstname} ${lastname}`}
                          company_name={account.company_name}
                          contact_person={account.contact_person}
                          address={account.address}
                          accountReferenceNumber={account.account_reference_number}
                          onCreated={createActivityHandler(account)}
                          managerDetails={managerDetails ?? null}
                          tsmDetails={tsmDetails ?? null}
                          signature={signature}
                        />
                      </div>
                    </div>
                    <AccordionContent className="flex flex-col gap-2 p-3 text-xs">
                      <p><strong>Contact:</strong> {account.contact_number}</p>
                      <p><strong>Email:</strong> {account.email_address}</p>
                      <p><strong>Client Type:</strong> {account.type_client}</p>
                      <p><strong>Address:</strong> {account.address}</p>
                      <p className="text-[8px]">{account.account_reference_number}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {availableAccounts.length > displayedAvailableCount && (
                <div className="flex justify-center py-3 mt-2">
                  <Button
                    variant="outline"
                    className="rounded-none text-xs"
                    onClick={() => setDisplayedAvailableCount((p) => p + CLUSTER_BATCH_SIZE)}
                  >
                    Load More ({availableAccounts.length - displayedAvailableCount} remaining)
                  </Button>
                </div>
              )}
            </section>
          );
        })()}
      </div>

      <DeliveredDialog
        open={dialogDeliveredOpen}
        onOpenChange={setDialogDeliveredOpen}
        onConfirm={handleConfirmDelivered}
        loading={updatingId !== null}
      />
      <TransferDialog
        open={dialogTransferOpen}
        onOpenChange={setDialogTransferOpen}
        onConfirm={(selectedUser) => handleConfirmTransfer(selectedUser?.ReferenceID)}
        loading={updatingId === selectedActivityId}
        ticketReferenceNumber={selectedTicketReferenceNumber}
        tsm={selectedActivity?.tsm}
        account_reference_number={selectedActivity?.account_reference_number}
      />
      <CancelledDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmCancelled}
        loading={updatingId !== null}
      />
    </>
  );
};