"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Settings, X } from "lucide-react";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ── Cards (same as TSA dashboard) ────────────────────────────────────────────
import { RunningTargetCard } from "@/components/roles/tsm/dashboard/card/running-target";
import { RunningSiCard } from "@/components/roles/tsm/dashboard/card/running-si";
import { RunningSoCard } from "@/components/roles/tsm/dashboard/card/running-so";
import { OutboundTouchbaseCountCard } from "@/components/roles/tsm/dashboard/card/outbound-touchbase-count";
import { SalesPipelineCard } from "@/components/roles/tsm/dashboard/card/sales-pipeline";
import { TsmKpiWeightedScores } from "@/components/roles/tsm/dashboard/card/kpi-weighted-scores";
import { MonthlySiTrendCard } from "@/components/roles/tsm/dashboard/card/monthly-si-trend";
import { AgentPerformanceDetail } from "@/components/roles/tsm/dashboard/card/agent-performance-detail";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  target_quota: string;
  firstname: string;
  lastname: string;
}

// ─── Card visibility ──────────────────────────────────────────────────────────

const VISIBILITY_KEY = "tsm_dashboard_visibility";

interface CardVisibility {
  summaryCards: boolean;
  kpiScores:    boolean;
  siTrend:      boolean;
  agentDetail:  boolean;
}

const DEFAULT_VISIBILITY: CardVisibility = {
  summaryCards: true,
  kpiScores:    true,
  siTrend:      true,
  agentDetail:  true,
};

const CARD_LABELS: Record<keyof CardVisibility, string> = {
  summaryCards: "Summary Cards (Target, SI, SO, OB Calls)",
  kpiScores:    "KPI Weighted Scores — Team View",
  siTrend:      "Monthly SI Trend",
  agentDetail:  "Agent Performance Detail",
};

function loadVisibility(): CardVisibility {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return { ...DEFAULT_VISIBILITY };
    return { ...DEFAULT_VISIBILITY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_VISIBILITY };
  }
}

function saveVisibility(v: CardVisibility) {
  try { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v)); } catch {}
}

/** Format a Date to YYYY-MM-DD for API params (Asia/Manila local time) */
function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// ─── Dashboard Content ────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", tsm: "", manager: "",
    target_quota: "", firstname: "", lastname: "",
  });
  const [loadingUser, setLoadingUser] = useState(true);

  // ── Date range — defaults to today, optional custom range ────────────────────
  const todayStart = () => new Date(new Date().setHours(0, 0, 0, 0));
  const todayEnd   = () => new Date(new Date().setHours(23, 59, 59, 999));

  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    React.useState<DateRange | undefined>({
      from: todayStart(),
      to:   todayEnd(),
    });

  // When the user clears the date picker, reset back to today instead of undefined
  useEffect(() => {
    if (!dateCreatedFilterRange) {
      setDateCreatedFilterRangeAction({
        from: todayStart(),
        to:   todayEnd(),
      });
    }
  }, [dateCreatedFilterRange]);

  // ── Settings ────────────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visibility, setVisibility]     = useState<CardVisibility>(DEFAULT_VISIBILITY);

  useEffect(() => { setVisibility(loadVisibility()); }, []);

  const toggleCard = (key: keyof CardVisibility) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVisibility(next);
      return next;
    });
  };

  // ── User fetch ───────────────────────────────────────────────────────────────
  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!userId) { setLoadingUser(false); return; }
    setLoadingUser(true);
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch user data");
        return res.json();
      })
      .then((data) => {
        setUserDetails({
          referenceid:  data.ReferenceID  || "",
          tsm:          data.TSM          || "",
          manager:      data.Manager      || "",
          target_quota: data.TargetQuota  || "",
          firstname:    data.Firstname    || "",
          lastname:     data.Lastname     || "",
        });
        toast.success("User data loaded successfully!");
      })
      .catch(() => toast.error("Failed to connect to server."))
      .finally(() => setLoadingUser(false));
  }, [userId]);

  // ── Sales Quota ──────────────────────────────────────────────────────────────
  const [salesQuotaTotal, setSalesQuotaTotal] = useState<number>(0);
  const [loadingSalesQuota, setLoadingSalesQuota] = useState(false);

  const fetchSalesQuota = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setSalesQuotaTotal(0); return; }
    setLoadingSalesQuota(true);
    try {
      // Use the year from the date range if set, otherwise current year
      const year = dateCreatedFilterRange?.from
        ? new Date(dateCreatedFilterRange.from).getFullYear().toString()
        : new Date().getFullYear().toString();
      const res = await fetch(`/api/sales-quota-tsm?tsm=${encodeURIComponent(referenceid)}&year=${year}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSalesQuotaTotal(Number(data.total) || 0);
    } catch { /* silent */ } finally { setLoadingSalesQuota(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchSalesQuota(); }, [fetchSalesQuota]);

  // ── History (SI / SO) — query by tsm column ──────────────────────────────────
  const [totalActualSales, setTotalActualSales] = useState<number>(0);
  const [totalSoAmount, setTotalSoAmount]       = useState<number>(0);
  const [totalSoRegular, setTotalSoRegular]     = useState<number>(0);
  const [totalSoSPF, setTotalSoSPF]             = useState<number>(0);
  const [loadingHistory, setLoadingHistory]     = useState(false);

  const fetchHistory = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setTotalActualSales(0); setTotalSoAmount(0); return; }
    setLoadingHistory(true);
    try {
      const dateParams = new URLSearchParams();
      if (dateCreatedFilterRange?.from) dateParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   dateParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const dateSuffix = dateParams.toString() ? `&${dateParams}` : "";

      const [siRes, soRes] = await Promise.all([
        fetch(`/api/tsm-history-si?tsm=${encodeURIComponent(referenceid)}${dateSuffix}`),
        fetch(`/api/tsm-history-so?tsm=${encodeURIComponent(referenceid)}${dateSuffix}`),
      ]);
      const siData = await siRes.json();
      const soData = await soRes.json();
      setTotalActualSales(Number(siData.total)       || 0);
      setTotalSoAmount(Number(soData.total)          || 0);
      setTotalSoRegular(Number(soData.totalRegular)  || 0);
      setTotalSoSPF(Number(soData.totalSPF)          || 0);
    } catch { /* silent */ } finally { setLoadingHistory(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── OB Calls — query by tsm column ───────────────────────────────────────────
  const [outboundCallsCount,  setOutboundCallsCount]  = useState<number>(0);
  const [outboundCallsTarget, setOutboundCallsTarget] = useState<number>(0);
  const [loadingOutboundCalls,       setLoadingOutboundCalls]       = useState(false);
  const [loadingOutboundCallsTarget, setLoadingOutboundCallsTarget] = useState(false);

  const fetchOutbound = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) return;
    setLoadingOutboundCalls(true);
    setLoadingOutboundCallsTarget(true);
    try {
      const dateParams = new URLSearchParams();
      if (dateCreatedFilterRange?.from) dateParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   dateParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const dateSuffix = dateParams.toString() ? `&${dateParams}` : "";

      const [countRes, targetRes] = await Promise.all([
        fetch(`/api/tsm-history-outbound?tsm=${encodeURIComponent(referenceid)}${dateSuffix}`),
        fetch(`/api/sales-ob?referenceid=${encodeURIComponent(referenceid)}${dateSuffix}`),
      ]);
      const countData  = await countRes.json();
      const targetData = await targetRes.json();
      setOutboundCallsCount(Number(countData.count)    || 0);
      setOutboundCallsTarget(Number(targetData.target) || 0);
    } catch { /* silent */ } finally {
      setLoadingOutboundCalls(false);
      setLoadingOutboundCallsTarget(false);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchOutbound(); }, [fetchOutbound]);

  // ── Pipeline (Quotes, Calls→Quote, Quote→SO, SO→SI, New Account) ────────────
  const [quotesCount,             setQuotesCount]             = useState<number>(0);
  const [quoteTarget, setQuoteTarget] = useState<number>(0);
  const [callsToQuotesCount,      setCallsToQuotesCount]      = useState<number>(0);
  const [quoteToSOQuotationCount, setQuoteToSOQuotationCount] = useState<number>(0);
  const [quoteToSOSalesOrderCount,setQuoteToSOSalesOrderCount]= useState<number>(0);
  const [soToSISalesOrderCount,   setSoToSISalesOrderCount]   = useState<number>(0);
  const [soToSIDeliveredCount,    setSoToSIDeliveredCount]    = useState<number>(0);
  const [newAccountCount,         setNewAccountCount]         = useState<number>(0);
  const [newAccountTarget,        setNewAccountTarget]        = useState<number>(2);
  const [loadingPipeline,         setLoadingPipeline]         = useState(false);

  const fetchPipeline = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) return;
    setLoadingPipeline(true);
    try {
      const dateParams = new URLSearchParams();
      if (dateCreatedFilterRange?.from) dateParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   dateParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const dateSuffix = dateParams.toString() ? `&${dateParams}` : "";
      const tsmBase = `tsm=${encodeURIComponent(referenceid)}`;

      const [quotesRes, callsToQuotesRes, quoteToSORes, soToSIRes, newAccCountRes, newAccTargetRes, quoteTargetRes] = await Promise.all([
        fetch(`/api/tsm-history-quotations?${tsmBase}${dateSuffix}`),
        fetch(`/api/tsm-history-calls-to-quotes?${tsmBase}${dateSuffix}`),
        fetch(`/api/tsm-history-quote-to-so?${tsmBase}${dateSuffix}`),
        fetch(`/api/tsm-history-so-to-si?${tsmBase}${dateSuffix}`),
        // actual count from account_development_plans — now uses date range filter
        fetch(`/api/tsm-account-development-plans?${tsmBase}${dateSuffix}`),
        // target from sales_account_development
        fetch(`/api/tsm-new-account-development?${tsmBase}${dateSuffix}`),
        // quotation target
        fetch(`/api/sales-quotation?referenceid=${encodeURIComponent(referenceid)}${dateSuffix}`),
      ]);

      const [quotesData, c2qData, q2soData, s2siData, newAccCountData, newAccTargetData, quoteTargetData] = await Promise.all([
        quotesRes.json(), callsToQuotesRes.json(), quoteToSORes.json(),
        soToSIRes.json(), newAccCountRes.json(), newAccTargetRes.json(), quoteTargetRes.json(),
      ]);

      setQuotesCount(Number(quotesData.count) || 0);
      setQuoteTarget(Number(quoteTargetData.quoteTarget) || 0);
      setCallsToQuotesCount(Number(c2qData.count) || 0);
      setQuoteToSOQuotationCount(Number(q2soData.quoteToSOQuotationCount) || 0);
      setQuoteToSOSalesOrderCount(Number(q2soData.quoteToSOSalesOrderCount) || 0);
      setSoToSISalesOrderCount(Number(s2siData.soToSISalesOrderCount) || 0);
      setSoToSIDeliveredCount(Number(s2siData.soToSIDeliveredCount) || 0);
      setNewAccountCount(Number(newAccCountData.count) || 0);
      setNewAccountTarget(Number(newAccTargetData.target) || 2);
    } catch { /* silent */ } finally { setLoadingPipeline(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        {/* Header */}
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
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
          <div className="flex items-center gap-2 px-3">
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              aria-label="Dashboard settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Settings panel */}
        {settingsOpen && (
          <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-black/20" onClick={() => setSettingsOpen(false)} />
            <div className="relative w-80 h-full bg-white shadow-2xl flex flex-col z-10">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-700">Dashboard Sections</span>
                </div>
                <button onClick={() => setSettingsOpen(false)} className="p-1 rounded hover:bg-gray-200 transition-colors">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
                  Toggle sections to show/hide
                </p>
                {(Object.keys(DEFAULT_VISIBILITY) as (keyof CardVisibility)[]).map((key) => (
                  <div key={key} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <Label htmlFor={`vis-${key}`} className="text-xs text-gray-700 cursor-pointer flex-1 pr-3">
                      {CARD_LABELS[key]}
                    </Label>
                    <Switch id={`vis-${key}`} checked={visibility[key]} onCheckedChange={() => toggleCard(key)} />
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-100">
                <button
                  onClick={() => { saveVisibility(DEFAULT_VISIBILITY); setVisibility({ ...DEFAULT_VISIBILITY }); }}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Reset to defaults
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col gap-4 p-4">
          {visibility.summaryCards && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <RunningTargetCard
                referenceid={userDetails.referenceid}
                total={salesQuotaTotal}
                loading={loadingSalesQuota}
                userId={queryUserId}
              />
              <RunningSiCard
                referenceid={userDetails.referenceid}
                targetTotal={salesQuotaTotal}
                total={totalActualSales}
                loading={loadingHistory}
                userId={queryUserId}
              />
              <RunningSoCard
                referenceid={userDetails.referenceid}
                targetTotal={salesQuotaTotal}
                total={totalSoAmount}
                totalRegular={totalSoRegular}
                totalSPF={totalSoSPF}
                loading={loadingHistory}
                userId={queryUserId}
              />
              <OutboundTouchbaseCountCard
                referenceid={userDetails.referenceid}
                count={outboundCallsCount}
                loading={loadingOutboundCalls}
                dateRange={dateCreatedFilterRange}
                userId={queryUserId}
              />
            </div>
          )}

          <SalesPipelineCard
            tsm={userDetails.referenceid}
            dateRange={dateCreatedFilterRange}
            obCallsCount={outboundCallsCount}
            loadingObCalls={loadingOutboundCalls}
            loadingObCallsTarget={loadingOutboundCallsTarget}
            quotesCount={quotesCount}
            loadingQuotes={loadingPipeline}
            callsToQuotesCount={callsToQuotesCount}
            loadingCallsToQuotes={loadingPipeline}
            quoteToSOQuotationCount={quoteToSOQuotationCount}
            quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
            loadingQuoteToSO={loadingPipeline}
            soToSISalesOrderCount={soToSISalesOrderCount}
            soToSIDeliveredCount={soToSIDeliveredCount}
            newAccountCount={newAccountCount}
            newAccountTarget={newAccountTarget}
            loadingNewAccount={loadingPipeline}
          />

          {/* Monthly SI Trend — Team Total */}
          {visibility.siTrend && userDetails.referenceid && (
            <MonthlySiTrendCard
              tsm={userDetails.referenceid}
            />
          )}

          {/* Agent Performance Detail — Team View */}
          {visibility.agentDetail && userDetails.referenceid && (
            <AgentPerformanceDetail
              tsm={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          )}

          {/* KPI Weighted Scores — Team View */}
          {visibility.kpiScores && userDetails.referenceid && (
            <TsmKpiWeightedScores
              tsm={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          )}

        </div>

      </SidebarInset>

      <SidebarRight
        dateCreatedFilterRange={dateCreatedFilterRange}
        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
      />
    </ProtectedPageWrapper>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
