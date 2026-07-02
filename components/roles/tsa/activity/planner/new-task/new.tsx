"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  Plus,
  TicketIcon,
  CalendarCheck2,
  LoaderPinwheel,
  TrendingUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";
import { supabase } from "@/utils/supabase";
import { Badge } from "@/components/ui/badge";
import { AccountDialog } from "../dialog/active";

// ─── Constants ─────────────────────────────────────────────────────────────────

const ENDORSED_PAGE_SIZE = 2;       // initial display count
const ENDORSED_LOAD_MORE = 2;       // how many more per "Load More"
const NO_ACTIVITY_BATCH_SIZE = 10;

const EXCLUDED_STATUSES = ["removed", "approved for deletion", "subject for transfer"];
const ALLOWED_TYPES = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];

// ─── Helpers (outside component) ──────────────────────────────────────────────

function generateActivityRef(companyName: string, region: string): string {
  const words = companyName.trim().split(" ");
  const firstInitial = words[0]?.charAt(0).toUpperCase() || "X";
  const lastInitial = words[words.length - 1]?.charAt(0).toUpperCase() || "X";
  return `${firstInitial}${lastInitial}-${region}-${String(Date.now()).slice(-10)}`;
}

function calculateAging(dateStr: string): number {
  const diffMs = new Date().getTime() - new Date(dateStr).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  date_created: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

interface NewTaskProps {
  referenceid: string;
  onEmptyStatusChange?: (isEmpty: boolean) => void;
  userDetails: UserDetails;
  onSaveAccountAction: (data: any) => void;
  onRefreshAccountsAction: () => Promise<void>;
}

interface EndorsedTicket {
  id: string;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  ticket_reference_number: string;
  ticket_remarks: string;
  wrap_up: string;
  inquiry: string;
  tsm: string;
  referenceid: string;
  agent: string;
  date_created: string;
  date_updated: string;
}

interface ActivityForCheck {
  id: string;
  account_reference_number: string;
  activity_reference_number: string;
  company_name: string;
  status: string;
  scheduled_date?: string;
  date_created: string;
}

interface HistoryForCheck {
  activity_reference_number: string;
  status?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export const NewTask: React.FC<NewTaskProps> = ({
  referenceid,
  onEmptyStatusChange,
  userDetails,
  onSaveAccountAction,
  onRefreshAccountsAction,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existingActivities, setExistingActivities] = useState<ActivityForCheck[]>([]);
  const [existingHistory, setExistingHistory] = useState<HistoryForCheck[]>([]);

  const [activities, setActivities] = useState<ActivityForCheck[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const [displayedNoActivityCount, setDisplayedNoActivityCount] = useState(NO_ACTIVITY_BATCH_SIZE);

  // ─── Endorsed tickets: pagination state ───────────────────────────────────
  const [endorsedTickets, setEndorsedTickets] = useState<EndorsedTicket[]>([]);
  const [endorsedDisplayCount, setEndorsedDisplayCount] = useState(ENDORSED_PAGE_SIZE);
  const [endorsedTotalCount, setEndorsedTotalCount] = useState<number>(0);
  const [loadingEndorsed, setLoadingEndorsed] = useState(false);
  const [loadingMoreEndorsed, setLoadingMoreEndorsed] = useState(false);
  const [errorEndorsed, setErrorEndorsed] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<EndorsedTicket | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const endorsedSoundRef = useRef<HTMLAudioElement | null>(null);
  const playedTicketIdsRef = useRef<Set<string>>(new Set());

  // ─── Fetch existing activities for block-check ────────────────────────────

  const fetchExistingActivities = useCallback(async () => {
    if (!referenceid) return;
    try {
      const url = new URL("/api/activity/tsa/planner/fetch-onprogress", window.location.origin);
      url.searchParams.append("referenceid", referenceid);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      setExistingActivities(data.activities || []);
      setExistingHistory(data.history || []);
    } catch {
      // non-critical
    }
  }, [referenceid]);

  useEffect(() => { fetchExistingActivities(); }, [fetchExistingActivities]);

  // ─── Fetch all activities ─────────────────────────────────────────────────

  const fetchActivities = useCallback(async () => {
    if (!referenceid) return;
    setLoadingActivities(true);
    try {
      const res = await fetch(
        `/api/activities?referenceid=${encodeURIComponent(referenceid)}&fetchAll=true`
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setActivities(list);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  }, [referenceid]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  // Reset lazy loading when accounts change
  useEffect(() => {
    setDisplayedNoActivityCount(NO_ACTIVITY_BATCH_SIZE);
  }, [accounts.length]);

  // ─── Fetch endorsed tickets (with offset for pagination) ──────────────────
  // fetchEndorsedTickets(reset=true)  → clears list, fetches from offset 0
  // fetchEndorsedTickets(reset=false) → appends next batch

  const fetchEndorsedTickets = useCallback(async (reset = true) => {
    if (!referenceid) { setEndorsedTickets([]); return; }

    if (reset) {
      setLoadingEndorsed(true);
      setErrorEndorsed(null);
    } else {
      setLoadingMoreEndorsed(true);
    }

    try {
      const currentCount = reset ? 0 : endorsedTickets.length;

      const url = new URL(
        "/api/act-fetch-endorsed-ticket",
        window.location.origin,
      );
      url.searchParams.append("referenceid", referenceid);
      url.searchParams.append("offset", String(currentCount));
      url.searchParams.append("limit", String(reset ? ENDORSED_PAGE_SIZE : ENDORSED_LOAD_MORE));

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || json.error || "Failed to fetch endorsed tickets");
      }

      const json = await res.json();
      const incoming: EndorsedTicket[] = json.activities || [];
      const total: number = json.total ?? incoming.length;

      setEndorsedTotalCount(total);

      if (reset) {
        setEndorsedTickets(incoming);
        setEndorsedDisplayCount(incoming.length);
      } else {
        setEndorsedTickets((prev) => {
          // deduplicate by id
          const existingIds = new Set(prev.map((t) => t.id));
          const newItems = incoming.filter((t) => !existingIds.has(t.id));
          return [...prev, ...newItems];
        });
        setEndorsedDisplayCount((prev) => prev + incoming.length);
      }
    } catch (err: any) {
      setErrorEndorsed(err.message || "Error fetching endorsed tickets");
    } finally {
      setLoadingEndorsed(false);
      setLoadingMoreEndorsed(false);
    }
  }, [referenceid, endorsedTickets.length]);

  // Stable ref so realtime callback doesn't go stale
  const fetchEndorsedRef = useRef(fetchEndorsedTickets);
  useEffect(() => { fetchEndorsedRef.current = fetchEndorsedTickets; }, [fetchEndorsedTickets]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!referenceid) return;

    fetchEndorsedRef.current(true);

    const channel = supabase
      .channel(`endorsed-ticket-${referenceid}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "endorsed-ticket",
        filter: `referenceid=eq.${referenceid}`,
      }, () => fetchEndorsedRef.current(true)) // reset on realtime update
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [referenceid]);

  const hasMoreEndorsed = endorsedTickets.length < endorsedTotalCount;

  // ─── Fetch accounts ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!referenceid) {
      setAccounts([]);
      onEmptyStatusChange?.(true);
      return;
    }

    const fetchAccounts = async () => {
      setError(null);
      setLoading(true);
      try {
        const response = await fetch(
          `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(referenceid)}`
        );
        if (!response.ok) {
          setError("Failed to fetch accounts");
          onEmptyStatusChange?.(true);
          return;
        }
        const data = await response.json();
        setAccounts(data.data || []);
        onEmptyStatusChange?.(!(data.data?.length > 0));
      } catch (err) {
        console.error("Error fetching accounts:", err);
        setError("Error fetching accounts. You can still add new accounts.");
        onEmptyStatusChange?.(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [referenceid, onEmptyStatusChange]);

  // ─── Add account handler ──────────────────────────────────────────────────

  const handleAdd = async (account: Account) => {
    setLoading(true);

    const region = account.region || "NCR";
    const { tsm, manager } = account;

    if (!tsm || !manager) {
      alert("TSM or Manager information is missing. Please check the account data.");
      setLoading(false);
      return;
    }

    const payload = {
      referenceid,
      tsm,
      manager,
      account_reference_number: account.account_reference_number,
      status: "On-Progress",
      company_name: account.company_name,
      contact_person: account.contact_person,
      contact_number: account.contact_number,
      email_address: account.email_address,
      address: account.address,
      type_client: account.type_client,
      activity_reference_number: generateActivityRef(account.company_name, region),
    };

    try {
      const res = await fetch("/api/act-save-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const now = new Date();
      const newDate =
        account.type_client.toLowerCase() === "top 50"
          ? new Date(now.setDate(now.getDate() + 14))
          : new Date(now.setMonth(now.getMonth() + 1));

      const updateRes = await fetch("/api/act-update-account-next-date", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: account.id,
          next_available_date: newDate.toISOString().split("T")[0],
        }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) throw new Error(updateData.error || "Update failed");

      setAccounts((prev) => prev.filter((acc) => acc.id !== account.id));
      await fetchExistingActivities();
      window.location.reload();

      sileo.success({
        title: "Success",
        description: `Successfully added: ${account.company_name}`,
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch (err) {
      sileo.error({
        title: "Failed",
        description: "Error saving or updating account. Please try again.",
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setLoading(false);
    }
  };

  // ─── Use endorsed ticket handler ──────────────────────────────────────────

  const openConfirmUseTicket = (ticket: EndorsedTicket) => {
    setSelectedTicket(ticket);
    setConfirmOpen(true);
  };

  const handleConfirmUseEndorsed = async () => {
    if (confirmLoading || !selectedTicket) return;
    if (!userDetails) {
      sileo.error({ title: "Failed", description: "User details not available.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      return;
    }

    setConfirmLoading(true);
    const ticket = selectedTicket;

    try {
      const payload = {
        ticket_reference_number: ticket.ticket_reference_number,
        account_reference_number: ticket.account_reference_number,
        company_name: ticket.company_name,
        contact_person: ticket.contact_person,
        contact_number: ticket.contact_number,
        email_address: ticket.email_address,
        address: ticket.address,
        tsm: userDetails.tsm,
        referenceid: userDetails.referenceid,
        manager: userDetails.manager,
        status: "On-Progress",
        type_client: "CSR Client",
        ticket_remarks: ticket.ticket_remarks,
        agent: ticket.agent,
        activity_reference_number: generateActivityRef(ticket.company_name || "Taskflow", "NCR"),
      };

      const res = await fetch("/api/act-save-endorsed-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        sileo.error({ title: "Failed", description: "Failed to use endorsed ticket", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }

      const updateStatusRes = await fetch("/api/act-update-ticket-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_reference_number: ticket.ticket_reference_number, status: "Received" }),
      });
      const updateStatusData = await updateStatusRes.json();
      if (!updateStatusRes.ok) {
        sileo.error({ title: "Failed", description: updateStatusData?.error || "Failed to update ticket status", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }

      const updateCompanyRefRes = await fetch("/api/com-update-company-ticket", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_reference_number: ticket.account_reference_number,
          ticket_reference_number: ticket.ticket_reference_number,
          referenceid: userDetails.referenceid,
          tsm: userDetails.tsm,
          manager: userDetails.manager,
        }),
      });
      const updateCompanyRefData = await updateCompanyRefRes.json();
      if (!updateCompanyRefRes.ok) {
        sileo.error({ title: "Failed", description: updateCompanyRefData?.error || "Ticket processed but company update failed.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
        return;
      }

      sileo.success({
        title: "Success",
        description: `Ticket used successfully: ${ticket.company_name}`,
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      // Optimistic remove + adjust total
      setEndorsedTickets((prev) => {
        playedTicketIdsRef.current.delete(ticket.id);
        return prev.filter((t) => t.id !== ticket.id);
      });
      setEndorsedTotalCount((prev) => Math.max(0, prev - 1));

      setConfirmOpen(false);
      setSelectedTicket(null);
      window.location.reload();
    } catch (err) {
      console.error(err);
      sileo.error({ title: "Failed", description: "Unexpected error while using endorsed ticket.", duration: 4000, position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
    } finally {
      setConfirmLoading(false);
    }
  };

  // ─── Derived account lists ────────────────────────────────────────────────

  const activeAccounts = useMemo(() =>
    accounts.filter((acc) => {
      const status = acc.status?.toLowerCase() || "";
      const typeClient = acc.type_client?.toLowerCase() || "";
      if (!acc.status || !acc.type_client) return false;
      if (EXCLUDED_STATUSES.includes(status)) return false;
      if (!ALLOWED_TYPES.includes(typeClient)) return false;
      return true;
    }),
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return activeAccounts.filter(
      (acc) =>
        acc.status?.toLowerCase() === "active" &&
        acc.company_name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [activeAccounts, searchTerm]);

  const accountsWithActivity = useMemo(() => {
    const s = new Set<string>();
    activities.forEach((a) => { if (a.account_reference_number) s.add(a.account_reference_number); });
    return s;
  }, [activities]);

  const accountsWithNoActivity = useMemo(() =>
    activeAccounts.filter((acc) => !accountsWithActivity.has(acc.account_reference_number)),
    [activeAccounts, accountsWithActivity],
  );

  const accountsWithNoActivityAndAging = useMemo(() =>
    accountsWithNoActivity
      .map((account) => ({ ...account, agingDays: calculateAging(account.date_created) }))
      .sort((a, b) => b.agingDays - a.agingDays)
      .slice(0, displayedNoActivityCount),
    [accountsWithNoActivity, displayedNoActivityCount],
  );

  // ─── Sound init ───────────────────────────────────────────────────────────

  useEffect(() => {
    endorsedSoundRef.current = new Audio("/ticket-endorsed.mp3");
    endorsedSoundRef.current.volume = 0.9;
  }, []);

  // ─── Search Result Item Component ─────────────────────────────────────────

  const SearchResultItem = ({ account }: { account: Account }) => {
    const [isHovering, setIsHovering] = useState(false);
    const [planData, setPlanData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPlan = useCallback(async () => {
      if (!account.company_name) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/account-development-plan?company_name=${encodeURIComponent(account.company_name)}`
        );
        if (res.ok) {
          const data = await res.json();
          setPlanData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, [account.company_name]);

    const handleMouseEnter = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsHovering(true);
        fetchPlan();
      }, 300); // 300ms delay
    };

    const handleMouseLeave = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsHovering(false);
    };

    return (
      <AccordionItem key={account.id} value={account.id}>
        <div className="flex justify-between items-center p-2 select-none">
          <AccordionTrigger className="flex flex-1 items-center justify-between text-xs font-semibold font-mono">
            <span>{account.company_name}</span>
            {account.next_available_date && (
              <Badge className="bg-green-600">
                <CalendarCheck2 /> Scheduled{" "}
                {new Date(account.next_available_date).toLocaleDateString("en-CA")}
              </Badge>
            )}
          </AccordionTrigger>
          <div className="flex gap-2 ml-4 items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600 border border-slate-200 transition-all"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
                  </Button>
                </TooltipTrigger>
                {isHovering && (
                  <TooltipContent
                    className="max-w-2xl p-4 bg-white text-slate-900 border border-slate-200 shadow-lg"
                    side="right"
                    align="start"
                    onPointerEnter={() => setIsHovering(true)}
                    onPointerLeave={() => setIsHovering(false)}
                  >
                    {loading ? (
                      <div className="text-xs text-gray-500">Loading...</div>
                    ) : planData.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-gray-700">Account Development Plan</div>
                        {planData.slice(0, 3).map((plan) => (
                          <div key={plan.id} className="border-t border-slate-100 pt-2 space-y-1">
                            <div className="text-xs font-semibold text-gray-800">
                              {plan.customer_name}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Status: {plan.status || "—"}
                            </div>
                            {plan.account_summary && (
                              <div className="text-[10px] text-gray-600 line-clamp-2">
                                {plan.account_summary}
                              </div>
                            )}
                            {plan.key_contacts && plan.key_contacts.length > 0 && (
                              <div className="text-[10px] text-gray-500">
                                Key Contacts: {plan.key_contacts.map((c: any) => c.name).join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                        {planData.length > 3 && (
                          <div className="text-[10px] text-blue-500">
                            +{planData.length - 3} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">No account development plan found</div>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <AddButton account={account} />
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
    );
  };

  // ─── Add button ───────────────────────────────────────────────────────────

  const AddButton = ({ account }: { account: Account }) => (
    <Button
      type="button"
      className="cursor-pointer rounded-none"
      onClick={(e) => { e.stopPropagation(); handleAdd(account); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleAdd(account); }
      }}
    >
      <Plus /> Add
    </Button>
  );

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-h-[70vh] overflow-auto space-y-8 custom-scrollbar">

      {/* ─── Endorsed Tickets ───────────────────────────────────────────────── */}
      {loadingEndorsed ? (
        <div className="flex justify-center items-center h-20">
          <Spinner className="size-6" />
        </div>
      ) : errorEndorsed ? (
        <Alert variant="destructive" className="p-3 text-xs mb-4">
          <AlertCircleIcon className="inline-block mr-2" />
          {errorEndorsed}
        </Alert>
      ) : endorsedTickets.length > 0 ? (
        <section className="mb-6">
          <h2 className="text-xs font-bold mb-4">
            Endorsed Tickets{" "}
            <span className="text-muted-foreground font-normal">
              (showing {endorsedTickets.length} of {endorsedTotalCount})
            </span>
          </h2>

          <Accordion
            type="single"
            collapsible
            className="w-full border-3 rounded-none shadow-sm mt-2 border-red-500"
          >
            {endorsedTickets.map((ticket) => (
              <AccordionItem key={ticket.id} value={ticket.id}>
                <div className="flex justify-between items-center p-2 select-none">
                  <AccordionTrigger className="flex-1 text-xs font-semibold cursor-pointer font-mono uppercase">
                    {ticket.company_name}
                  </AccordionTrigger>

                  <Button
                    type="button"
                    className="cursor-pointer rounded-none"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); openConfirmUseTicket(ticket); }}
                  >
                    <TicketIcon /> Use Ticket
                  </Button>
                </div>

                <AccordionContent className="flex flex-col gap-2 p-3 text-xs uppercase">
                  <p><strong>Contact Person:</strong> {ticket.contact_person}</p>
                  <p><strong>Contact Number:</strong> {ticket.contact_number}</p>
                  <p><strong>Email Address:</strong> {ticket.email_address}</p>
                  <p><strong>Address:</strong> {ticket.address}</p>
                  <p><strong>Ticket Reference #:</strong> {ticket.ticket_reference_number}</p>
                  <p><strong>Wrap Up:</strong> {ticket.wrap_up}</p>
                  <p className="border border-red-500 border-dashed rounded-none p-4 bg-red-100">
                    <strong>Inquiry / Notes:</strong> {ticket.ticket_remarks || ticket.inquiry}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* ─── Load More Endorsed Tickets ───── */}
          {hasMoreEndorsed && (
            <div className="flex justify-center py-3 mt-2">
              <Button
                variant="outline"
                className="rounded-none text-xs"
                onClick={() => fetchEndorsedTickets(false)}
                disabled={loadingMoreEndorsed}
              >
                {loadingMoreEndorsed ? (
                  <span className="flex items-center gap-2">
                    <LoaderPinwheel className="animate-spin h-3 w-3" /> Loading...
                  </span>
                ) : (
                  `Load More (${endorsedTotalCount - endorsedTickets.length} remaining)`
                )}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {/* ─── Confirm Use Ticket Dialog ────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="text-xs rounded-none">
          <DialogHeader>
            <DialogTitle>Use Endorsed Ticket</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to use this ticket? This action cannot be undone.</div>
          <DialogFooter className="flex gap-4 mt-4 justify-end">
            <Button
              variant="outline"
              className="rounded-none p-6"
              onClick={() => setConfirmOpen(false)}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-none p-6"
              onClick={handleConfirmUseEndorsed}
              disabled={confirmLoading}
            >
              {confirmLoading ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Accounts Section ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Spinner className="size-8" />
        </div>
      ) : error ? (
        <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
          <div className="flex items-center space-x-3">
            <AlertCircleIcon className="h-6 w-6 text-red-600" />
            <div>
              <AlertTitle>No Companies Found or No Network Connection</AlertTitle>
              <AlertDescription className="text-xs">Please check your internet connection or try again later.</AlertDescription>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <CheckCircle2Icon className="h-6 w-6 text-green-600" />
            <div>
              <AlertTitle className="text-black">Add New Companies</AlertTitle>
              <AlertDescription className="text-xs">You can start by adding new entries to populate your database.</AlertDescription>
            </div>
          </div>
        </Alert>
      ) : (
        <>
          <div className="flex items-center gap-2 w-full">
            <Input
              type="search"
              placeholder="Search Company Name..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 rounded-none p-2 border border-gray-300 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button className="shrink-0 cursor-pointer rounded-none" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus /> Add
            </Button>
          </div>

          {/* Search results — only visible when searching */}
          {searchTerm.trim() && (
            <section>
              <h2 className="text-xs font-bold mb-4">
                Search Results{" "}
                <span className="text-green-600">({filteredAccounts.length})</span>
              </h2>
              {filteredAccounts.length === 0 ? (
                <p className="text-xs text-gray-500">No companies found.</p>
              ) : (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full border rounded-none shadow-sm mt-2 border-blue-200 uppercase"
                >
                  {filteredAccounts.map((account) => (
                    <SearchResultItem key={account.id} account={account} />
                  ))}
                </Accordion>
              )}
            </section>
          )}
        </>
      )}

      <AccountDialog
        mode="create"
        userDetails={userDetails}
        onSaveAction={async (data) => {
          await onSaveAccountAction(data);
          setIsCreateDialogOpen(false);
        }}
        open={isCreateDialogOpen}
        onOpenChangeAction={setIsCreateDialogOpen}
      />
    </div>
  );
};