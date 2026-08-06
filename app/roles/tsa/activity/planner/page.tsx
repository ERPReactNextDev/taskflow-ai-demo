"use client";

import React, { useEffect, useState, Suspense, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { type DateRange } from "react-day-picker";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { supabase } from "@/utils/supabase";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { NewTask } from "@/components/roles/tsa/activity/planner/new-task/new";
import { Progress } from "@/components/roles/tsa/activity/planner/progress/progress";
import { Scheduled } from "@/components/roles/tsa/activity/planner/scheduled/scheduled";
import { Completed } from "@/components/roles/tsa/activity/planner/completed/completed";
import { Delivered } from "@/components/roles/tsa/activity/planner/delivered/delivered";
import { Done } from "@/components/roles/tsa/activity/planner/done/done";
import { Overdue } from "@/components/roles/tsa/activity/planner/overdue/overdue";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { GlobalTopBar } from "@/components/global-top-bar";

import {
  PlusCircle, Loader2, Calendar, CheckCircle,
  AlertCircle, ChevronDown, ChevronRight, Bell, CheckCircle2,
  XCircle, Trash2, AlertTriangle, Search, Clock, MessageSquare,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Account {
  id: string; referenceid: string; company_name: string; type_client: string;
  date_created: string; date_updated: string; contact_person: string;
  contact_number: string; email_address: string; address: string;
  delivery_address: string; region: string; industry: string;
  status: string; company_group?: string;
  account_reference_number: string;
  tsm: string;
  manager: string;
  next_available_date?: string | null;
}

interface SupervisorDetails {
  firstname: string; lastname: string; email: string;
  profilePicture: string; signatureImage: string; contact: string;
}

interface UserDetails {
  referenceid: string; tsm: string; manager: string; target_quota: string;
  firstname: string; lastname: string; email: string; contact: string;
  tsmname: string; managername: string; signature: string;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
}

interface QuotationNotification {
  id: number;
  activity_reference_number: string;
  company_name: string;
  quotation_number?: string;
  quotation_amount?: number;
  tsm_approved_status: string;
  tsm_approval_date?: string;
  manager_approval_date?: string;
  tsm_remarks?: string;
  manager_remarks?: string;
  date_updated?: string;
  date_created: string;
}

interface SPFNotification {
  id: number;
  spf_number: string;
  company_name: string;
  activity_reference_number: string;
  date_created: string;
  date_updated?: string;
  status: string;
  referenceid: string;
}

// ── Quotation Aging Reminder (agent view) ─────────────────────────────────────
interface AgingReminder {
  id: number;
  quotation_number: string;
  company_name: string;
  quotation_amount: number;
  tsm_approval_date: string;
  aging_days: number;
  daysAging: number;
  daysRemaining: number;
  agingStatus: "ON_TRACK" | "DUE_SOON" | "OVERDUE" | "FOLLOWED_UP" | "CONVERTED" | "DISMISSED";
  reminder_note?: string;
  follow_up_date?: string;
  last_follow_up_note?: string;
  tsm_name: string;
}

const REVISED_QUOTATION_ROUTE = "/roles/tsa/activity/revised-quotation";
const COLLAPSE_KEY = "activity_planner_collapsible_state";

// ─── Clear Cache Dialog ───────────────────────────────────────────────────────

function ClearCacheDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white border border-gray-200 shadow-xl rounded-none p-6 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-800">Clear Cache</h2>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          This will clear all browser cache, local storage, and service workers. The page will reload automatically.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 h-8 rounded-none text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="flex-1 h-8 rounded-none text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => { onClose(); onConfirm(); }}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear Now
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 text-center">
          Press <kbd className="px-1 py-0.5 border border-gray-300 rounded text-[9px] font-mono">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}

// ─── Notification Dropdown ────────────────────────────────────────────────────

function NotificationDropdown({ referenceid, userId }: { referenceid: string; userId: string }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<(QuotationNotification | SPFNotification)[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoad = useRef(true);
  const hasUserInteracted = useRef(false);
  const READ_KEY = `notif_read_${referenceid}`;

  useEffect(() => {
    if (!referenceid) return;
    try {
      const saved = localStorage.getItem(READ_KEY);
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch { localStorage.removeItem(READ_KEY); }
  }, [referenceid]);

  useEffect(() => {
    const markInteracted = () => { hasUserInteracted.current = true; };
    window.addEventListener("click", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });
    window.addEventListener("touchstart", markInteracted, { once: true });
    return () => {
      window.removeEventListener("click", markInteracted);
      window.removeEventListener("keydown", markInteracted);
      window.removeEventListener("touchstart", markInteracted);
    };
  }, []);

  useEffect(() => {
    audioRef.current = new Audio("/alert-notification.mp3");
    audioRef.current.volume = 0.6;
    audioRef.current.load();
  }, []);

  const playSound = useCallback(() => {
    if (!hasUserInteracted.current) return;
    try {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch((err) => {
          if (err.name !== "NotAllowedError") {
            console.error("Failed to play notification sound:", err);
          }
        });
      }
    } catch (err) {
      console.error("Error in playSound:", err);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!referenceid) return;
    setLoading(true);
    try {
      const [quotationRes, spfRes] = await Promise.all([
        fetch(`/api/activity/tsa/quotation/fetch?referenceid=${referenceid}`),
        fetch(`/api/activity/tsa/spf/notifications?referenceid=${referenceid}`)
      ]);

      let filteredQuotations: QuotationNotification[] = [];
      if (quotationRes.ok) {
        const d = await quotationRes.json();
        filteredQuotations = (d.activities || []).filter(
          (a: QuotationNotification) => a.tsm_approved_status === "Approved" || a.tsm_approved_status === "Decline"
        );
      }

      let spfNotifications: SPFNotification[] = [];
      if (spfRes.ok) {
        const d = await spfRes.json();
        spfNotifications = d.notifications || [];
      }

      const all = [...filteredQuotations, ...spfNotifications].sort((a, b) => {
        const dateA = new Date((a as any).manager_approval_date ?? (a as any).tsm_approval_date ?? (a as any).date_updated ?? (a as any).date_created).getTime();
        const dateB = new Date((b as any).manager_approval_date ?? (b as any).tsm_approval_date ?? (b as any).date_updated ?? (b as any).date_created).getTime();
        return dateB - dateA;
      });

      const newIds = new Set<number>(all.map((n) => n.id));
      if (!isFirstLoad.current) {
        if ([...newIds].some((id) => !prevIdsRef.current.has(id))) playSound();
      }
      prevIdsRef.current = newIds;
      isFirstLoad.current = false;
      setNotifications(all);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [referenceid]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && notifications.length > 0) {
      const allIds = new Set(notifications.map((n) => n.id));
      setReadIds(allIds);
      try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(allIds))); } catch { }
    }
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined || amount === null) return null;
    return `₱${parseFloat(String(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const buildUrl = (notif: QuotationNotification, action?: "preview" | "download") => {
    const params: Record<string, string> = { id: userId, highlight: notif.quotation_number || notif.activity_reference_number, openEdit: notif.activity_reference_number };
    if (action) params.action = action;
    return `${REVISED_QUOTATION_ROUTE}?${new URLSearchParams(params).toString()}`;
  };

  const handleNotifClick = (notif: QuotationNotification) => {
    setOpen(false);
    router.push(`${REVISED_QUOTATION_ROUTE}?${new URLSearchParams({ id: userId, highlight: notif.quotation_number || notif.activity_reference_number }).toString()}`);
  };

  const handleSPFNotifClick = (notif: SPFNotification) => {
    setOpen(false);
    router.push(`/roles/tsa/activity/spf?${new URLSearchParams({ id: userId, highlight: notif.spf_number }).toString()}`);
  };

  const handleViewPdf = (e: React.MouseEvent, notif: QuotationNotification) => { e.stopPropagation(); setOpen(false); router.push(buildUrl(notif, "preview")); };
  const handleDownloadPdf = (e: React.MouseEvent, notif: QuotationNotification) => { e.stopPropagation(); setOpen(false); router.push(buildUrl(notif, "download")); };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors focus:outline-none">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] max-h-[520px] overflow-y-auto rounded-none p-0">
        <div className="sticky top-0 bg-background z-10 px-4 py-3 border-b flex items-center justify-between">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {notifications.length > 0 && <Badge variant="secondary" className="text-xs rounded-sm">{notifications.length} total</Badge>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-6 text-muted-foreground text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground text-xs gap-1">
            <Bell className="w-6 h-6 opacity-30" /><span>No notifications</span>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notif) => {
              const isQuotation = "quotation_number" in notif;
              const isSPF = "spf_number" in notif;
              const isUnread = !readIds.has(notif.id);

              if (isQuotation) {
                const q = notif as QuotationNotification;
                const isApproved = q.tsm_approved_status === "Approved";
                const approvedByManager = !!q.manager_approval_date;
                return (
                  <div key={q.id} className={`px-4 py-3 text-xs flex flex-col gap-1.5 cursor-pointer transition-colors hover:bg-accent/60 active:bg-accent ${isUnread ? "bg-muted/40" : "bg-background"}`} onClick={() => handleNotifClick(q)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm leading-tight flex-1">{q.company_name}</span>
                      <span className={`inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-xs text-[11px] font-semibold ${isApproved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {isApproved ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {q.tsm_approved_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
                      {q.quotation_number && <span className="uppercase font-mono">{q.quotation_number}</span>}
                      {formatAmount(q.quotation_amount) && <span className="font-semibold text-foreground">{formatAmount(q.quotation_amount)}</span>}
                    </div>
                    {q.tsm_approval_date && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="w-3 h-3 shrink-0 text-green-600" />
                        <span><span className="font-medium text-foreground">TSM {isApproved ? "Approved" : "Declined"}:</span> {formatDate(q.tsm_approval_date)}</span>
                      </div>
                    )}
                    {approvedByManager && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="w-3 h-3 shrink-0 text-blue-600" />
                        <span><span className="font-medium text-foreground">{isApproved ? "Approved" : "Declined"} by Manager:</span> {formatDate(q.manager_approval_date)}</span>
                      </div>
                    )}
                    {q.tsm_remarks && <p className="text-muted-foreground italic">TSM: &ldquo;{q.tsm_remarks}&rdquo;</p>}
                    {q.manager_remarks && <p className="text-muted-foreground italic">Manager: &ldquo;{q.manager_remarks}&rdquo;</p>}
                    {isUnread && <div className="flex justify-end mt-0.5"><span className="w-2 h-2 rounded-full bg-blue-500" /></div>}
                  </div>
                );
              } else if (isSPF) {
                const s = notif as SPFNotification;
                return (
                  <div key={s.id} className={`px-4 py-3 text-xs flex flex-col gap-1.5 cursor-pointer transition-colors hover:bg-accent/60 active:bg-accent ${isUnread ? "bg-muted/40" : "bg-background"}`} onClick={() => handleSPFNotifClick(s)}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm leading-tight flex-1">{s.company_name}</span>
                      <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-blue-100 text-blue-700">
                        <CheckCircle2 className="w-3 h-3" /> SPF Approved
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-muted-foreground">
                      {s.spf_number && <span className="uppercase font-mono">{s.spf_number}</span>}
                      <span className="font-medium text-foreground">Ready For Quotation</span>
                    </div>
                    {s.date_updated && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle className="w-3 h-3 shrink-0 text-blue-600" />
                        <span><span className="font-medium text-foreground">Approved By Procurement:</span> {formatDate(s.date_updated)}</span>
                      </div>
                    )}
                    {isUnread && <div className="flex justify-end mt-0.5"><span className="w-2 h-2 rounded-full bg-blue-500" /></div>}
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Collapsible Card ─────────────────────────────────────────────────────────

function PlannerCard({
  title,
  icon,
  count,
  isOpen,
  onToggle,
  countColor = "text-red-600",
  className = "",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  countColor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`rounded-none transition-all duration-300 ${className}`}>
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <span>{title}</span>
            <span className={`text-xs font-bold ${countColor}`}>({count})</span>
          </div>
          <span className="text-xs rounded-sm border p-1">
            {isOpen ? <ChevronDown /> : <ChevronRight />}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 p-0"}`}
      >
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", tsm: "", manager: "", target_quota: "",
    firstname: "", lastname: "", email: "", contact: "",
    tsmname: "", managername: "", signature: "",
    managerDetails: null, tsmDetails: null,
  });

  const [posts, setPosts] = useState<Account[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  const [collapseState, setCollapseState] = useState({
    inProgress: true, scheduled: true, delivered: true,
    completed: true, done: true, overdue: true,
  });

  const [progressCount, setProgressCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  const [clearCacheOpen, setClearCacheOpen] = useState(false);

  // ── Quotation Aging Reminders ─────────────────────────────────────────────
  const [agingReminders,  setAgingReminders]  = useState<AgingReminder[]>([]);
  const [loadingAging,    setLoadingAging]    = useState(false);
  const [fuDialogOpen,    setFuDialogOpen]    = useState(false);
  const [selectedAging,   setSelectedAging]   = useState<AgingReminder | null>(null);
  const [fuNote,          setFuNote]          = useState("");
  const [savingFu,        setSavingFu]        = useState(false);

  // ─── No Activity Accounts State ────────────────────────────────────────────
  const [lastTouchMap, setLastTouchMap] = useState<Record<string, string>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingNoActivity, setLoadingNoActivity] = useState(false);
  const [noActivitySearch, setNoActivitySearch] = useState("");
  const NO_ACTIVITY_BATCH_SIZE = 5;
  const LAST_TOUCH_BATCH_SIZE = 5;
  const [displayedNoActivityCount, setDisplayedNoActivityCount] = useState(NO_ACTIVITY_BATCH_SIZE);
  const [displayedLastTouchCount, setDisplayedLastTouchCount] = useState(LAST_TOUCH_BATCH_SIZE);

  const queryUserId = searchParams?.get("id") ?? "";

  // ── Alt + Ctrl + C shortcut ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); setClearCacheOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClearCache = useCallback(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      const idbWithList = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
      if (typeof idbWithList.databases === "function") {
        const dbs = await idbWithList.databases();
        await Promise.all(
          dbs.map((db) => db.name).filter((n): n is string => Boolean(n)).map(
            (name) => new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
          )
        );
      }
      sileo.success({ title: "Cache Cleared", description: "Browser cache and local app storage were cleared. Reloading...", duration: 2000, position: "top-right" });
      setTimeout(() => window.location.reload(), 300);
    } catch {
      sileo.error({ title: "Failed", description: "Unable to fully clear browser cache.", duration: 3000, position: "top-right" });
    }
  }, []);

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  const fetchUserData = useCallback(async () => {
    if (!userId) { setLoadingUser(false); return; }
    setError(null); setLoadingUser(true);
    try {
      const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error("Failed to fetch user data");
      const data = await response.json();
      setUserDetails({
        referenceid: data.ReferenceID || "",
        tsm: data.TSM || "",
        manager: data.Manager || "",
        target_quota: data.TargetQuota || "",
        firstname: data.Firstname || "",
        lastname: data.Lastname || "",
        email: data.Email || "",
        contact: data.ContactNumber || "",
        tsmname: data.TSMName || "",
        managername: data.ManagerName || "",
        signature: data.signatureImage || "",
        managerDetails: data.managerDetails || null,
        tsmDetails: data.tsmDetails || null,
      });
    } catch (err) {
      console.error("User fetch error:", err);
      sileo.error({ title: "Connection Error", description: "Unable to retrieve user details. Please check your connection.", duration: 4000, position: "top-center", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setLoadingUser(false);
    }
  }, [userId]);

  useEffect(() => { fetchUserData(); }, [fetchUserData]);

  const refreshAccounts = useCallback(async () => {
    if (!userDetails.referenceid) return;
    try {
      const response = await fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`);
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setPosts(data.data || []);
    } catch (err) {
      console.error("Refresh accounts error:", err);
      sileo.error({ title: "Sync Error", description: "Failed to refresh account data.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  }, [userDetails.referenceid]);

  const handleSaveAccount = useCallback(async (data: Account & UserDetails) => {
    const payload = {
      ...data,
      contactperson: Array.isArray(data.contact_person) ? data.contact_person : typeof data.contact_person === "string" ? data.contact_person.split(",").map((v) => v.trim()) : [],
      contactnumber: Array.isArray(data.contact_number) ? data.contact_number : typeof data.contact_number === "string" ? data.contact_number.split(",").map((v) => v.trim()) : [],
      emailaddress: Array.isArray(data.email_address) ? data.email_address : typeof data.email_address === "string" ? data.email_address.split(",").map((v) => v.trim()) : [],
    };
    try {
      const isEdit = Boolean(payload.id);
      const response = await fetch(isEdit ? "/api/com-edit-account" : "/api/com-save-account", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to save account");
      sileo.success({ title: "Success", description: `Account ${isEdit ? "updated" : "created"} successfully!`, duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      await refreshAccounts();
    } catch (err) {
      console.error("Save account error:", err);
      sileo.error({ title: "Failed", description: "Failed to save account.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    }
  }, [refreshAccounts]);

  const toggleCollapse = useCallback((key: keyof typeof collapseState) => {
    setCollapseState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved) {
      try { setCollapseState((prev) => ({ ...prev, ...JSON.parse(saved) })); }
      catch { localStorage.removeItem(COLLAPSE_KEY); }
    }
  }, []);

  // ─── Fetch last touch summary (optimized) ────────────────────────────────
  const fetchLastTouchSummary = useCallback(async () => {
    if (!userDetails.referenceid) return;
    try {
      const url = `/api/activity/tsa/planner/last-touch-summary?referenceid=${encodeURIComponent(userDetails.referenceid)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLastTouchMap(data.lastTouchMap || {});
        }
      }
    } catch (err) {
      console.error("Error fetching last touch summary:", err);
    }
  }, [userDetails.referenceid]);

  // ─── Real-time subscription for automatic updates ────────────────────────
  useEffect(() => {
    if (!userDetails.referenceid) return;

    const channel = supabase
      .channel("history_changes_planner")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "history",
          filter: `referenceid=eq.${userDetails.referenceid}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (newRecord && newRecord.account_reference_number && newRecord.date_created) {
            const ref = newRecord.account_reference_number.toLowerCase().trim();
            setLastTouchMap((prev) => ({
              ...prev,
              [ref]: newRecord.date_created,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userDetails.referenceid]);

  // ─── Fetch accounts for no-activity calculation ──────────────────────────
  const fetchAccountsForNoActivity = useCallback(async () => {
    if (!userDetails.referenceid) return;
    setLoadingNoActivity(true);
    try {
      const response = await fetch(
        `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`
      );
      if (response.ok) {
        const data = await response.json();
        const excludedStatuses = ["removed", "approved for deletion", "subject for transfer"];
        const allowedTypes = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];
        const filtered = (data.data || []).filter((acc: Account) => {
          const status = acc.status?.toLowerCase() || "";
          const typeClient = acc.type_client?.toLowerCase() || "";
          if (!acc.status || !acc.type_client) return false;
          if (excludedStatuses.includes(status)) return false;
          if (!allowedTypes.includes(typeClient)) return false;
          return true;
        });
        setAccounts(filtered);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    } finally {
      setLoadingNoActivity(false);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    if (userDetails.referenceid) {
      fetchLastTouchSummary();
      fetchAccountsForNoActivity();
    }
  }, [userDetails.referenceid, fetchLastTouchSummary, fetchAccountsForNoActivity]);

  // ─── Last activity date per account (last touch) ─────────────────────────
  // Keyed by account_reference_number for accurate matching
  const lastActivityDateMapMemo = React.useMemo(() => {
    const m: Record<string, string> = {};
    Object.entries(lastTouchMap).forEach(([ref, date]) => {
      m[`ref:${ref}`] = date;
    });
    return m;
  }, [lastTouchMap]);

  // ─── Calculate aging from any date string ────────────────────────────────
  const calculateAging = (dateStr: string): number => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  // ─── All accounts with last touch info, sorted by most neglected ─────────
  // Lookup tries account_reference_number first (unique), then falls back to company_name
  const filteredNoActivityAccounts = React.useMemo(() => {
    const enriched = accounts.map((account) => {
      const lastTouch = account.account_reference_number
        ? lastActivityDateMapMemo[`ref:${account.account_reference_number.toLowerCase().trim()}`] ?? null
        : null;

      const referenceDate = lastTouch || account.date_created;
      const agingDays = calculateAging(referenceDate);
      return {
        ...account,
        lastTouch,
        hasActivity: !!lastTouch,
        agingDays,
      };
    });

    // Sort: no-activity accounts first (by aging desc), then has-activity (by aging desc)
    let sorted = enriched.sort((a, b) => {
      if (!a.hasActivity && b.hasActivity) return -1;
      if (a.hasActivity && !b.hasActivity) return 1;
      return b.agingDays - a.agingDays;
    });

    if (noActivitySearch.trim()) {
      const searchLower = noActivitySearch.toLowerCase();
      sorted = sorted.filter((acc) =>
        acc.company_name.toLowerCase().includes(searchLower) ||
        acc.type_client.toLowerCase().includes(searchLower) ||
        (acc.account_reference_number ?? "").toLowerCase().includes(searchLower)
      );
    }

    return sorted;
  }, [accounts, lastActivityDateMapMemo, noActivitySearch]);

  const displayedNoActivityAccounts = React.useMemo(() => {
    const noTouch = filteredNoActivityAccounts.filter((a) => !a.hasActivity);
    const lastTouch = filteredNoActivityAccounts.filter((a) => a.hasActivity);
    const displayedNoTouch = noTouch.slice(0, displayedNoActivityCount);
    const displayedLastTouch = lastTouch.slice(0, displayedLastTouchCount);
    return [...displayedNoTouch, ...displayedLastTouch];
  }, [filteredNoActivityAccounts, displayedNoActivityCount, displayedLastTouchCount]);

  const allNoTouchForCount = filteredNoActivityAccounts.filter((a) => !a.hasActivity);
  const allLastTouchForCount = filteredNoActivityAccounts.filter((a) => a.hasActivity);
  const remainingItemsCount = (allNoTouchForCount.length - displayedNoActivityCount) + (allLastTouchForCount.length - displayedLastTouchCount);
  const hasMoreNoActivity = remainingItemsCount > 0;

  // ── Fetch Aging Reminders for current agent ──────────────────────────────
  const fetchAgingReminders = useCallback(async () => {
    if (!userDetails.referenceid) return;
    setLoadingAging(true);
    try {
      const res  = await fetch(`/api/quotation-aging/agent?referenceid=${encodeURIComponent(userDetails.referenceid)}`);
      if (!res.ok) throw new Error("Failed to load reminders");
      const json = await res.json();
      setAgingReminders(json.data || []);
    } catch (err) {
      console.error("fetchAgingReminders error:", err);
    } finally {
      setLoadingAging(false);
    }
  }, [userDetails.referenceid]);

  const submitFollowUp = async () => {
    if (!selectedAging || !fuNote.trim()) return;
    setSavingFu(true);
    try {
      await fetch("/api/quotation-aging", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedAging.id,
          status: "FOLLOWED_UP",
          last_follow_up_date: new Date().toISOString(),
          last_follow_up_note: fuNote.trim(),
        }),
      });
      setFuDialogOpen(false);
      setFuNote("");
      fetchAgingReminders();
    } catch (err) {
      console.error("submitFollowUp error:", err);
    } finally {
      setSavingFu(false);
    }
  };

  useEffect(() => { fetchAgingReminders(); }, [fetchAgingReminders]);

  useEffect(() => {
    if (!userDetails.referenceid) return;
    const ch = supabase
      .channel(`aging-agent-${userDetails.referenceid}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "quotation_aging", filter: `referenceid=eq.${userDetails.referenceid}` },
        () => fetchAgingReminders()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userDetails.referenceid, fetchAgingReminders]);

  // ── Shared props builder ──────────────────────────────────────────────────
  const sharedProps = {
    referenceid: userDetails.referenceid,
    firstname: userDetails.firstname,
    lastname: userDetails.lastname,
    email: userDetails.email,
    contact: userDetails.contact,
    tsmname: userDetails.tsmname,
    managername: userDetails.managername,
    target_quota: userDetails.target_quota,
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
    managerDetails: userDetails.managerDetails ?? null,
    tsmDetails: userDetails.tsmDetails ?? null,
    signature: userDetails.signature,
    accounts: posts,
  };

  return (
    <>
      <ClearCacheDialog open={clearCacheOpen} onClose={() => setClearCacheOpen(false)} onConfirm={handleClearCache} />

      {/* ── Quotation Aging Follow-Up Dialog ────────────────────────────── */}
      <Dialog open={fuDialogOpen} onOpenChange={setFuDialogOpen}>
        <DialogContent className="rounded-none text-xs max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">Send Update to TSM</DialogTitle>
            <DialogDescription>
              {selectedAging?.quotation_number} · {selectedAging?.company_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-[10px] font-bold uppercase">
              Status / Follow-up Details <span className="text-red-500">*</span>
            </Label>
            <Textarea
              rows={4}
              placeholder="e.g. Client requested revised quote / waiting for procurement approval / will follow up again on Monday..."
              value={fuNote}
              onChange={(e) => setFuNote(e.target.value)}
              className="rounded-none text-xs resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setFuDialogOpen(false)} className="rounded-none text-xs h-8">
              Cancel
            </Button>
            <Button
              disabled={savingFu || !fuNote.trim()}
              onClick={submitFollowUp}
              className="rounded-none h-8 text-xs bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              {savingFu
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              }
              Submit Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">
          <GlobalTopBar title="Activity Planners" />

          <main className="flex flex-1 gap-4 p-4 overflow-hidden">
            {loadingUser ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                  <p className="text-xs text-zinc-500 animate-pulse font-mono uppercase tracking-widest">
                    Synchronizing Data...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* ─── No Activity + Aging Sidebar ──────────────────────── */}
                {(filteredNoActivityAccounts.length > 0 || agingReminders.length > 0 || loadingAging) && (
                  <div className="w-[280px] shrink-0 flex flex-col border-r pr-4 overflow-hidden">

                    {/* ⏳ Quotation Aging Reminders */}
                    {(agingReminders.length > 0 || loadingAging) && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wide">Quotation Aging</h3>
                          <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">{agingReminders.length}</Badge>
                        </div>

                        {loadingAging ? (
                          <div className="flex items-center gap-1.5 py-2 text-[11px] text-gray-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {[...agingReminders]
                              .sort((a, b) => {
                                const order: Record<string, number> = { OVERDUE: 1, DUE_SOON: 2, ON_TRACK: 3, FOLLOWED_UP: 4, CONVERTED: 5, DISMISSED: 6 };
                                return (order[a.agingStatus] ?? 99) - (order[b.agingStatus] ?? 99);
                              })
                              .map((item) => {
                                const dimmed = item.agingStatus === "CONVERTED" || item.agingStatus === "DISMISSED";
                                const cardBg: Record<string, string> = {
                                  OVERDUE:    "bg-red-50 border-red-200",
                                  DUE_SOON:   "bg-amber-50 border-amber-200",
                                  ON_TRACK:   "bg-green-50 border-green-200",
                                  FOLLOWED_UP:"bg-blue-50 border-blue-200",
                                  CONVERTED:  "bg-emerald-50 border-emerald-200",
                                  DISMISSED:  "bg-gray-50 border-gray-200",
                                };
                                const badgeCls: Record<string, string> = {
                                  OVERDUE:    "bg-red-100 text-red-700",
                                  DUE_SOON:   "bg-amber-100 text-amber-700",
                                  ON_TRACK:   "bg-green-100 text-green-700",
                                  FOLLOWED_UP:"bg-blue-100 text-blue-700",
                                  CONVERTED:  "bg-emerald-100 text-emerald-700",
                                  DISMISSED:  "bg-gray-100 text-gray-500",
                                };
                                const statusLabel: Record<string, string> = {
                                  OVERDUE: "OVERDUE", DUE_SOON: "DUE SOON", ON_TRACK: "ON TRACK",
                                  FOLLOWED_UP: "FOLLOWED UP", CONVERTED: "CONVERTED", DISMISSED: "DISMISSED",
                                };
                                return (
                                  <div
                                    key={item.id}
                                    className={`p-2 border rounded-none text-xs ${cardBg[item.agingStatus] ?? "bg-white border-gray-200"} ${dimmed ? "opacity-50" : ""}`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <span className="font-mono font-bold uppercase text-[10px] truncate flex-1">{item.quotation_number}</span>
                                      <Badge className={`text-[8px] shrink-0 ${badgeCls[item.agingStatus] ?? ""}`}>
                                        {statusLabel[item.agingStatus] ?? item.agingStatus}
                                      </Badge>
                                    </div>
                                    <div className="font-semibold truncate text-[11px]">{item.company_name}</div>
                                    <div className="flex items-center justify-between mt-1">
                                      <span className={`text-sm font-black tabular-nums ${
                                        item.agingStatus === "OVERDUE"  ? "text-red-600" :
                                        item.agingStatus === "DUE_SOON" ? "text-amber-600" :
                                        "text-green-700"
                                      }`}>{item.daysAging}d</span>
                                      <span className="text-[9px] text-gray-400">of {item.aging_days}d</span>
                                      {!dimmed && (
                                        <button
                                          onClick={() => { setSelectedAging(item); setFuNote(""); setFuDialogOpen(true); }}
                                          className="text-[9px] font-bold px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-700 text-white rounded-none flex items-center gap-1"
                                        >
                                          <MessageSquare className="w-2.5 h-2.5" /> Update
                                        </button>
                                      )}
                                    </div>
                                    {item.last_follow_up_note && (
                                      <div className="text-[9px] text-blue-600 mt-1 truncate">💬 {item.last_follow_up_note}</div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}

                        {/* Divider between aging and no-activity sections */}
                        {filteredNoActivityAccounts.length > 0 && (
                          <div className="flex items-center gap-2 my-3">
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                        )}
                      </div>
                    )}
                    {/* No Activity section — only if accounts exist */}
                    {filteredNoActivityAccounts.length > 0 && (<>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <h3 className="text-xs font-bold text-amber-700">Activities of Client Last Touch or No Activity</h3>
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                        {filteredNoActivityAccounts.length}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-2 italic">
                      (Based on date of last activity)
                    </p>

                    {/* Search bar */}
                    <div className="relative mb-3">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by company or ref no..."
                        className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-gray-200 rounded-none focus:outline-none focus:border-amber-400"
                        value={noActivitySearch}
                        onChange={(e) => {
                          setNoActivitySearch(e.target.value);
                          setDisplayedNoActivityCount(NO_ACTIVITY_BATCH_SIZE);
                          setDisplayedLastTouchCount(LAST_TOUCH_BATCH_SIZE);
                        }}
                      />
                    </div>

                    {/* Scrollable list */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                      {loadingNoActivity ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        </div>
                      ) : (
                        <>
                          {(() => {
                            const allNoTouch = filteredNoActivityAccounts.filter((a) => !a.hasActivity);
                            const allLastTouch = filteredNoActivityAccounts.filter((a) => a.hasActivity);

                            const displayedNoTouch = allNoTouch.slice(0, displayedNoActivityCount);
                            const displayedLastTouch = allLastTouch.slice(0, displayedLastTouchCount);

                            const showDivider = displayedNoTouch.length > 0 && displayedLastTouch.length > 0;

                            return (
                              <>
                                {displayedNoTouch.map((account) => (
                                  <div
                                    key={account.id}
                                    className="p-2 bg-red-50 border border-red-200 rounded-none text-xs hover:bg-red-100 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium truncate flex-1">{account.company_name}</span>
                                      <Badge
                                        className={`text-[9px] shrink-0 ${
                                          account.agingDays > 30
                                            ? "bg-red-100 text-red-700 border-red-200"
                                            : account.agingDays > 14
                                            ? "bg-orange-100 text-orange-700 border-orange-200"
                                            : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                        }`}
                                      >
                                        {account.agingDays}d
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className="text-[8px] bg-blue-100 text-blue-700 border-blue-200 uppercase">
                                        {account.type_client}
                                      </Badge>
                                      <span className="text-[9px] text-red-500 font-semibold">
                                        No touch · {new Date(account.date_created).toLocaleDateString("en-PH")}
                                      </span>
                                    </div>
                                  </div>
                                ))}

                                {showDivider && (
                                  <div className="flex items-center gap-2 py-1">
                                    <div className="flex-1 h-px bg-amber-300" />
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-amber-600">Last Touch</span>
                                    <div className="flex-1 h-px bg-amber-300" />
                                  </div>
                                )}

                                {displayedLastTouch.map((account) => (
                                  <div
                                    key={account.id}
                                    className="p-2 bg-amber-50/60 border border-amber-200/70 rounded-none text-xs hover:bg-amber-100 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium flex-1">{account.company_name}</span>
                                      <Badge
                                        className={`text-[9px] shrink-0 ${
                                          account.agingDays > 30
                                            ? "bg-red-100 text-red-700 border-red-200"
                                            : account.agingDays > 14
                                            ? "bg-orange-100 text-orange-700 border-orange-200"
                                            : "bg-yellow-100 text-yellow-700 border-yellow-200"
                                        }`}
                                      >
                                        {account.agingDays}d
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className="text-[8px] bg-blue-100 text-blue-700 border-blue-200 uppercase">
                                        {account.type_client}
                                      </Badge>
                                      <span className="text-[9px] text-gray-500">
                                        Last touch: {new Date(account.lastTouch!).toLocaleDateString("en-PH")}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </>
                            );
                          })()}

                          {/* Load more button */}
                          {hasMoreNoActivity && (
                            <button
                              className="w-full py-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-none hover:bg-amber-100 transition-colors"
                              onClick={() => {
                                const allNoTouch = filteredNoActivityAccounts.filter((a) => !a.hasActivity);
                                const allLastTouch = filteredNoActivityAccounts.filter((a) => a.hasActivity);

                                const remainingNoTouch = allNoTouch.length - displayedNoActivityCount;
                                const remainingLastTouch = allLastTouch.length - displayedLastTouchCount;

                                if (remainingNoTouch > 0) {
                                  setDisplayedNoActivityCount(prev => Math.min(prev + Math.min(NO_ACTIVITY_BATCH_SIZE, remainingNoTouch), allNoTouch.length));
                                }
                                if (remainingLastTouch > 0) {
                                  setDisplayedLastTouchCount(prev => Math.min(prev + Math.min(LAST_TOUCH_BATCH_SIZE, remainingLastTouch), allLastTouch.length));
                                }
                              }}
                            >
                              Load more ({remainingItemsCount} remaining)
                            </button>
                          )}
                        </>
                      )}
                    </div>{/* end scrollable list */}
                    </>)}{/* end filteredNoActivityAccounts conditional */}
                  </div>
                )}{/* end sidebar */}

                {/* ─── Main Cards Grid ─────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* ── New Task (full width) ── */}
                    <Card className="rounded-none">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <PlusCircle className="w-5 h-5" /><span>New Task</span>
                        </CardTitle>
                        <CardDescription>
                          Manage your latest Endorsed Tickets and Outbound Calls efficiently. Stay updated with pending tasks and streamline your workflow.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <NewTask
                          referenceid={userDetails.referenceid}
                          userDetails={userDetails}
                          onSaveAccountAction={handleSaveAccount}
                          onRefreshAccountsAction={refreshAccounts}
                        />
                      </CardContent>
                    </Card>

                    {/* ── In Progress ── */}
                    <PlannerCard
                      title="In Progress"
                      icon={<Loader2 className="w-4 h-4" />}
                      count={progressCount}
                      isOpen={collapseState.inProgress}
                      onToggle={() => toggleCollapse("inProgress")}
                    >
                      <Progress {...sharedProps} onCountChange={setProgressCount} />
                    </PlannerCard>

                    {/* ── Scheduled ── */}
                    <PlannerCard
                      title="Scheduled"
                      icon={<Calendar className="w-4 h-4" />}
                      count={scheduledCount}
                      isOpen={collapseState.scheduled}
                      onToggle={() => toggleCollapse("scheduled")}
                    >
                      <Scheduled {...sharedProps} tsm={userDetails.tsm} onCountChange={setScheduledCount} />
                    </PlannerCard>

                    {/* ── Completed ── */}
                    <PlannerCard
                      title="Completed"
                      icon={<CheckCircle className="w-4 h-4" />}
                      count={completedCount}
                      isOpen={collapseState.completed}
                      onToggle={() => toggleCollapse("completed")}
                    >
                      <Completed {...sharedProps} onCountChange={setCompletedCount} />
                    </PlannerCard>

                    {/* ── Delivered ──
                    <PlannerCard
                      title="Delivered"
                      icon={<PackageCheck className="w-4 h-4" />}
                      count={deliveredCount}
                      isOpen={collapseState.delivered}
                      onToggle={() => toggleCollapse("delivered")}
                    >
                      <Delivered {...sharedProps} onCountChange={setDeliveredCount} />
                    </PlannerCard>*/}

                    {/* ── Pending Task ──
                    <PlannerCard
                      title="Pending Task"
                      icon={<Clock className="w-4 h-4" />}
                      count={doneCount}
                      isOpen={collapseState.done}
                      onToggle={() => toggleCollapse("done")}
                    >
                      <Done {...sharedProps} onCountChange={setDoneCount} />
                    </PlannerCard>*/}

                    {/* ── Overdue (full width, red border) ── */}
                    <PlannerCard
                      title="Overdue"
                      icon={<AlertCircle className="w-4 h-4" />}
                      count={overdueCount}
                      isOpen={collapseState.overdue}
                      onToggle={() => toggleCollapse("overdue")}
                      className="border-3 border-red-400 shadow-lg"
                      countColor="text-red-600"
                    >
                      <Overdue {...sharedProps} tsm={userDetails.tsm} onCountChange={setOverdueCount} />
                    </PlannerCard>

                  </div>{/* end grid */}
                </div>{/* end flex-1 overflow-y-auto */}
              </>
            )}
          </main>
        </SidebarInset>
      </ProtectedPageWrapper>
    </>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <NotificationProvider>
        <FormatProvider>
          <SidebarProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <DashboardContent />
            </Suspense>
          </SidebarProvider>
        </FormatProvider>
      </NotificationProvider>
    </UserProvider>
  );
}
