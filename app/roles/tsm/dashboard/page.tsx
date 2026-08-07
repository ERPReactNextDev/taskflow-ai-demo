"use client";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Settings, X } from "lucide-react";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
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
import { SalesForecastCard } from "@/components/roles/tsm/dashboard/card/sales-forecast";
import { SiPacingCard } from "@/components/roles/tsm/dashboard/card/si-pacing";
import { FunnelLeakageHeatmap } from "@/components/roles/tsm/dashboard/card/funnel-leakage-heatmap";
import { AgentAttainmentRanking } from "@/components/roles/tsm/dashboard/card/agent-attainment-ranking";
import { SalesCycleTimeCard } from "@/components/roles/tsm/dashboard/card/sales-cycle-time";
import { ActivityEfficiencyScore } from "@/components/roles/tsm/dashboard/card/activity-efficiency-score";
import { WeeklyAgentTrend } from "@/components/roles/tsm/dashboard/card/weekly-agent-trend";
import { NewVsExistingRevenue } from "@/components/roles/tsm/dashboard/card/new-vs-existing-revenue";
import { WeightedPipelineCard } from "@/components/roles/tsm/dashboard/card/weighted-pipeline";
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
  summaryCards:        boolean;
  analyticsCards:      boolean;  // Pacing + Pipeline + Cycle Time + Forecast
  kpiScores:           boolean;
  attainmentRanking:   boolean;
  efficiencyScore:     boolean;
  siTrend:             boolean;
  weeklyTrend:         boolean;
  newVsExisting:       boolean;
  funnelHeatmap:       boolean;
  agentDetail:         boolean;
}

const DEFAULT_VISIBILITY: CardVisibility = {
  summaryCards:        true,
  analyticsCards:      false,  // hidden by default
  kpiScores:           true,
  attainmentRanking:   false,
  efficiencyScore:     false,
  siTrend:             true,
  weeklyTrend:         false,
  newVsExisting:       false,
  funnelHeatmap:       false,
  agentDetail:         true,
};

const CARD_LABELS: Record<keyof CardVisibility, string> = {
  summaryCards:        "Summary Cards (Target, SI, SO, OB Calls)",
  analyticsCards:      "Analytics Row (Pacing · Pipeline · Cycle Time · Forecast)",
  kpiScores:           "KPI Weighted Scores — Team View",
  attainmentRanking:   "Agent Attainment Ranking Board",
  efficiencyScore:     "Activity Efficiency Score",
  siTrend:             "Monthly SI Trend",
  weeklyTrend:         "Weekly Performance Trend",
  newVsExisting:       "New vs Existing Account Revenue",
  funnelHeatmap:       "Funnel Leakage Heatmap",
  agentDetail:         "Agent Performance Detail",
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
  try { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(v)); } catch { }
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
  const todayEnd = () => new Date(new Date().setHours(23, 59, 59, 999));

  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  const [visibility, setVisibility] = useState<CardVisibility>(DEFAULT_VISIBILITY);

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
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          target_quota: data.TargetQuota || "",
          firstname: data.Firstname || "",
          lastname: data.Lastname || "",
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
      const refDate = dateCreatedFilterRange?.from ?? new Date();
      const year = refDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);
      const month = refDate.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Manila" });
      const res = await fetch(
        `/api/sales-quota-tsm?tsm=${encodeURIComponent(referenceid)}&year=${year}&month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSalesQuotaTotal(Number(data.total) || 0);
    } catch { /* silent */ } finally { setLoadingSalesQuota(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchSalesQuota(); }, [fetchSalesQuota]);

  // ── History (SI / SO) — uses date range if set, otherwise current month ───────
  const [totalActualSales, setTotalActualSales] = useState<number>(0);
  const [totalSoAmount, setTotalSoAmount] = useState<number>(0);
  const [totalSoRegular, setTotalSoRegular] = useState<number>(0);
  const [totalSoSPF, setTotalSoSPF] = useState<number>(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setTotalActualSales(0); setTotalSoAmount(0); return; }
    setLoadingHistory(true);
    try {
      let fromStr: string;
      let toStr: string;

      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        // Use the selected range exactly for SO
        fromStr = toDateStr(dateCreatedFilterRange.from);
        toStr = toDateStr(dateCreatedFilterRange.to);
      } else {
        // Default: current calendar month in Manila time
        const manilaToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        const [mYear, mMonth] = manilaToday.split("-");
        const monthDays = new Date(Number(mYear), Number(mMonth), 0).getDate();
        fromStr = `${mYear}-${mMonth}-01`;
        toStr = `${mYear}-${mMonth}-${String(monthDays).padStart(2, "0")}`;
      }

      // SI follows the selected date range (same as SO)
      const [siRes, soRes] = await Promise.all([
        fetch(`/api/tsm-history-si?tsm=${encodeURIComponent(referenceid)}&from=${fromStr}&to=${toStr}`),
        fetch(`/api/tsm-history-so?tsm=${encodeURIComponent(referenceid)}&from=${fromStr}&to=${toStr}`),
      ]);
      const siData = await siRes.json();
      const soData = await soRes.json();
      setTotalActualSales(Number(siData.total) || 0);
      setTotalSoAmount(Number(soData.total) || 0);
      setTotalSoRegular(Number(soData.totalRegular) || 0);
      setTotalSoSPF(Number(soData.totalSPF) || 0);
    } catch { /* silent */ } finally { setLoadingHistory(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Agent Performance totals — populated by AgentPerformanceDetail.onTotalsReady ──
  const [agentPerfTotals, setAgentPerfTotals] = useState<{
    obCalls: number; obCallsTarget: number;
    callsToQuote: number;
    quoteToSOQuotation: number; quoteToSOSalesOrder: number;
    soToSISalesOrder: number; soToSIDelivered: number;
    quotesCount: number; quotesTarget: number;
    accountDevelopment: number; accountDevelopmentTarget: number;
  } | null>(null);

  // ── OB Calls — query by tsm column ───────────────────────────────────────────
  const [outboundCallsCount, setOutboundCallsCount] = useState<number>(0);
  const [outboundCallsTarget, setOutboundCallsTarget] = useState<number>(0);
  const [loadingOutboundCalls, setLoadingOutboundCalls] = useState(false);
  const [loadingOutboundCallsTarget, setLoadingOutboundCallsTarget] = useState(false);

  const fetchOutbound = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) return;
    setLoadingOutboundCalls(true);
    setLoadingOutboundCallsTarget(true);
    try {
      const dateParams = new URLSearchParams();
      if (dateCreatedFilterRange?.from) dateParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to) dateParams.append("to", toDateStr(dateCreatedFilterRange.to));
      const dateSuffix = dateParams.toString() ? `&${dateParams}` : "";

      const [countRes, targetRes] = await Promise.all([
        fetch(`/api/tsm-history-outbound?tsm=${encodeURIComponent(referenceid)}${dateSuffix}`),
        fetch(`/api/sales-ob?referenceid=${encodeURIComponent(referenceid)}${dateSuffix}`),
      ]);
      const countData = await countRes.json();
      const targetData = await targetRes.json();
      // Only Successful calls count toward OB target
      setOutboundCallsCount(Number(countData.successful) || 0);
      setOutboundCallsTarget(Number(targetData.target) || 0);
    } catch { /* silent */ } finally {
      setLoadingOutboundCalls(false);
      setLoadingOutboundCallsTarget(false);
    }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchOutbound(); }, [fetchOutbound]);

  // ── Pipeline (Quotes, Calls→Quote, Quote→SO, SO→SI, New Account) ────────────
  const [quotesCount, setQuotesCount] = useState<number>(0);
  const [quoteTarget, setQuoteTarget] = useState<number>(0);
  const [callsToQuotesCount, setCallsToQuotesCount] = useState<number>(0);
  const [quoteToSOQuotationCount, setQuoteToSOQuotationCount] = useState<number>(0);
  const [quoteToSOSalesOrderCount, setQuoteToSOSalesOrderCount] = useState<number>(0);
  const [soToSISalesOrderCount, setSoToSISalesOrderCount] = useState<number>(0);
  const [soToSIDeliveredCount, setSoToSIDeliveredCount] = useState<number>(0);
  const [newAccountCount, setNewAccountCount] = useState<number>(0);
  const [newAccountTarget, setNewAccountTarget] = useState<number>(2);
  const [loadingPipeline, setLoadingPipeline] = useState(false);

  const fetchPipeline = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) return;
    setLoadingPipeline(true);
    try {
      const dateParams = new URLSearchParams();
      if (dateCreatedFilterRange?.from) dateParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to) dateParams.append("to", toDateStr(dateCreatedFilterRange.to));
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

  // ── Refresh all ──────────────────────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleRefreshAll = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchSalesQuota(),
        fetchHistory(),
        fetchOutbound(),
        fetchPipeline(),
      ]);
      toast.success("Dashboard refreshed!");
    } catch {
      toast.error("Failed to refresh dashboard.");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, fetchSalesQuota, fetchHistory, fetchOutbound, fetchPipeline]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        {/* Header */}
        <GlobalTopBar
          title="KPI Dashboard"
          rightExtra={
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Refresh dashboard"
                title="Refresh all cards"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
                aria-label="Dashboard settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          }
        />

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
                dateRange={dateCreatedFilterRange}
              />
              <RunningSoCard
                referenceid={userDetails.referenceid}
                targetTotal={salesQuotaTotal}
                total={totalSoAmount}
                totalRegular={totalSoRegular}
                totalSPF={totalSoSPF}
                loading={loadingHistory}
                userId={queryUserId}
                dateRange={dateCreatedFilterRange}
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

          {/* KPI Weighted Scores — Team View */}
          {visibility.kpiScores && userDetails.referenceid && (
            <TsmKpiWeightedScores
              tsm={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          )}

          {/* Agent Performance Detail — Team View */}
          {visibility.agentDetail && userDetails.referenceid && (
            <AgentPerformanceDetail
              tsm={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
              onTotalsReady={setAgentPerfTotals}
            />
          )}

          <SalesPipelineCard
            tsm={userDetails.referenceid}
            dateRange={dateCreatedFilterRange}
            obCallsCount={agentPerfTotals?.obCalls ?? outboundCallsCount}
            obCallsTarget={agentPerfTotals?.obCallsTarget}
            loadingObCalls={loadingOutboundCalls}
            loadingObCallsTarget={loadingOutboundCallsTarget}
            quotesCount={agentPerfTotals?.quotesCount ?? quotesCount}
            quotesTarget={agentPerfTotals?.quotesTarget}
            loadingQuotes={loadingPipeline}
            callsToQuotesCount={agentPerfTotals?.callsToQuote ?? callsToQuotesCount}
            loadingCallsToQuotes={loadingPipeline}
            quoteToSOQuotationCount={agentPerfTotals?.quoteToSOQuotation ?? quoteToSOQuotationCount}
            quoteToSOSalesOrderCount={agentPerfTotals?.quoteToSOSalesOrder ?? quoteToSOSalesOrderCount}
            loadingQuoteToSO={loadingPipeline}
            soToSISalesOrderCount={agentPerfTotals?.soToSISalesOrder ?? soToSISalesOrderCount}
            soToSIDeliveredCount={agentPerfTotals?.soToSIDelivered ?? soToSIDeliveredCount}
            newAccountCount={agentPerfTotals?.accountDevelopment ?? newAccountCount}
            newAccountTarget={agentPerfTotals?.accountDevelopmentTarget ?? newAccountTarget}
            loadingNewAccount={loadingPipeline}
          />

           {/* Second row: Pacing + Pipeline + Forecast */}
          {visibility.analyticsCards && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SiPacingCard
                  monthlyTarget={salesQuotaTotal}
                  siActual={totalActualSales}
                  loading={loadingHistory || loadingSalesQuota}
                />
                <WeightedPipelineCard
                  monthlyTarget={salesQuotaTotal}
                  siActual={totalActualSales}
                  soActual={totalSoAmount}
                  funnelQuotesCount={callsToQuotesCount}
                  quoteToSOCount={quoteToSOSalesOrderCount}
                  soToSICount={soToSIDeliveredCount}
                  loading={loadingHistory || loadingPipeline || loadingSalesQuota}
                />
                <SalesCycleTimeCard
                  obCallsCount={outboundCallsCount}
                  funnelQuotes={callsToQuotesCount}
                  quoteToSOCount={quoteToSOSalesOrderCount}
                  soToSICount={soToSIDeliveredCount}
                  loading={loadingOutboundCalls || loadingPipeline}
                />
              </div>
              <SalesForecastCard
                monthlyTarget={salesQuotaTotal}
                siActual={totalActualSales}
                soActual={totalSoAmount}
                loading={loadingHistory || loadingSalesQuota}
              />
            </>
          )}

          {/* Agent Attainment Ranking Board */}
          {visibility.attainmentRanking && userDetails.referenceid && (
            <AgentAttainmentRanking
              tsm={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          )}

          {/* Activity Efficiency Score */}
          {visibility.efficiencyScore && userDetails.referenceid && (
            <ActivityEfficiencyScore
              tsm={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          )}
          

          {/* New vs Existing Account Revenue */}
          {visibility.newVsExisting && (
            <NewVsExistingRevenue
              totalSI={totalActualSales}
              totalSO={totalSoAmount}
              newAccountCount={newAccountCount}
              newAccountTarget={newAccountTarget || 1}
              loading={loadingHistory || loadingPipeline}
            />
          )}

          {/* Monthly SI Trend — Team Total */}
          {visibility.siTrend && userDetails.referenceid && (
            <MonthlySiTrendCard
              tsm={userDetails.referenceid}
            />
          )}

          {/* Weekly Agent Performance Trend */}
          {visibility.weeklyTrend && userDetails.referenceid && (
            <WeeklyAgentTrend
              tsm={userDetails.referenceid}
            />
          )}

          {/* Funnel Leakage Heatmap — Per-Agent Diagnostics */}
          {visibility.funnelHeatmap && userDetails.referenceid && (
            <FunnelLeakageHeatmap
              tsm={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          )}

        </div>

      </SidebarInset>
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