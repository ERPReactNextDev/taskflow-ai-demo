// popup/breaches.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCcw, Loader2, List } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { sileo } from "sileo";
import Lottie from "lottie-react";
import buttonAnimation from "../../public/animation/breaches.json";
// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  account_reference_number: string;
  company_name?: string;
  date_created?: string;
  type_activity?: string;
  type_client?: string;
  [key: string]: any;
}

interface ClientSegments {
  top50: number;
  next30: number;
  balance20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
  outbound: number;
}

interface Denominators {
  total: number;
  top50: number;
  next30: number;
  bal20: number;
  csrClient: number;
  newClient: number;
  tsaClient: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatHoursToHMS = (hours: number): string => {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

type TimeByActivity = Record<string, number>;
const computeTimeByActivity = (activities: any[]): TimeByActivity => {
  return activities.reduce((acc, act) => {
    if (!act.start_date || !act.end_date || !act.type_activity) return acc;
    const start = new Date(act.start_date).getTime();
    const end = new Date(act.end_date).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return acc;
    acc[act.type_activity] = (acc[act.type_activity] || 0) + (end - start);
    return acc;
  }, {} as TimeByActivity);
};

// Outbound is determined ONLY by source === "Outbound - Touchbase"
const isOutboundTouchbase = (a: any): boolean =>
  a.source === "Outbound - Touchbase" && a.call_status === "Successful";
// ─── Reusable UI ──────────────────────────────────────────────────────────────
const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center px-2 py-1.5 bg-gray-50 border border-gray-100">
    <span className="text-[10px] text-gray-500 uppercase font-medium">{label}</span>
    <span className="text-[11px] font-bold text-gray-800">{value}</span>
  </div>
);

const SectionCard = ({
  title, badge, children, accent,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) => (
  <li className={`bg-white border border-gray-200 shadow-sm overflow-hidden ${accent ? `border-l-4 ${accent}` : ""}`}>
    <div className="flex justify-between items-center px-3 py-2 border-b border-gray-100 bg-gray-50">
      <span className="text-[10px] font-black uppercase tracking-wider text-gray-700">{title}</span>
      {badge}
    </div>
    <div className="p-3">{children}</div>
  </li>
);

// ─── Component ────────────────────────────────────────────────────────────────
export function BreachesDialog() {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";
  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(today);
  const [userDetails, setUserDetails] = useState({
    referenceid: "", firstname: "", lastname: "", role: "",
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [clusterAccounts, setClusterAccounts] = useState<Activity[]>([]);
  const [uniqueActivitiesList, setUniqueActivitiesList] = useState<Activity[]>([]);
  // Loading
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [loadingCsrMetrics, setLoadingCsrMetrics] = useState(false);
  const [loadingTime, setLoadingTime] = useState(false);
  // Metrics
  const [timeByActivity, setTimeByActivity] = useState<TimeByActivity>({});
  const [timeConsumedMs, setTimeConsumedMs] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [newClientCount, setNewClientCount] = useState(0);
  const [outboundDaily, setOutboundDaily] = useState(0);
  const [outboundWeekly, setOutboundWeekly] = useState(0);
  const [outboundMonthly, setOutboundMonthly] = useState(0);
  const [uniqueClientReach, setUniqueClientReach] = useState(0);
  const [clientSegments, setClientSegments] = useState<ClientSegments>({
    top50: 0, next30: 0, balance20: 0,
    csrClient: 0, newClient: 0, tsaClient: 0,
    outbound: 0,
  });
  const [denominators, setDenominators] = useState<Denominators>({
    total: 0, top50: 0, next30: 0, bal20: 0,
    csrClient: 0, newClient: 0, tsaClient: 0,
  });
  const [pendingClientApprovalCount, setPendingClientApprovalCount] = useState(0);
  const [spfPendingClientApproval, setSpfPendingClientApproval] = useState(0);
  const [spfPendingProcurement, setSpfPendingProcurement] = useState(0);
  const [spfPendingPD, setSpfPendingPD] = useState(0);
  // Additional closing quotation counts
  const [orderCompleteCount, setOrderCompleteCount] = useState(0);
  const [convertToSOCount, setConvertToSOCount] = useState(0);
  const [declinedCount, setDeclinedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [avgNonQuotationHT, setAvgNonQuotationHT] = useState(0);
  const [avgQuotationHT, setAvgQuotationHT] = useState(0);
  const [avgSpfHT, setAvgSpfHT] = useState(0);
  const [overdueByCompany, setOverdueByCompany] = useState<Record<string, number>>({});
  const [overdueCount, setOverdueCount] = useState(0);
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [coverageDialogSource, setCoverageDialogSource] = useState<"covered" | "uncovered" | null>(null);
  const [coveredAccounts, setCoveredAccounts] = useState<Activity[]>([]);
  const [uncoveredAccounts, setUncoveredAccounts] = useState<Activity[]>([]);
  const [newClientByCompany, setNewClientByCompany] = useState<Record<string, number>>({});
  const [showAllNewClients, setShowAllNewClients] = useState(false);
  // Segment dialog for clickable client types
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<"with" | "without">("with");
  // ─── Sync userId from URL ───────────────────────────────────────────────
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);
  // ─── Fetch user ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    setLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setUserDetails({
        referenceid: data.ReferenceID || "",
        role: data.Role || "",
        firstname: data.Firstname || "",
        lastname: data.Lastname || "",
      }))
      .catch(() => sileo.error({ title: "Error", description: "Failed to load user.", duration: 4000, position: "top-center" }))
      .finally(() => setLoadingUser(false));
  }, [userId]);
  // ─── Fetch helpers ──────────────────────────────────────────────────────
  const fetchClusterData = useCallback(async (refId: string) => {
    if (!refId) return;
    try {
      const res = await fetch(`/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const norm = (val: string) => (val || "").toLowerCase().replace(/\s+/g, "");
      // Filter to match Account Management logic
      const excludedStatuses = ["removed", "approved for deletion", "subject for transfer"];
      const allowedTypes = ["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"];
      const filteredAccounts: any[] = (data.data || []).filter((a: any) => {
        const status = (a.status || "").toLowerCase();
        const typeClient = (a.type_client || "").toLowerCase();
        // Must have status and type_client
        if (!a.status || !a.type_client) return false;
        // Exclude removed/approved for deletion/subject for transfer
        if (excludedStatuses.includes(status)) return false;
        // Must be in allowed types
        if (!allowedTypes.includes(typeClient)) return false;
        return true;
      });
      // No deduplication - match Account Management
      setDenominators({
        total: filteredAccounts.length,
        top50: filteredAccounts.filter((a) => norm(a.type_client) === "top50").length,
        next30: filteredAccounts.filter((a) => norm(a.type_client) === "next30").length,
        bal20: filteredAccounts.filter((a) => norm(a.type_client) === "balance20").length,
        csrClient: filteredAccounts.filter((a) => norm(a.type_client) === "csrclient").length,
        newClient: filteredAccounts.filter((a) => norm(a.type_client) === "newclient").length,
        tsaClient: filteredAccounts.filter((a) => norm(a.type_client) === "tsaclient").length,
      });
      setClusterAccounts(
        filteredAccounts.map((a) => ({
          account_reference_number: a.account_reference_number,
          company_name: a.company_name,
          type_client: norm(a.type_client),
        }))
      );
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch cluster data.", duration: 4000, position: "top-center" });
    }
  }, []);

  const fetchActivities = useCallback(async (refId: string, from?: string, to?: string) => {
    if (!refId) return;
    setLoadingActivities(true);
    try {
      let url = `/api/activity/tsa/breaches/fetch?referenceid=${encodeURIComponent(refId)}&fetchAll=true`;
      if (from) url += `&from=${encodeURIComponent(from)}`;
      if (to) url += `&to=${encodeURIComponent(to)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch activities.", duration: 4000, position: "top-center" });
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const fetchOverdue = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId || !from || !to) return;
    setLoadingOverdue(true);
    try {
      const res = await fetch(
        `/api/activity/tsa/breaches/fetch-activity?referenceid=${encodeURIComponent(refId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );

      if (!res.ok) throw new Error();
      const data = await res.json();
      const acts: any[] = data.activities || [];
      const grouped: Record<string, number> = {};
      acts.forEach((a) => { const c = a.company_name || "Unknown"; grouped[c] = (grouped[c] || 0) + 1; });
      setOverdueByCompany(grouped);
      setOverdueCount(acts.length);
    } catch {
      sileo.error({ title: "Error", description: "Failed to fetch overdue activities.", duration: 4000, position: "top-center" });
    } finally {
      setLoadingOverdue(false);
    }
  }, []);

  const fetchCsrMetrics = useCallback(async (refId: string, from: string, to: string) => {
    if (!refId) return;
    setLoadingCsrMetrics(true);
    try {
      const res = await fetch(`/api/act-fetch-activity-v2?referenceid=${encodeURIComponent(refId)}`);
      if (!res.ok) throw new Error();
      const result = await res.json();
      const data: any[] = result.data || [];
      const excluded = [
        "CustomerFeedback/Recommendation", "Job Inquiry", "Job Applicants",
        "Supplier/Vendor Product Offer", "Internal Whistle Blower",
        "Threats/Extortion/Intimidation", "Prank Call",
      ];

      const fromTs = new Date(from).getTime();
      const toDateObj = new Date(to); toDateObj.setHours(23, 59, 59, 999);
      const toTs = toDateObj.getTime();
      let rtTotal = 0, rtCount = 0;
      let nqTotal = 0, nqCount = 0;
      let qTotal = 0, qCount = 0;
      let spfTotal = 0, spfCount = 0;
      data.forEach((row) => {
        if (row.status !== "Closed" && row.status !== "Converted into Sales") return;
        const created = new Date(row.date_created).getTime();
        if (isNaN(created) || created < fromTs || created > toTs) return;
        if (excluded.includes(row.wrap_up)) return;
        const tsaAck = new Date(row.tsa_acknowledge_date).getTime();
        const endorsed = new Date(row.ticket_endorsed).getTime();
        if (!isNaN(tsaAck) && !isNaN(endorsed) && tsaAck >= endorsed) {
          rtTotal += (tsaAck - endorsed) / 3600000; rtCount++;
        }

        const received = new Date(row.ticket_received).getTime();
        const tsaHandle = new Date(row.tsa_handling_time).getTime();
        const tsmHandle = new Date(row.tsm_handling_time).getTime();
        let baseHT = 0;
        if (!isNaN(tsaHandle) && !isNaN(received) && tsaHandle >= received) {
          baseHT = (tsaHandle - received) / 3600000;
        } else if (!isNaN(tsmHandle) && !isNaN(received) && tsmHandle >= received) {
          baseHT = (tsmHandle - received) / 3600000;
        }
        if (!baseHT) return;
        const remarks = (row.remarks || "").toUpperCase();
        if (remarks === "QUOTATION FOR APPROVAL" || remarks === "SOLD") {
          qTotal += baseHT; qCount++;
        } else if (remarks.includes("SPF")) {
          spfTotal += baseHT; spfCount++;
        } else {
          nqTotal += baseHT; nqCount++;
        }
      });

      setAvgResponseTime(rtCount ? rtTotal / rtCount : 0);
      setAvgNonQuotationHT(nqCount ? nqTotal / nqCount : 0);
      setAvgQuotationHT(qCount ? qTotal / qCount : 0);
      setAvgSpfHT(spfCount ? spfTotal / spfCount : 0);
    } catch (error) {
      console.error("CSR metrics error:", error);
    } finally {
      setLoadingCsrMetrics(false);
    }
  }, []);
  // ─── Compute month range from fromDate for territory coverage ──────────

  // Coverage needs the full month; other metrics filter client-side by day

  const monthRange = useMemo(() => {
    const d = new Date(fromDate + "T00:00:00Z");
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1)).toISOString().split("T")[0];
    const monthEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().split("T")[0];
    return { monthStart, monthEnd };
  }, [fromDate]);

  // ─── Auto-fetch when referenceid or date changes ────────────────────────
  useEffect(() => {
    const refId = userDetails.referenceid;
    if (!refId) return;
    fetchClusterData(refId);
    fetchActivities(refId, monthRange.monthStart, monthRange.monthEnd);
    fetchOverdue(refId, fromDate, toDate);
    fetchCsrMetrics(refId, fromDate, toDate);
  }, [userDetails.referenceid, fromDate, toDate, fetchClusterData, fetchActivities, fetchOverdue, fetchCsrMetrics, monthRange]);
  
  // ─── Compute outbound + time metrics ───────────────────────────────────
  useEffect(() => {
    if (!activities.length) {
      setOutboundDaily(0); setOutboundWeekly(0); setOutboundMonthly(0);
      setTimeByActivity({}); setTimeConsumedMs(0);
      setTotalSales(0); setNewClientCount(0);
      return;
    }

    setLoadingTime(true);
    try {
      const startRange = new Date(fromDate);
      startRange.setHours(0, 0, 0, 0);
      const endRange = new Date(toDate);
      endRange.setHours(23, 59, 59, 999);
      // Filter activities within the selected date range
      const rangeActivities = activities.filter((act) => {
        const t = new Date(act.date_created).getTime();
        return t >= startRange.getTime() && t <= endRange.getTime();
      });

      const grouped = computeTimeByActivity(rangeActivities);
      setTimeByActivity(grouped);
      setTimeConsumedMs(Object.values(grouped).reduce((s, ms) => s + ms, 0));
      let sales = 0;
      rangeActivities.forEach((act) => {
        if (act.status === "Delivered") sales += Number(act.actual_sales) || 0;
      });
      setTotalSales(sales);

      // Outbound count based ONLY on source === "Outbound - Touchbase" within date range
      const dailyCount = rangeActivities.filter(isOutboundTouchbase).length;
      setOutboundDaily(dailyCount);
      setPendingClientApprovalCount(
        activities.filter((a) => a.status === "Quote-Done" && a.quotation_status === "Pending Client Approval").length
      );

      setSpfPendingClientApproval(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending Client Approval").length
      );

      setSpfPendingProcurement(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending Procurement").length
      );

      setSpfPendingPD(
        activities.filter((a) => a.call_type === "Quotation with SPF Preparation" && a.quotation_status === "Pending PD").length
      );

      // Additional closing quotation counts
      setOrderCompleteCount(
        activities.filter((a) => a.quotation_status === "Order Complete").length
      );

      setConvertToSOCount(
        activities.filter((a) => a.quotation_status === "Convert to SO").length
      );

      setDeclinedCount(
        activities.filter((a) => a.quotation_status === "Declined").length
      );

      setCancelledCount(
        activities.filter((a) => a.quotation_status === "Cancelled").length
      );

    } finally {
      setLoadingTime(false);
    }

  }, [activities, fromDate, toDate]);
  // ─── Territory coverage ───────────────────────────────────────────────────────────────────────────
  //
  // Scope: the FULL calendar month of fromDate (month start → month end).
  // - "Covered"     = cluster accounts whose company_name matches ANY activity
  //                   company_name within that month range (case-insensitive,
  //                   trailing dots stripped, whitespace collapsed).
  //                   Accounts with the same normalized name count as ONE,
  //                   regardless of different account_reference_numbers.
  // - "Not Reached" = the rest
  // - Denominators come from clusterAccounts (no dedup — matches Account Mgmt).

  // Normalize a company name: lowercase → collapse whitespace → strip trailing dot(s)
  const normalizeCompany = (name: string): string =>
    (name || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/\.+$/, "");

  useEffect(() => {
    if (!clusterAccounts.length) {
      setUniqueClientReach(0);
      setUniqueActivitiesList([]);
      setCoveredAccounts([]);
      setUncoveredAccounts([]);
      setClientSegments({ top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0, outbound: 0 });
      return;
    }

    // Month bounds (UTC)
    const fromDateObj = new Date(fromDate + "T00:00:00Z");
    const year = fromDateObj.getUTCFullYear();
    const month = fromDateObj.getUTCMonth();
    const monthStart = Date.UTC(year, month, 1, 0, 0, 0, 0);
    const monthEnd = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);

    // Step 1 — collect normalized company names touched within the month
    const touchedCompanyNames = new Set<string>();
    const byActivityRef: Record<string, any> = {};

    activities.forEach((act) => {
      const companyName = act.company_name || act.customer_name || act.company;
      if (!companyName || !act.date_created) return;

      // Parse date_created as a literal date string (ignore timezone offset)
      const dateStr = act.date_created.toString().split("T")[0];
      const [y, m, d] = dateStr.split("-").map(Number);
      if (!y || !m || !d) return;
      const t = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
      if (isNaN(t) || t < monthStart || t > monthEnd) return;

      touchedCompanyNames.add(normalizeCompany(companyName));

      if (act.activity_reference_number) {
        byActivityRef[act.activity_reference_number] = act;
      }
    });

    setUniqueActivitiesList(Object.values(byActivityRef));

    // Step 2 — covered / uncovered split by normalized company_name
    // Each cluster account row is evaluated independently (no dedup on accounts),
    // but matching is done by company name so "ABC Corp" and "ABC Corp." both match.
    const covered = clusterAccounts.filter((acc) =>
      acc.company_name && touchedCompanyNames.has(normalizeCompany(acc.company_name))
    );
    const uncovered = clusterAccounts.filter((acc) =>
      !acc.company_name || !touchedCompanyNames.has(normalizeCompany(acc.company_name))
    );

    setCoveredAccounts(covered);
    setUncoveredAccounts(uncovered);

    // Step 3 — segment counts from covered cluster accounts
    const seg = { top50: 0, next30: 0, balance20: 0, csrClient: 0, newClient: 0, tsaClient: 0 };
    covered.forEach((acc) => {
      const type = acc.type_client ?? "";
      if (type === "top50") seg.top50++;
      else if (type === "next30") seg.next30++;
      else if (type === "balance20") seg.balance20++;
      else if (type === "csrclient") seg.csrClient++;
      else if (type === "newclient") seg.newClient++;
      else if (type === "tsaclient") seg.tsaClient++;
    });

    setUniqueClientReach(covered.length);
    setClientSegments({ ...seg, outbound: covered.length });
  }, [activities, clusterAccounts, fromDate]);

  // ─── New clients per company ────────────────────────────────────────────

  useEffect(() => {
    if (!activities.length || !fromDate) {
      setNewClientByCompany({}); setNewClientCount(0); return;
    }

    const targetDate = new Date(fromDate);
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
    const allowed = ["Assisted", "Quote-Done", "SO-Done", "Delivered"];
    const grouped: Record<string, number> = {};

    let total = 0;
    activities.forEach((act) => {
      const t = new Date(act.date_created).getTime();
      if (
        allowed.includes(act.status) &&
        act.type_client === "New Client" &&
        t >= startOfDay.getTime() && t <= endOfDay.getTime()
      ) {
        const company = act.company_name || "Unknown";
        grouped[company] = (grouped[company] || 0) + 1;
        total++;
      }
    });

    setNewClientByCompany(grouped);
    setNewClientCount(total);
  }, [activities, fromDate]);

  // ─── Derived ────────────────────────────────────────────────────────────
  const overdueEntries = Object.entries(overdueByCompany);
  const visibleOverdue = showAllOverdue ? overdueEntries : overdueEntries.slice(0, 5);
  const newClientEntries = Object.entries(newClientByCompany);
  const visibleNewClients = showAllNewClients ? newClientEntries : newClientEntries.slice(0, 5);
  const isAnySyncing = loadingActivities || loadingOverdue;
  const dailyPct = Math.min(100, Math.round((outboundDaily / 20) * 100));

  const handleManualSync = () => {
    const refId = userDetails.referenceid;
    if (!refId) return;
    fetchClusterData(refId);
    fetchActivities(refId, monthRange.monthStart, monthRange.monthEnd);
    fetchOverdue(refId, fromDate, toDate);
    fetchCsrMetrics(refId, fromDate, toDate);
    sileo.success({
      title: "Syncing",
      description: `Refreshing data for ${userDetails.lastname}, ${userDetails.firstname}`,
      duration: 3000,
      position: "top-right",
    });
  };

  // ─── Coverage dialog helpers ────────────────────────────────────────────
  const typeLabel = (normalized: string): string => {
    const map: Record<string, string> = {
      top50: "Top 50", next30: "Next 30", balance20: "Balance 20",
      csrclient: "CSR Client", newclient: "New Client", tsaclient: "TSA Client",
    };
    return map[normalized] ?? normalized;
  };

  const typeColors: Record<string, string> = {
    top50: "bg-amber-100 text-amber-700 border-amber-200",
    next30: "bg-blue-100 text-blue-700 border-blue-200",
    balance20: "bg-violet-100 text-violet-700 border-violet-200",
    newclient: "bg-emerald-100 text-emerald-700 border-emerald-200",
    tsaclient: "bg-rose-100 text-rose-700 border-rose-200",
    csrclient: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const pillColor = (t: string) =>
    typeColors[t] ?? "bg-indigo-50 text-indigo-600 border-indigo-200";
  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── SEGMENT DIALOG ──────────────────────────────────────────────── */}
      {(() => {
        if (!selectedSegment) return null;
        const segmentList = [
          { key: "top50", label: "Top 50" },
          { key: "next30", label: "Next 30" },
          { key: "balance20", label: "Balance 20" },
          { key: "csrclient", label: "CSR Client" },
          { key: "newclient", label: "New Client" },
          { key: "tsaclient", label: "TSA Client" },
        ];
        const current = segmentList.find(s => s.key === selectedSegment);
        const segmentLabel = current?.label ?? selectedSegment;
        // Filter accounts by selected segment and activity filter
        const withActivity = coveredAccounts.filter(acc => acc.type_client === selectedSegment);
        const withoutActivity = uncoveredAccounts.filter(acc => acc.type_client === selectedSegment);
        const displayList = segmentFilter === "with" ? withActivity : withoutActivity;
        return (
          <Dialog open={segmentDialogOpen} onOpenChange={(v) => { if (!v) { setSegmentDialogOpen(false); setSelectedSegment(null); } }}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
              <DialogHeader className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                    {segmentLabel}
                    <span className="ml-2 text-gray-400 font-normal">{displayList.length}</span>
                  </DialogTitle>
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setSegmentFilter("with")}
                      className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${segmentFilter === "with" ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                    >
                      With Activity · {withActivity.length}
                    </button>
                    <button
                      onClick={() => setSegmentFilter("without")}
                      className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${segmentFilter === "without" ? "bg-amber-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                    >
                      Without · {withoutActivity.length}
                    </button>
                  </div>
                </div>
              </DialogHeader>

              {displayList.length === 0 ? (
                <p className="text-[11px] text-gray-300 italic px-4 py-6 text-center">
                  {segmentFilter === "with"
                    ? `No ${segmentLabel} accounts with activity.`
                    : `All ${segmentLabel} accounts have activity.`}
                </p>
              ) : (
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-[10px] border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200">
                          Company
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayList.map((acc, i) => (
                        <tr key={acc.account_reference_number || i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-700 font-medium border-b border-gray-100">
                            {acc.company_name || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── COVERAGE DIALOG ─────────────────────────────────────────────── */}
      {(() => {
        const isCovered = coverageDialogSource === "covered";
        const isUncovered = coverageDialogSource === "uncovered";
        const dialogOpen = isCovered || isUncovered;
        const list = isCovered ? coveredAccounts : uncoveredAccounts;
        return (
          <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setCoverageDialogSource(null); }}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 gap-0">
              <DialogHeader className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                    {isCovered ? "Covered Accounts" : "Not Reached Accounts"}
                    <span className="ml-2 text-gray-400 font-normal">{list.length}</span>
                  </DialogTitle>
                  <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setCoverageDialogSource("covered")}
                      className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isCovered ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                      Covered · {coveredAccounts.length}
                    </button>
                    <button
                      onClick={() => setCoverageDialogSource("uncovered")}
                      className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-colors ${isUncovered ? "bg-amber-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                        }`}
                    >
                      Not Reached · {uncoveredAccounts.length}
                    </button>
                  </div>
                </div>
              </DialogHeader>

              {list.length === 0 ? (
                <p className="text-[11px] text-gray-300 italic px-4 py-6 text-center">
                  {isCovered
                    ? "No accounts reached this month."
                    : "All accounts have been reached this month."}
                </p>
              ) : (
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-[10px] border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[55%]">
                          Company
                        </th>
                        <th className="text-left px-3 py-2 font-black uppercase tracking-wider text-gray-500 border-b border-gray-200 w-[45%]">
                          Type
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((acc, i) => (
                        <tr key={acc.account_reference_number || i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-700 font-medium border-b border-gray-100">
                            {acc.company_name || "—"}
                          </td>
                          <td className="px-3 py-2 border-b border-gray-100">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${pillColor(acc.type_client ?? "")}`}>
                              {typeLabel(acc.type_client ?? "—")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── MAIN DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="fixed bottom-6 right-4 bg-white rounded-none shadow-2xl z-50 flex flex-col border border-gray-200 p-0"
          style={{ width: "95vw", maxWidth: "1040px", height: "80vh" }}
        >

          {/* Header */}
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
            <DialogTitle className="text-xs font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              End of Day Report — Sales
            </DialogTitle>

            <p className="text-[10px] text-gray-400 mt-0.5">
              {loadingUser ? "Loading…" : `${userDetails.lastname || "—"}, ${userDetails.firstname || "—"}`}
            </p>

          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* ── Sync panel ─────────────────────────────────────────── */}

            <div className="bg-gray-50 border border-gray-200 p-3 space-y-3">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                Sync Configuration
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                    Reference ID
                  </label>

                  <Input
                    className="h-7 text-[11px] font-mono rounded-none bg-white border-gray-200"
                    value={userDetails.referenceid}
                    disabled
                    placeholder="Reference ID"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                      Start Date
                    </label>

                    <Input
                      type="date"
                      className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-semibold uppercase text-gray-400 block mb-1">
                      End Date
                    </label>

                    <Input
                      type="date"
                      className="h-7 text-[11px] rounded-none bg-white border-gray-200"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <Button
                className="w-full h-8 bg-gray-900 hover:bg-gray-800 text-[10px] uppercase font-black tracking-wider gap-2 rounded-none"
                onClick={handleManualSync}
                disabled={isAnySyncing || !userDetails.referenceid}
              >

                {isAnySyncing
                  ? <><Loader2 size={11} className="animate-spin" /> Syncing…</>
                  : <><RefreshCcw size={11} /> Sync Data</>}
              </Button>
            </div>

            {/* ── Metrics grid ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* LEFT */}

              <ul className="list-none space-y-3">
                {/* Outbound Performance */}
                <SectionCard title="Outbound Performance">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase font-medium">Daily Count</span>
                    <span className="text-[20px] font-black text-gray-800">{outboundDaily}</span>
                  </div>
                  <p className="text-[8px] text-gray-400 uppercase font-medium mt-2 tracking-wide">
                    Source: Outbound - Touchbase
                  </p>
                </SectionCard>

                {/* Database Coverage */}

                <SectionCard title="Database Coverage">
                  <div className="space-y-2">
                    {/* With Activity / Total */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[14px] font-black text-blue-700">{coveredAccounts.length}</span>
                      <span className="text-[10px] text-gray-400">of {denominators.total} accounts</span>
                    </div>

                    <div className="h-1.5 bg-gray-100 w-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-500"
                        style={{
                          width: denominators.total
                            ? `${Math.min(100, (coveredAccounts.length / denominators.total) * 100)}%`
                            : "0%",
                        }}
                      />
                    </div>

                    {/* Activity Status */}
                    <div className="grid grid-cols-2 gap-2 py-2 border-y border-gray-100">
                      <div className="text-center">
                        <p className="text-[9px] text-gray-400 uppercase mb-1">With Activity</p>
                        <p className="text-[16px] font-black text-emerald-600">{coveredAccounts.length}</p>
                        <p className="text-[9px] text-gray-400">
                          {denominators.total ? Math.round((coveredAccounts.length / denominators.total) * 100) : 0}% of total
                        </p>
                      </div>

                      <div className="text-center border-l border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase mb-1">No Activity</p>
                        <p className="text-[16px] font-black text-amber-600">{uncoveredAccounts.length}</p>
                        <p className="text-[9px] text-gray-400">
                          {denominators.total ? Math.round((uncoveredAccounts.length / denominators.total) * 100) : 0}% of total
                        </p>
                      </div>
                    </div>

                    {/* Type Client Grid - Covered/Total format */}
                    <div className="grid grid-cols-3 gap-1 mt-2">
                      {[
                        { label: "Top 50", key: "top50", covered: clientSegments.top50, total: denominators.top50 },
                        { label: "Next 30", key: "next30", covered: clientSegments.next30, total: denominators.next30 },
                        { label: "Bal 20", key: "balance20", covered: clientSegments.balance20, total: denominators.bal20 },
                        { label: "CSR", key: "csrclient", covered: clientSegments.csrClient, total: denominators.csrClient },
                        { label: "New", key: "newclient", covered: clientSegments.newClient, total: denominators.newClient },
                        { label: "TSA", key: "tsaclient", covered: clientSegments.tsaClient, total: denominators.tsaClient },
                      ].map(({ label, key, covered, total }) => (

                        <button
                          key={label}
                          onClick={() => { setSelectedSegment(key); setSegmentFilter("with"); setSegmentDialogOpen(true); }}
                          className="bg-gray-50 px-2 py-1 text-center border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group"
                        >

                          <p className="text-[8px] text-gray-400 uppercase group-hover:text-blue-600">{label}</p>
                          <p className="text-[10px] font-black text-gray-700 group-hover:text-blue-700">
                            {covered}<span className="text-gray-400 font-normal group-hover:text-blue-400">/{total}</span>
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                </SectionCard>
                {/* Overdue */}

                <SectionCard
                  title={`Overdue Activities${overdueCount > 0 ? ` · ${overdueCount}` : ""}`}
                  accent="border-l-red-400"
                  badge={
                    overdueEntries.length > 5 ? (
                      <button
                        onClick={() => setShowAllOverdue(!showAllOverdue)}
                        className="text-[9px] text-blue-600 font-semibold hover:underline"
                      >
                        {showAllOverdue ? "Less" : "More"}
                      </button>
                    ) : undefined
                  }
                >

                  {loadingOverdue ? (
                    <div className="flex items-center gap-2 text-gray-400 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[10px]">Loading…</span>
                    </div>
                  ) : overdueEntries.length === 0 ? (
                    <p className="text-[10px] text-gray-300 italic">No overdue activities</p>
                  ) : (

                    <div className={`space-y-1 ${showAllOverdue ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
                      {visibleOverdue.map(([company, count]) => (
                        <div key={company} className="flex justify-between items-center px-2 py-1 bg-red-50 border border-red-100">
                          <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                          <strong className="text-[10px] text-red-600 shrink-0">{count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* New Account Development */}
                <SectionCard
                  title={`New Account Devt${newClientCount > 0 ? ` · ${newClientCount}` : ""}`}
                  badge={
                    newClientEntries.length > 5 ? (
                      <button
                        onClick={() => setShowAllNewClients(!showAllNewClients)}
                        className="text-[9px] text-blue-600 font-semibold hover:underline"
                      >
                        {showAllNewClients ? "Less" : "More"}
                      </button>
                    ) : undefined
                  }
                >

                  {newClientEntries.length === 0 ? (
                    <p className="text-[10px] text-gray-300 italic">No new clients today</p>
                  ) : (

                    <div className={`space-y-1 ${showAllNewClients ? "max-h-40 overflow-y-auto pr-1" : ""}`}>
                      {visibleNewClients.map(([company, count]) => (
                        <div key={company} className="flex justify-between items-center px-2 py-1 bg-blue-50 border border-blue-100">
                          <span className="text-[10px] text-gray-600 truncate mr-2">{company}</span>
                          <strong className="text-[10px] text-blue-600 shrink-0">{count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </ul>

              {/* RIGHT */}
              <ul className="list-none space-y-3">
                {/* Time Consumed */}
                <SectionCard
                  title="Time Consumed"
                  badge={<span className="text-[10px] font-bold text-gray-600">{formatDuration(timeConsumedMs)}</span>}
                >
                  {loadingTime ? (
                    <div className="flex items-center gap-2 text-gray-400 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[10px]">Computing…</span>
                    </div>
                  ) : Object.keys(timeByActivity).length === 0 ? (
                    <p className="text-[10px] text-gray-300 italic">No activities logged today</p>
                  ) : (

                    <div className="space-y-1">
                      {Object.entries(timeByActivity).map(([type, ms]) => (
                        <div key={type} className="flex justify-between items-center px-2 py-1 bg-gray-50 border border-gray-100">
                          <span className="text-[10px] text-gray-500 uppercase font-medium truncate mr-2">{type}</span>
                          <span className="text-[10px] font-bold text-gray-800 shrink-0">{formatDuration(ms)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
                {/* Total Sales */}

                <li className="bg-gray-900 border border-gray-800 shadow-sm overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-700">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Total Sales Today</span>
                  </div>

                  <div className="px-3 py-3 flex items-baseline gap-1">
                    <span className="text-gray-400 text-sm font-medium">₱</span>
                    <span className="text-white text-2xl font-black tracking-tight tabular-nums">
                      {totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </li>

                {/* CSR Metrics */}
                <SectionCard title="CSR Metrics — Handling Times">
                  {loadingCsrMetrics ? (
                    <div className="flex items-center gap-2 text-gray-400 py-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[10px]">Loading metrics…</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <StatRow label="TSA Response Time" value={formatHoursToHMS(avgResponseTime)} />
                      <StatRow label="Non-Quotation HT" value={formatHoursToHMS(avgNonQuotationHT)} />
                      <StatRow label="Quotation HT" value={formatHoursToHMS(avgQuotationHT)} />
                      <StatRow label="SPF Handling Duration" value={formatHoursToHMS(avgSpfHT)} />
                    </div>
                  )}

                </SectionCard>

                {/* Closing of Quotation */}
                <SectionCard title="Closing of Quotation" accent="border-l-red-500">
                  <div className="space-y-1">
                    {[
                      { label: "Pending Client Approval", value: pendingClientApprovalCount },
                      { label: "Order Complete", value: orderCompleteCount },
                      { label: "Convert to SO", value: convertToSOCount },
                      { label: "Decline", value: declinedCount },
                      { label: "Cancelled", value: cancelledCount },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center px-2 py-1.5 border-b border-gray-50 last:border-b-0">
                        <span className="text-[10px] text-red-500 font-medium">{label}</span>
                        <span className={`text-[11px] font-black ${value > 0 ? "text-red-600" : "text-gray-400"}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-5 py-3 border-t border-gray-100 shrink-0">
            <Button
              variant="outline"
              className="rounded-none h-8 text-xs px-5 uppercase font-bold tracking-wider"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-16 right-22 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 border border-gray-200 overflow-hidden bg-white"
        onClick={() => setOpen(true)}
        title="Open End of Day Report"
      >
        <Lottie animationData={buttonAnimation} loop className="w-24 h-24" />
      </button>
    </>
  );
}

