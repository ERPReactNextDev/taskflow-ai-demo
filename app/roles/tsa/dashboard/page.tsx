"use client";

import React, { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { type DateRange } from "react-day-picker";
import { sileo } from "sileo";

// Cards
import { RunningTargetCard } from "@/components/roles/tsa/dashboard/card/running-target";
import { RunningSiCard } from "@/components/roles/tsa/dashboard/card/running-si";
import { RunningSoCard } from "@/components/roles/tsa/dashboard/card/running-so";
import { OutboundTouchbaseCountCard } from "@/components/roles/tsa/dashboard/card/outbound-touchbase-count";
import { SalesPipelineCard } from "@/components/roles/tsa/dashboard/card/sales-pipeline";
import { SiSoAchievementCard } from "@/components/roles/tsa/dashboard/card/si-so-achievement";
import { MonthlySiTrendCard } from "@/components/roles/tsa/dashboard/card/monthly-si-trend";
import { TsaPerformanceDetail } from "@/components/roles/tsa/dashboard/card/tsa-performance-detail";
import { KpiWeightedScores } from "@/components/roles/tsa/dashboard/card/kpi-weighted-scores";

//
import { AccountCard } from "@/components/roles/tsa/dashboard/card/accounts";
import { OutboundTouchbaseCard } from "@/components/roles/tsa/dashboard/card/outbound-touchbase";
import { TimemotionCard } from "@/components/roles/tsa/dashboard/card/time-and-motion";
import { ActivityCard } from "@/components/roles/tsa/dashboard/card/other-activities";
// Charts
import { SourceCard } from "@/components/roles/tsa/dashboard/chart/source";
import { CSRMetricsCard } from "@/components/roles/tsa/dashboard/chart/csr";
// Lists
import { OutboundCallsCard } from "@/components/roles/tsa/dashboard/list/outbound";
import { QuotationCard } from "@/components/roles/tsa/dashboard/list/quotation";
import { SOCard } from "@/components/roles/tsa/dashboard/list/so";
// Maps
import { SiteVisitCard } from "@/components/roles/tsa/dashboard/maps/site-visit";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

/* ================= TYPES ================= */

interface UserDetails {
  referenceid: string;
  tsm?: string;
  manager?: string;
  firstname?: string;
  lastname?: string;
}

interface Activity {
  referenceid: string;
  source?: string;
  call_status?: string;
  date_created: string;
  start_date?: string;
  end_date?: string;
  type_activity: string;
  status: string;
  actual_sales: string;
  quotation_number: string;
  quotation_amount: string;
  so_number: string;
  so_amount: string;
  type_client: string;
  activity_reference_number: string;
  company_name?: string;
}

/* ================= HELPERS ================= */

/** Narrows DateRange (optional from/to) into a strict { from, to } object. */
function toStrictRange(
  range: DateRange | undefined
): { from: Date; to: Date } | undefined {
  if (range?.from && range?.to) return { from: range.from, to: range.to };
  return undefined;
}

/* ================= MAIN CONTENT ================= */

function DashboardContent() {
  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    React.useState<DateRange | undefined>(undefined);

  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  /* Default to today on first load */
  useEffect(() => {
    if (!dateCreatedFilterRange) {
      const today = new Date();
      setDateCreatedFilterRangeAction({
        from: new Date(today.setHours(0, 0, 0, 0)),
        to: new Date(new Date().setHours(23, 59, 59, 999)),
      });
    }
  }, [dateCreatedFilterRange]);

  /* Sync userId from URL */
  const queryUserId = searchParams?.get("id") ?? "";
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  /* ---- User ---- */
  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
    firstname: "",
    lastname: "",
  });
  const [loadingUser, setLoadingUser] = useState(false);
  const [errorUser, setErrorUser] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setErrorUser(null);
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          firstname: data.Firstname || "",
          lastname: data.Lastname || "",
        });

        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } catch {
        sileo.error({
          title: "Failed",
          description:
            "Failed to connect to server. Please try again later or refresh your network connection.",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  /* ---- Sales Quota Target & Quote Target ---- */
  const [salesQuotaTotal, setSalesQuotaTotal] = useState<number>(0);
  const [quoteTarget, setQuoteTarget] = useState<number>(120); // Default target
  const [loadingSalesQuota, setLoadingSalesQuota] = useState(false);

  const fetchSalesQuota = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setSalesQuotaTotal(0);
      setQuoteTarget(120);
      return;
    }

    setLoadingSalesQuota(true);
    try {
      // Fetch sales quota (for running target)
      const [quotaRes, quotationRes] = await Promise.all([
        fetch(`/api/sales-quota?referenceid=${encodeURIComponent(referenceid)}`),
        fetch(`/api/sales-quotation?referenceid=${encodeURIComponent(referenceid)}`)
      ]);

      if (!quotaRes.ok) throw new Error("Failed to fetch sales quota");
      if (!quotationRes.ok) throw new Error("Failed to fetch sales quotation");

      const quotaData = await quotaRes.json();
      const quotationData = await quotationRes.json();

      setSalesQuotaTotal(Number(quotaData.total) || 0);
      setQuoteTarget(Number(quotationData.quoteTarget) || 0);
    } catch (err) {
      console.error("Error fetching sales data:", err);
    } finally {
      setLoadingSalesQuota(false);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    fetchSalesQuota();
  }, [fetchSalesQuota]);

  /* ---- History Totals ---- */
  const [totalActualSales, setTotalActualSales] = useState<number>(0);
  const [totalSoAmount, setTotalSoAmount] = useState<number>(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ---- Outbound Calls Count & Target ---- */
  const [outboundCallsCount, setOutboundCallsCount] = useState<number>(0);
  const [loadingOutboundCalls, setLoadingOutboundCalls] = useState(false);
  const [outboundCallsTarget, setOutboundCallsTarget] = useState<number>(0);
  const [loadingOutboundCallsTarget, setLoadingOutboundCallsTarget] = useState(false);

  /* ---- Approved Quotes Count ---- */
  const [quotesCount, setQuotesCount] = useState<number>(0);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  /* ---- Calls to Quotes Count ---- */
  const [callsToQuotesCount, setCallsToQuotesCount] = useState<number>(0);
  const [loadingCallsToQuotes, setLoadingCallsToQuotes] = useState(false);

  /* ---- Quote to SO Count ---- */
  const [quoteToSOQuotationCount, setQuoteToSOQuotationCount] = useState<number>(0);
  const [quoteToSOSalesOrderCount, setQuoteToSOSalesOrderCount] = useState<number>(0);
  const [loadingQuoteToSO, setLoadingQuoteToSO] = useState(false);

  /* ---- SO to SI Count ---- */
  const [soToSISalesOrderCount, setSoToSISalesOrderCount] = useState<number>(0);
  const [soToSIDeliveredCount, setSoToSIDeliveredCount] = useState<number>(0);

  const fetchOutboundCalls = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setOutboundCallsCount(0);
      return;
    }

    setLoadingOutboundCalls(true);
    try {
      const res = await fetch(`/api/history-outbound?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch outbound calls");
      const data = await res.json();
      setOutboundCallsCount(Number(data.count) || 0);
    } catch (err) {
      console.error("Error fetching outbound calls:", err);
    } finally {
      setLoadingOutboundCalls(false);
    }
  }, [userDetails.referenceid]);

  const fetchOutboundCallsTarget = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setOutboundCallsTarget(0);
      return;
    }

    setLoadingOutboundCallsTarget(true);
    try {
      const res = await fetch(`/api/sales-ob?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch sales ob target");
      const data = await res.json();
      setOutboundCallsTarget(Number(data.target) || 0);
    } catch (err) {
      console.error("Error fetching sales ob target:", err);
    } finally {
      setLoadingOutboundCallsTarget(false);
    }
  }, [userDetails.referenceid]);

  const fetchApprovedQuotes = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setQuotesCount(0);
      return;
    }

    setLoadingQuotes(true);
    try {
      const res = await fetch(`/api/history-quotations?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch approved quotations");
      const data = await res.json();
      setQuotesCount(Number(data.count) || 0);
    } catch (err) {
      console.error("Error fetching approved quotations:", err);
    } finally {
      setLoadingQuotes(false);
    }
  }, [userDetails.referenceid]);

  const fetchCallsToQuotes = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setCallsToQuotesCount(0);
      return;
    }

    setLoadingCallsToQuotes(true);
    try {
      const res = await fetch(`/api/history-calls-to-quotes?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch calls to quotes");
      const data = await res.json();
      setCallsToQuotesCount(Number(data.count) || 0);
    } catch (err) {
      console.error("Error fetching calls to quotes:", err);
    } finally {
      setLoadingCallsToQuotes(false);
    }
  }, [userDetails.referenceid]);

  const fetchQuoteToSO = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setQuoteToSOQuotationCount(0);
      setQuoteToSOSalesOrderCount(0);
      return;
    }

    setLoadingQuoteToSO(true);
    try {
      const res = await fetch(`/api/history-quote-to-so?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch quote to SO");
      const data = await res.json();
      setQuoteToSOQuotationCount(Number(data.quoteToSOQuotationCount) || 0);
      setQuoteToSOSalesOrderCount(Number(data.quoteToSOSalesOrderCount) || 0);
    } catch (err) {
      console.error("Error fetching quote to SO:", err);
    } finally {
      setLoadingQuoteToSO(false);
    }
  }, [userDetails.referenceid]);

  const fetchSoToSI = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setSoToSISalesOrderCount(0);
      setSoToSIDeliveredCount(0);
      return;
    }

    try {
      const res = await fetch(`/api/history-so-to-si?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch SO to SI");
      const data = await res.json();
      setSoToSISalesOrderCount(Number(data.soToSISalesOrderCount) || 0);
      setSoToSIDeliveredCount(Number(data.soToSIDeliveredCount) || 0);
    } catch (err) {
      console.error("Error fetching SO to SI:", err);
    }
  }, [userDetails.referenceid]);

  /* ---- Client Visits Count (current month Login entries) ---- */
  const [clientVisitsCount, setClientVisitsCount] = useState<number>(0);

  /* ---- New Account Development ---- */
  const [newAccountCount, setNewAccountCount]   = useState<number>(0);
  const [newAccountTarget, setNewAccountTarget] = useState<number>(2);
  const [loadingNewAccount, setLoadingNewAccount] = useState(false);

  /* ---- CSR Metrics (lifted from CSRMetricsCard) ---- */
  const [csrAvgResponseTime, setCsrAvgResponseTime] = useState<number>(0);
  const [csrAvgQuotationHT, setCsrAvgQuotationHT] = useState<number>(0);
  const [csrAvgNonQuotationHT, setCsrAvgNonQuotationHT] = useState<number>(0);

  const fetchClientVisits = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setClientVisitsCount(0); return; }
    try {
      const res = await fetch(`/api/fetch-tasklog?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch client visits");
      const data = await res.json();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const count = (data.siteVisits || []).filter((v: any) => {
        if (v.Status !== "Login") return false;
        const d = new Date(v.date_created);
        return !isNaN(d.getTime()) && d >= monthStart;
      }).length;
      setClientVisitsCount(count);
    } catch (err) {
      console.error("Error fetching client visits:", err);
    }
  }, [userDetails.referenceid]);

  const fetchNewAccount = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setNewAccountCount(0); setNewAccountTarget(2); return; }
    setLoadingNewAccount(true);
    try {
      const res = await fetch(`/api/sales-account-development?referenceid=${encodeURIComponent(referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch new account development");
      const data = await res.json();
      setNewAccountCount(Number(data.count)  || 0);
      setNewAccountTarget(Number(data.target) || 2);
    } catch (err) {
      console.error("Error fetching new account development:", err);
    } finally {
      setLoadingNewAccount(false);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    fetchOutboundCalls();
    fetchOutboundCallsTarget();
    fetchApprovedQuotes();
    fetchCallsToQuotes();
    fetchQuoteToSO();
    fetchSoToSI();
    fetchClientVisits();
    fetchNewAccount();
  }, [fetchOutboundCalls, fetchOutboundCallsTarget, fetchApprovedQuotes, fetchCallsToQuotes, fetchQuoteToSO, fetchSoToSI, fetchClientVisits, fetchNewAccount]);

  const fetchHistory = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setTotalActualSales(0);
      setTotalSoAmount(0);
      return;
    }

    setLoadingHistory(true);
    try {
      // Fetch SI and SO in parallel
      const [siRes, soRes] = await Promise.all([
        fetch(`/api/history?referenceid=${encodeURIComponent(referenceid)}`),
        fetch(`/api/history-so?referenceid=${encodeURIComponent(referenceid)}`)
      ]);

      if (!siRes.ok) throw new Error("Failed to fetch history si");
      if (!soRes.ok) throw new Error("Failed to fetch history so");

      const siData = await siRes.json();
      const soData = await soRes.json();

      setTotalActualSales(Number(siData.total) || 0);
      setTotalSoAmount(Number(soData.total) || 0);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  /* ---- Activities ---- */
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [errorActivities, setErrorActivities] = useState<string | null>(null);

  const fetchActivities = useCallback(() => {
    const { referenceid } = userDetails;
    if (!referenceid) {
      setActivities([]);
      return;
    }

    setLoadingActivities(true);
    setErrorActivities(null);

    const from = dateCreatedFilterRange?.from
      ? new Date(dateCreatedFilterRange.from).toISOString().slice(0, 10)
      : null;
    const to = dateCreatedFilterRange?.to
      ? new Date(dateCreatedFilterRange.to).toISOString().slice(0, 10)
      : null;

    const url = new URL(
      "/api/activity/tsa/dashboard/fetch",
      window.location.origin
    );
    url.searchParams.append("referenceid", referenceid);
    if (from && to) {
      url.searchParams.append("from", from);
      url.searchParams.append("to", to);
    }

    fetch(url.toString())
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch activities");
        return res.json();
      })
      .then((data) => setActivities(data.activities || []))
      .catch((err) => setErrorActivities(err.message))
      .finally(() => setLoadingActivities(false));
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  /* ---- Client-side date filter ---- */
  const filteredActivities = useMemo(() => {
    if (!dateCreatedFilterRange?.from) return activities;

    const from = new Date(dateCreatedFilterRange.from);
    from.setHours(0, 0, 0, 0);
    const to = dateCreatedFilterRange.to
      ? new Date(new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999))
      : null;

    return activities.filter((a) => {
      if (!a.date_created) return true;
      const d = new Date(a.date_created);
      if (d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [activities, dateCreatedFilterRange]);

  /* Shared props passed to many cards */
  const cardProps = {
    activities: filteredActivities,
    loading: loadingActivities,
    error: errorActivities,
  };

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset>
        {/* Top bar */}
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 z-[50]">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                    KPI Dashboard
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center px-3">
            <UnifiedNotificationBellLazy />
          </div>
        </header>

        <div className="flex flex-col gap-4 p-4">
          {/* Background grid */}

          {/* Row 1
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <RunningTargetCard
              referenceid={userDetails.referenceid}
              total={salesQuotaTotal}
              loading={loadingSalesQuota}
            />
            <RunningSiCard
              referenceid={userDetails.referenceid}
              targetTotal={salesQuotaTotal}
              total={totalActualSales}
              loading={loadingHistory}
            />
            <RunningSoCard
              referenceid={userDetails.referenceid}
              targetTotal={salesQuotaTotal}
              total={totalSoAmount}
              loading={loadingHistory}
            />
            <OutboundTouchbaseCountCard
              referenceid={userDetails.referenceid}
              count={outboundCallsCount}
              target={outboundCallsTarget}
              loading={loadingOutboundCalls}
              loadingTarget={loadingOutboundCallsTarget}
            />
          </div>

          <SalesPipelineCard
            obCallsCount={outboundCallsCount}
            obCallsTarget={outboundCallsTarget}
            loadingObCalls={loadingOutboundCalls}
            loadingObCallsTarget={loadingOutboundCallsTarget}
            quotesCount={quotesCount}
            quotesTarget={quoteTarget}
            loadingQuotes={loadingQuotes}
            callsToQuotesCount={callsToQuotesCount}
            loadingCallsToQuotes={loadingCallsToQuotes}
            quoteToSOQuotationCount={quoteToSOQuotationCount}
            quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
            loadingQuoteToSO={loadingQuoteToSO}
            soToSISalesOrderCount={soToSISalesOrderCount}
            soToSIDeliveredCount={soToSIDeliveredCount}
            newAccountCount={newAccountCount}
            newAccountTarget={newAccountTarget}
            loadingNewAccount={loadingNewAccount}
          />

          <SiSoAchievementCard
            referenceid={userDetails.referenceid}
            siTarget={70}   // optional, defaults to 70
            soTarget={30}   // optional, defaults to 30
          />

          <MonthlySiTrendCard referenceid={userDetails.referenceid} />

          <TsaPerformanceDetail referenceid={userDetails.referenceid} />

          <KpiWeightedScores
            name={`${userDetails.firstname} ${userDetails.lastname}`.trim() || userDetails.referenceid}
            loading={loadingOutboundCalls || loadingQuotes || loadingCallsToQuotes || loadingQuoteToSO || loadingSalesQuota || loadingHistory}
            runningTarget={salesQuotaTotal}
            totalActualSales={totalActualSales}
            obCallsCount={outboundCallsCount}
            obCallsTarget={outboundCallsTarget}
            quotesCount={quotesCount}
            quotesTarget={quoteTarget}
            callsToQuotesCount={callsToQuotesCount}
            obCallsForRatio={outboundCallsCount}
            quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
            quoteToSOQuotationCount={quoteToSOQuotationCount}
            soToSIDeliveredCount={soToSIDeliveredCount}
            soToSISalesOrderCount={soToSISalesOrderCount}
            clientVisits={clientVisitsCount}
            clientVisitsTarget={80}
            avgResponseTime={csrAvgResponseTime}
            avgQuotationHT={csrAvgQuotationHT}
            avgNonQuotationHT={csrAvgNonQuotationHT}
            newAccountCount={newAccountCount}
            newAccountTarget={newAccountTarget}
          />
          — Summary cards */}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <AccountCard referenceid={userDetails.referenceid} />
            <OutboundTouchbaseCard {...cardProps} />
            <TimemotionCard
              {...cardProps}
              referenceid={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
            <ActivityCard {...cardProps} dateRange={dateCreatedFilterRange} />
          </div>

          {/* Row 2 — Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SourceCard {...cardProps} />
            <CSRMetricsCard
              referenceId={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
              onMetricsChange={(m) => {
                setCsrAvgResponseTime(m.avgResponseTime);
                setCsrAvgQuotationHT(m.avgQuotationHT);
                setCsrAvgNonQuotationHT(m.avgNonQuotationHT);
              }}
            />
          </div>

          {/* Row 3 — Lists & Map */}
          <div className="grid grid-cols-1 gap-4">
            <OutboundCallsCard
              history={filteredActivities}
              loading={loadingActivities}
              error={errorActivities}
              dateCreatedFilterRange={toStrictRange(dateCreatedFilterRange)}
            />
            <QuotationCard {...cardProps} dateRange={dateCreatedFilterRange} />
            <SOCard {...cardProps} dateRange={dateCreatedFilterRange} />
            <SiteVisitCard
              referenceid={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          </div>
        </div>
      </SidebarInset>

      <SidebarRight
        dateCreatedFilterRange={dateCreatedFilterRange}
        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
      />
    </ProtectedPageWrapper>
  );
}

/* ================= PAGE ================= */

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