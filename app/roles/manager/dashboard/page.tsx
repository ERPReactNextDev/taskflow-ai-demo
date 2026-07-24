"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Settings, X } from "lucide-react";
import { sileo } from "sileo";
import { useUser } from "@/contexts/UserContext";
import { useSearchParams } from "next/navigation";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ── Manager-native summary cards ─────────────────────────────────────────────
import { ManagerRunningTargetCard } from "@/components/roles/manager/dashboard/card/running-target";
import { ManagerRunningSiCard } from "@/components/roles/manager/dashboard/card/running-si";
import { ManagerRunningSoCard } from "@/components/roles/manager/dashboard/card/running-so";
import { ManagerOutboundTouchbaseCountCard } from "@/components/roles/manager/dashboard/card/outbound-touchbase-count";
import { ManagerKpiWeightedScores } from "@/components/roles/manager/dashboard/card/kpi-weighted-scores";
import { ManagerSalesPipelineCard } from "@/components/roles/manager/dashboard/card/sales-pipeline";
import { ManagerMonthlySiTrendCard } from "@/components/roles/manager/dashboard/card/monthly-si-trend";
import { ManagerAgentPerformanceDetail } from "@/components/roles/manager/dashboard/card/agent-performance-detail";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDetails {
  referenceid: string;
  firstname: string;
  lastname: string;
}

// ─── Card visibility ──────────────────────────────────────────────────────────

const VISIBILITY_KEY = "manager_dashboard_visibility";

interface CardVisibility {
  summaryCards: boolean;
  kpiScores:    boolean;
  pipeline:     boolean;
  siTrend:      boolean;
  agentDetail:  boolean;
}

const DEFAULT_VISIBILITY: CardVisibility = {
  summaryCards: true,
  kpiScores:    true,
  pipeline:     true,
  siTrend:      true,
  agentDetail:  true,
};

const CARD_LABELS: Record<keyof CardVisibility, string> = {
  summaryCards: "Summary Cards (Target, SI, SO, OB Calls)",
  kpiScores:    "KPI Weighted Scores — Team View",
  pipeline:     "Sales Pipeline — Conversion Metrics",
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

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// ─── Dashboard Content ────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", firstname: "", lastname: "",
  });

  // ── Date range — defaults to today ───────────────────────────────────────────
  const todayStart = () => new Date(new Date().setHours(0, 0, 0, 0));
  const todayEnd   = () => new Date(new Date().setHours(23, 59, 59, 999));

  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    useState<DateRange | undefined>({
      from: todayStart(),
      to:   todayEnd(),
    });

  useEffect(() => {
    if (!dateCreatedFilterRange) {
      setDateCreatedFilterRangeAction({ from: todayStart(), to: todayEnd() });
    }
  }, [dateCreatedFilterRange]);

  // ── Settings ─────────────────────────────────────────────────────────────────
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

  // ── User fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.ReferenceID) {
          setUserDetails({
            referenceid: d.ReferenceID || "",
            firstname:   d.Firstname   || "",
            lastname:    d.Lastname    || "",
          });
        }
      })
      .catch(() => sileo.error({ title: "Error", description: "Failed to load user.", duration: 4000, position: "top-center" }));
  }, [userId]);

  // ── Sales Quota (manager-level) — always current month ───────────────────────
  const [salesQuotaTotal,   setSalesQuotaTotal]   = useState<number>(0);
  const [loadingSalesQuota, setLoadingSalesQuota] = useState(false);

  const fetchSalesQuota = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setSalesQuotaTotal(0); return; }
    setLoadingSalesQuota(true);
    try {
      const refDate = dateCreatedFilterRange?.from ?? new Date();
      const year    = refDate.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);
      const month   = refDate.toLocaleDateString("en-US", { month: "long", timeZone: "Asia/Manila" });
      const res     = await fetch(
        `/api/manager-sales-quota?manager=${encodeURIComponent(referenceid)}&year=${year}&month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSalesQuotaTotal(Number(data.total) || 0);
    } catch { /* silent */ } finally { setLoadingSalesQuota(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchSalesQuota(); }, [fetchSalesQuota]);

  // ── History SI / SO — uses date range if set, otherwise current month ─────────
  const [totalActualSales, setTotalActualSales] = useState<number>(0);
  const [totalSoAmount,    setTotalSoAmount]    = useState<number>(0);
  const [totalSoRegular,   setTotalSoRegular]   = useState<number>(0);
  const [totalSoSPF,       setTotalSoSPF]       = useState<number>(0);
  const [loadingHistory,   setLoadingHistory]   = useState(false);

  const fetchHistory = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) { setTotalActualSales(0); setTotalSoAmount(0); return; }
    setLoadingHistory(true);
    try {
      let fromStr: string;
      let toStr: string;

      if (dateCreatedFilterRange?.from && dateCreatedFilterRange?.to) {
        fromStr = toDateStr(dateCreatedFilterRange.from);
        toStr   = toDateStr(dateCreatedFilterRange.to);
      } else {
        const manilaToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
        const [mYear, mMonth] = manilaToday.split("-");
        const monthDays = new Date(Number(mYear), Number(mMonth), 0).getDate();
        fromStr = `${mYear}-${mMonth}-01`;
        toStr   = `${mYear}-${mMonth}-${String(monthDays).padStart(2, "0")}`;
      }

      const [siRes, soRes] = await Promise.all([
        fetch(`/api/manager-history-si?manager=${encodeURIComponent(referenceid)}&from=${fromStr}&to=${toStr}`),
        fetch(`/api/manager-history-so?manager=${encodeURIComponent(referenceid)}&from=${fromStr}&to=${toStr}`),
      ]);
      const siData = await siRes.json();
      const soData = await soRes.json();
      setTotalActualSales(Number(siData.total)      || 0);
      setTotalSoAmount(Number(soData.total)         || 0);
      setTotalSoRegular(Number(soData.totalRegular) || 0);
      setTotalSoSPF(Number(soData.totalSPF)         || 0);
    } catch { /* silent */ } finally { setLoadingHistory(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── OB Calls (manager-level) ──────────────────────────────────────────────────
  const [outboundCallsCount,   setOutboundCallsCount]   = useState<number>(0);
  const [loadingOutboundCalls, setLoadingOutboundCalls] = useState(false);

  const fetchOutbound = useCallback(async () => {
    const { referenceid } = userDetails;
    if (!referenceid) return;
    setLoadingOutboundCalls(true);
    try {
      const dateParams = new URLSearchParams();
      if (dateCreatedFilterRange?.from) dateParams.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   dateParams.append("to",   toDateStr(dateCreatedFilterRange.to));
      const dateSuffix = dateParams.toString() ? `&${dateParams}` : "";

      const res  = await fetch(`/api/manager-history-outbound?manager=${encodeURIComponent(referenceid)}${dateSuffix}`);
      const data = await res.json();
      // Only Successful calls count toward OB target
      setOutboundCallsCount(Number(data.successful) || 0);
    } catch { /* silent */ } finally { setLoadingOutboundCalls(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchOutbound(); }, [fetchOutbound]);

  // ── Pipeline (manager-level) ─────────────────────────────────────────────────
  const [quotesCount,             setQuotesCount]             = useState<number>(0);
  const [callsToQuotesCount,      setCallsToQuotesCount]      = useState<number>(0);
  const [quoteToSOQuotationCount, setQuoteToSOQuotationCount] = useState<number>(0);
  const [quoteToSOSalesOrderCount,setQuoteToSOSalesOrderCount]= useState<number>(0);
  const [soToSISalesOrderCount,   setSoToSISalesOrderCount]   = useState<number>(0);
  const [soToSIDeliveredCount,    setSoToSIDeliveredCount]    = useState<number>(0);
  const [newAccountCount,         setNewAccountCount]         = useState<number>(0);
  const [newAccountTarget,        setNewAccountTarget]        = useState<number>(0);
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
      const mBase = `manager=${encodeURIComponent(referenceid)}`;

      const [quotesRes, c2qRes, q2soRes, soToSiRes, naCountRes, naTargetRes] = await Promise.all([
        fetch(`/api/manager-history-quotations?${mBase}${dateSuffix}`),
        fetch(`/api/manager-history-calls-to-quotes?${mBase}${dateSuffix}`),
        fetch(`/api/manager-history-quote-to-so?${mBase}${dateSuffix}`),
        fetch(`/api/manager-history-so-to-si?${mBase}${dateSuffix}`),
        fetch(`/api/manager-account-development-plans?${mBase}${dateSuffix}`),
        fetch(`/api/manager-new-account-development?${mBase}${dateSuffix}`),
      ]);
      const [quotesData, c2qData, q2soData, soToSiData, naCountData, naTargetData] = await Promise.all([
        quotesRes.json(), c2qRes.json(), q2soRes.json(),
        soToSiRes.json(), naCountRes.json(), naTargetRes.json(),
      ]);

      setQuotesCount(Number(quotesData.count)                   || 0);
      setCallsToQuotesCount(Number(c2qData.count)               || 0);
      setQuoteToSOQuotationCount(Number(q2soData.quoteToSOQuotationCount)   || 0);
      setQuoteToSOSalesOrderCount(Number(q2soData.quoteToSOSalesOrderCount) || 0);
      setSoToSISalesOrderCount(Number(soToSiData.soToSISalesOrderCount)     || 0);
      setSoToSIDeliveredCount(Number(soToSiData.soToSIDeliveredCount)       || 0);
      setNewAccountCount(Number(naCountData.count)              || 0);
      setNewAccountTarget(Number(naTargetData.target)           || 0);
    } catch { /* silent */ } finally { setLoadingPipeline(false); }
  }, [userDetails.referenceid, dateCreatedFilterRange]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // ── Render ────────────────────────────────────────────────────────────────────

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
              <ManagerRunningTargetCard
                referenceid={userDetails.referenceid}
                total={salesQuotaTotal}
                loading={loadingSalesQuota}
                userId={queryUserId}
              />
              <ManagerRunningSiCard
                referenceid={userDetails.referenceid}
                targetTotal={salesQuotaTotal}
                total={totalActualSales}
                loading={loadingHistory}
                userId={queryUserId}
              />
              <ManagerRunningSoCard
                referenceid={userDetails.referenceid}
                targetTotal={salesQuotaTotal}
                total={totalSoAmount}
                totalRegular={totalSoRegular}
                totalSPF={totalSoSPF}
                loading={loadingHistory}
                userId={queryUserId}
              />
              <ManagerOutboundTouchbaseCountCard
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
            <ManagerKpiWeightedScores
              manager={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
            />
          )}

          {/* Sales Pipeline — Conversion Metrics */}
          {visibility.pipeline && (
            <ManagerSalesPipelineCard
              manager={userDetails.referenceid}
              dateRange={dateCreatedFilterRange}
              obCallsCount={outboundCallsCount}
              loadingObCalls={loadingOutboundCalls}
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
          )}

          {/* Monthly SI Trend — Team Total */}
          {visibility.siTrend && userDetails.referenceid && (
            <ManagerMonthlySiTrendCard
              manager={userDetails.referenceid}
            />
          )}

          {/* Agent Performance Detail — Team View */}
          {visibility.agentDetail && userDetails.referenceid && (
            <ManagerAgentPerformanceDetail
              manager={userDetails.referenceid}
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
