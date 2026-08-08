"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell, FileText, ClipboardList, Check, HeadphonesIcon, Mail } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import { supabase } from "@/utils/supabase";

interface SPFRequest {
  id: number;
  spf_number?: string;
  customer_name?: string;
  prepared_by?: string;
  date_created?: string;
}

interface QuotationNotification {
  id: number;
  quotation_number?: string;
  company_name?: string;
  activity_reference_number?: string;
  date_created?: string;
  type_activity?: string;
  tsm_approved_status?: string;
}

interface SupportTicketNotification {
  ticket_id: string;
  ticket_subject: string;
  status: string;
  date_created: string;
  unseen_count: number;
}

interface EmailNotification {
  uid: number;
  subject: string;
  from_name: string;
  from_address: string;
  date: string | null;
}

type NotificationTab = "all" | "spf" | "quotations" | "support" | "email";

export function UnifiedNotificationBell() {
  const { userId, user } = useUser();
  const [referenceid, setReferenceid] = useState<string | null>(null);
  const [spfRequests, setSpfRequests] = useState<SPFRequest[]>([]);
  const [quotations, setQuotations] = useState<QuotationNotification[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketNotification[]>([]);
  const [emailNotifs, setEmailNotifs] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update referenceid from user context
  useEffect(() => {
    if (user) {
      setReferenceid(user.ReferenceID || "");
    } else {
      setReferenceid(null);
    }
  }, [user]);
  const hasUserInteracted = useRef(false);
  const prevSpfRef = useRef<SPFRequest[]>([]);
  const prevQuotationsRef = useRef<QuotationNotification[]>([]);

  const READ_KEY = `unified_notif_read_${userId}`;
  const ITEMS_PER_PAGE = 10;
  const unreadSPF = spfRequests.filter(s => !readIds.has(`spf-${s.id}`)).length;
  const unreadQuotations = quotations.filter(q => !readIds.has(`q-${q.id}`)).length;
  const unreadSupport = supportTickets.reduce((sum, t) => sum + (t.unseen_count ?? 0), 0);
  const unreadEmail = emailNotifs.filter(e => !readIds.has(`email-${e.uid}`)).length;
  const totalUnread = unreadSPF + unreadQuotations + unreadSupport + unreadEmail;
  const totalCount = spfRequests.length + quotations.length + (unreadSupport > 0 ? 1 : 0) + emailNotifs.length;

  // Track user interaction for audio
  useEffect(() => {
    const markInteracted = () => { hasUserInteracted.current = true; };
    window.addEventListener("click", markInteracted, { once: true });
    window.addEventListener("keydown", markInteracted, { once: true });
    return () => {
      window.removeEventListener("click", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio("/quotation-req.mp3");
    audioRef.current.volume = 0.6;
    audioRef.current.load();
  }, []);

  const playSound = useCallback(() => {
    if (!hasUserInteracted.current) return;
    try {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  // Load read IDs
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(READ_KEY);
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch { localStorage.removeItem(READ_KEY); }
  }, [userId, READ_KEY]);

  const fetchNotifications = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!userId) return;
    
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setCurrentPage(1);
      setHasMore(true);
    }
    
    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }, 10000);
    
    try {
      // Fetch user details to get referenceid
      const userRes = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
      if (!userRes.ok) throw new Error("Failed to fetch user data");
      const userData = await userRes.json();
      const referenceid = userData.ReferenceID || "";

      if (!referenceid) {
        setSpfRequests([]);
        setQuotations([]);
        setSupportTickets([]);
        clearTimeout(timeoutId);
        if (append) setLoadingMore(false);
        else setLoading(false);
        return;
      }

      // Fetch both SPF and Quotations in parallel with pagination
      const isTSA = window.location.pathname.includes('/roles/tsa/');
      const [spfRes, qRes, supportRes] = await Promise.all([
        fetch(`/api/activity/tsa/spf/notifications?referenceid=${referenceid}&page=${page}&limit=${ITEMS_PER_PAGE}`),
        fetch(`/api/activity/tsa/quotation/fetch?referenceid=${referenceid}&page=${page}&limit=${ITEMS_PER_PAGE}`),
        fetch(`/api/support/my-tickets?requestor_id=${encodeURIComponent(referenceid)}`),
      ]);

      // Parse SPF
      let spfData: SPFRequest[] = [];
      if (spfRes.ok) {
        const d = await spfRes.json();
        spfData = d.notifications || [];
      } else {
        console.log("SPF fetch failed:", spfRes.status);
      }

      // Parse Quotations
      let qData: QuotationNotification[] = [];
      if (qRes.ok) {
        const d = await qRes.json();
        const isTSA = window.location.pathname.includes('/roles/tsa/');
        
        console.log("🔔 UnifiedNotificationBell: Fetching quotations data");
        console.log("🔔 UnifiedNotificationBell: Is TSA user:", isTSA);
        console.log("🔔 UnifiedNotificationBell: Raw activities data:", d.activities);
        console.log("🔔 UnifiedNotificationBell: Total activities count:", d.activities?.length || 0);
        
        if (isTSA) {
          // For TSA users, show approved/declined quotations
          qData = (d.activities || []).filter(
            (a: QuotationNotification) =>
              a.type_activity === "Quotation Preparation" &&
              (a.tsm_approved_status === "Approved" || a.tsm_approved_status === "Declined")
          );
          console.log("🔔 UnifiedNotificationBell: TSA filtered quotations (Approved/Declined):", qData);
          console.log("🔔 UnifiedNotificationBell: TSA filtered count:", qData.length);
        } else {
          // For TSM users, show pending quotations
          qData = (d.activities || []).filter(
            (a: QuotationNotification) =>
              a.type_activity === "Quotation Preparation" &&
              a.tsm_approved_status === "Pending"
          );
          console.log("🔔 UnifiedNotificationBell: TSM filtered quotations (Pending):", qData);
          console.log("🔔 UnifiedNotificationBell: TSM filtered count:", qData.length);
        }
      } else {
        console.log("🔔 UnifiedNotificationBell: Quotations fetch failed:", qRes.status);
        console.log("🔔 UnifiedNotificationBell: Quotations fetch response:", qRes);
      }

      // Parse Support Tickets
      let supportData: SupportTicketNotification[] = [];
      if (supportRes.ok) {
        const d = await supportRes.json();
        supportData = (d.tickets ?? []).filter((t: SupportTicketNotification) => (t.unseen_count ?? 0) > 0);
      } else {
        console.log("🔔 Support tickets fetch failed:", supportRes.status, await supportRes.text().catch(() => ""));
      }
      console.log("🔔 Support tickets with unseen:", supportData);

      // Check for new items and play sound using refs
      const newSpfIds = new Set(spfData.map(s => `spf-${s.id}`));
      const newQIds = new Set(qData.map(q => `q-${q.id}`));
      const prevIds = new Set([
        ...prevSpfRef.current.map(s => `spf-${s.id}`), 
        ...prevQuotationsRef.current.map(q => `q-${q.id}`)
      ]);
      
      const hasNew = [...newSpfIds, ...newQIds].some(id => !prevIds.has(id));
      if (hasNew && (spfData.length > 0 || qData.length > 0)) {
        playSound();
      }

      // Update refs before state to avoid race conditions
      prevSpfRef.current = spfData;
      prevQuotationsRef.current = qData;

      if (append) {
        setSpfRequests(prev => [...prev, ...spfData]);
        setQuotations(prev => [...prev, ...qData]);
        setCurrentPage(page);
      } else {
        setSpfRequests(spfData);
        setQuotations(qData);
        setCurrentPage(1);
      }
      
      // Check if there might be more items
      if (spfData.length < ITEMS_PER_PAGE || qData.length < ITEMS_PER_PAGE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      clearTimeout(timeoutId);
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [userId, playSound]);

  // Fetch on mount only (Supabase real-time handles updates)
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for TSM approval/decline events to refresh notifications
  useEffect(() => {
    console.log("🔔 UnifiedNotificationBell: Setting up TSM approval event listener");
    const handleTSMApproval = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("🔔 UnifiedNotificationBell: ✅ TSM approval/decline event received", customEvent);
      console.log("🔔 UnifiedNotificationBell: Event detail:", customEvent.detail);
      console.log("🔔 UnifiedNotificationBell: Current path:", window.location.pathname);
      console.log("🔔 UnifiedNotificationBell: Is TSA:", window.location.pathname.includes('/roles/tsa/'));
      console.log("🔔 UnifiedNotificationBell: Refreshing notifications...");
      fetchNotifications();
    };

    window.addEventListener('tsmQuotationApproval', handleTSMApproval);
    console.log("🔔 UnifiedNotificationBell: ✅ Event listener added");
    
    return () => {
      console.log("🔔 UnifiedNotificationBell: Removing event listener");
      window.removeEventListener('tsmQuotationApproval', handleTSMApproval);
    };
  }, [fetchNotifications]);

  // Dedicated lightweight support tickets refresh — doesn't touch SPF/quotations
  const fetchSupportTickets = useCallback(async () => {
    if (!userId) return;
    try {
      const userRes = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
      if (!userRes.ok) return;
      const userData = await userRes.json();
      const referenceid = userData.ReferenceID || "";
      if (!referenceid) return;

      const res = await fetch(`/api/support/my-tickets?requestor_id=${encodeURIComponent(referenceid)}`);
      if (!res.ok) return;
      const d = await res.json();
      const data = (d.tickets ?? []).filter((t: SupportTicketNotification) => (t.unseen_count ?? 0) > 0);
      console.log("🔔 Support tickets with unseen:", data);
      setSupportTickets(data);
    } catch {}
  }, [userId]);

  // Fetch support tickets on mount
  useEffect(() => {
    fetchSupportTickets();
  }, [fetchSupportTickets]);

  // ── Fetch unread emails (past 7 days) ─────────────────────────────────────
  const fetchEmailNotifs = useCallback(async () => {
    if (!userId) return;
    try {
      // Get the user's default email account
      const accRes = await fetch(`/api/email/accounts?user_id=${encodeURIComponent(userId)}`);
      if (!accRes.ok) return;
      const accData = await accRes.json();
      const accounts: { id: string; is_default: boolean }[] = accData.accounts || [];
      if (accounts.length === 0) return;
      const defaultAcc = accounts.find((a) => a.is_default) ?? accounts[0];

      // Fetch unread messages — limit 20, filter=unread
      const res = await fetch("/api/email/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fn: "list-messages",
          account_id: defaultAcc.id,
          user_id: userId,
          payload: { folder: "INBOX", page: 1, limit: 20, filter: "unread" },
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok || !data.messages) return;

      // Filter to past 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = (data.messages as {
        uid: number; subject: string;
        from: { name?: string; address?: string } | null;
        date: string | null; is_read: boolean;
      }[])
        .filter((m) => {
          if (!m.date) return true; // include if no date
          return new Date(m.date).getTime() >= sevenDaysAgo;
        })
        .map((m) => ({
          uid: m.uid,
          subject: m.subject || "(no subject)",
          from_name: m.from?.name || m.from?.address || "Unknown",
          from_address: m.from?.address || "",
          date: m.date,
        }));

      setEmailNotifs(recent);
    } catch { /* non-fatal */ }
  }, [userId]);

  useEffect(() => {
    fetchEmailNotifs();
    // Poll every 3 minutes
    const interval = setInterval(fetchEmailNotifs, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEmailNotifs]);

  // Realtime: refresh support tickets when a new non-user message is inserted
  useEffect(() => {
    const channel = supabase
      .channel("bell_ticket_notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "ticket_conversations",
      }, (payload) => {
        const msg = payload.new as { sender?: string };
        if (msg?.sender && msg.sender !== "user") {
          fetchSupportTickets();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSupportTickets]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = currentPage + 1;
    fetchNotifications(nextPage, true);
  }, [currentPage, loadingMore, hasMore, fetchNotifications]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = element;
    
    // Load more when user scrolls to bottom (with 100px threshold)
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      loadMore();
    }
  }, [loadMore]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Mark SPF + Quotation as read in localStorage
      const allIds = new Set([
        ...spfRequests.map(s => `spf-${s.id}`),
        ...quotations.map(q => `q-${q.id}`)
      ]);
      setReadIds(allIds);
      try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(allIds))); } catch {}

      // Mark support ticket messages as seen in DB
      if (supportTickets.length > 0) {
        for (const ticket of supportTickets) {
          if ((ticket.unseen_count ?? 0) > 0) {
            fetch("/api/support/mark-seen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ticket_id: ticket.ticket_id }),
            }).catch(() => {});
          }
        }
        // Clear local unseen counts immediately
        setSupportTickets(prev => prev.map(t => ({ ...t, unseen_count: 0 })));
      }

      // Mark email notifications as read locally
      if (emailNotifs.length > 0) {
        const emailIds = emailNotifs.map(e => `email-${e.uid}`);
        const newRead = new Set([...Array.from(allIds), ...emailIds]);
        setReadIds(newRead);
        try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(newRead))); } catch {}
      }
    }
  };

  const markAsRead = (id: string) => {
    const newRead = new Set(readIds);
    newRead.add(id);
    setReadIds(newRead);
    try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(newRead))); } catch {}
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PH", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredItems = () => {
    switch (activeTab) {
      case "spf":
        return { spf: spfRequests, q: [], support: [], email: [] };
      case "quotations":
        return { spf: [], q: quotations, support: [], email: [] };
      case "support":
        return { spf: [], q: [], support: supportTickets, email: [] };
      case "email":
        return { spf: [], q: [], support: [], email: emailNotifs };
      default:
        return { spf: spfRequests, q: quotations, support: supportTickets, email: emailNotifs };
    }
  };

  const { spf: filteredSpf, q: filteredQ, support: filteredSupport, email: filteredEmail } = filteredItems();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[600px] p-0" align="end">
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 border-b">
          <div className="flex items-center justify-between p-3">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {totalUnread > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalUnread} unread
              </Badge>
            )}
          </div>
          
          {/* Tabs */}
          <div className="flex border-t">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "all" 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
              {totalCount > 0 && (
                <span className="ml-1 text-[10px] bg-muted px-1 rounded">{totalCount}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("spf")}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "spf" 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="inline h-3 w-3 mr-1" />
              SPF
              {spfRequests.length > 0 && (
                <span className="ml-1 text-[10px] bg-muted px-1 rounded">{spfRequests.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("quotations")}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "quotations" 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ClipboardList className="inline h-3 w-3 mr-1" />
              Quotations
              {quotations.length > 0 && (
                <span className="ml-1 text-[10px] bg-muted px-1 rounded">{quotations.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("support")}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "support"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HeadphonesIcon className="inline h-3 w-3 mr-1" />
              Support
              {unreadSupport > 0 && (
                <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold">{unreadSupport}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("email")}
              className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
                activeTab === "email"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="inline h-3 w-3 mr-1" />
              Email
              {unreadEmail > 0 && (
                <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 rounded font-bold">{unreadEmail}</span>
              )}
            </button>
          </div>
        </div>

        <ScrollArea className="h-[400px]" onScroll={handleScroll}>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin mx-auto mb-2" />
              Loading notifications...
            </div>
          ) : filteredSpf.length === 0 && filteredQ.length === 0 && filteredSupport.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
              <Bell className="w-8 h-8 opacity-30" />
              <span className="text-sm">No notifications</span>
            </div>
          ) : (
            <div className="divide-y">
              {/* SPF Section */}
              {filteredSpf.length > 0 && (
                <div>
                  <div className="px-3 py-2 bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      SPF Requests
                    </span>
                  </div>
                  {filteredSpf.map((request) => {
                    const id = `spf-${request.id}`;
                    const isUnread = !readIds.has(id);
                    return (
                      <Link
                        key={request.id}
                        href={`/roles/tsm/activity/spf?highlight=${encodeURIComponent(request.spf_number || "")}`}
                        onClick={() => { setOpen(false); markAsRead(id); }}
                      >
                        <div className={`p-3 hover:bg-muted transition-colors cursor-pointer ${isUnread ? "bg-muted/40" : ""}`}>
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {request.customer_name || "Unknown Customer"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                SPF: {request.spf_number || "—"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(request.date_created)}
                              </p>
                            </div>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Quotations Section */}
              {filteredQ.length > 0 && (
                <div>
                  <div className="px-3 py-2 bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <ClipboardList className="h-3 w-3" />
                      {window.location.pathname.includes('/roles/tsa/') ? 'Quotation Updates' : 'Pending Quotations'}
                    </span>
                  </div>
                  {filteredQ.map((notif) => {
                    const id = `q-${notif.id}`;
                    const isUnread = !readIds.has(id);
                    const isTSA = window.location.pathname.includes('/roles/tsa/');
                    return (
                      <div
                        key={notif.id}
                        className={`p-3 hover:bg-muted transition-colors cursor-pointer ${isUnread ? "bg-muted/40" : ""}`}
                        onClick={() => {
                          setOpen(false);
                          markAsRead(id);
                          localStorage.setItem("highlightQuotationId", notif.id.toString());
                          if (isTSA) {
                            window.location.href = `/roles/tsa/activity/revised-quotation`;
                          } else {
                            window.location.href = `/roles/tsm/activity/quotation/pending`;
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isTSA ? 
                              (notif.tsm_approved_status === 'Approved' ? 'bg-green-100' : 'bg-red-100') : 
                              'bg-amber-100'
                          }`}>
                            <ClipboardList className={`h-4 w-4 ${
                              isTSA ? 
                                (notif.tsm_approved_status === 'Approved' ? 'text-green-600' : 'text-red-600') : 
                                'text-amber-600'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {notif.company_name || "Unknown Company"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Quotation: {notif.quotation_number || "—"}
                            </p>
                            {isTSA && notif.tsm_approved_status && (
                              <p className={`text-xs font-medium ${
                                notif.tsm_approved_status === 'Approved' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {notif.tsm_approved_status}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatDate(notif.date_created)}
                            </p>
                          </div>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Support Tickets Section */}
              {filteredSupport.length > 0 && (
                <div>
                  <div className="px-3 py-2 bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <HeadphonesIcon className="h-3 w-3" />
                      Support Replies
                    </span>
                  </div>
                  {filteredSupport.map((ticket) => (
                    <Link
                      key={ticket.ticket_id}
                      href={`/general/support?id=${encodeURIComponent(userId ?? "")}`}
                      onClick={() => setOpen(false)}
                    >
                      <div className="p-3 hover:bg-muted transition-colors cursor-pointer bg-indigo-50/60">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <HeadphonesIcon className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-indigo-600 font-mono">{ticket.ticket_id}</p>
                              <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                                {ticket.unseen_count} new
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 truncate mt-0.5">{ticket.ticket_subject}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(ticket.date_created)}</p>
                          </div>
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1 animate-pulse" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {/* Email Section */}
              {filteredEmail.length > 0 && (
                <div>
                  <div className="px-3 py-2 bg-muted/30">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Unread Emails (last 7 days)
                    </span>
                  </div>
                  {filteredEmail.map((email) => {
                    const id = `email-${email.uid}`;
                    const isUnread = !readIds.has(id);
                    return (
                      <div
                        key={email.uid}
                        className={`p-3 hover:bg-muted transition-colors cursor-pointer ${isUnread ? "bg-blue-50/60" : ""}`}
                        onClick={() => {
                          setOpen(false);
                          markAsRead(id);
                          window.location.href = "/general/email";
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <Mail className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold truncate text-gray-800">{email.from_name}</p>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600 truncate mt-0.5">{email.subject}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(email.date ?? undefined)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t flex gap-2">
          <Link href="/roles/tsm/activity/spf" className="flex-1">
            <Button variant="ghost" className="w-full text-xs" size="sm">
              SPF Requests
            </Button>
          </Link>
          <Link href="/roles/tsm/activity/quotation/pending" className="flex-1">
            <Button variant="ghost" className="w-full text-xs" size="sm">
              Quotations
            </Button>
          </Link>
          <Link href={`/general/support?id=${encodeURIComponent(userId ?? "")}`} className="flex-1">
            <Button variant="ghost" className="w-full text-xs" size="sm" onClick={() => setOpen(false)}>
              Support
            </Button>
          </Link>
          <Link href="/general/email" className="flex-1">
            <Button variant="ghost" className="w-full text-xs" size="sm" onClick={() => setOpen(false)}>
              Email
            </Button>
          </Link>
        </div>
        
        {/* Load More Button */}
        {hasMore && (
          <div className="p-2 border-t">
            <Button 
              onClick={loadMore} 
              disabled={loadingMore}
              variant="ghost" 
              className="w-full text-xs" 
              size="sm"
            >
              {loadingMore ? "Loading more..." : "Load More"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
