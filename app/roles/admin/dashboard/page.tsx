"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { type DateRange } from "react-day-picker";

import { AdminRunningTargetCard } from "@/components/roles/admin/dashboard/card/running-target";
import { AdminRunningSiCard } from "@/components/roles/admin/dashboard/card/running-si";
import { AdminRunningSoCard } from "@/components/roles/admin/dashboard/card/running-so";
import { AdminOutboundTouchbaseCountCard } from "@/components/roles/admin/dashboard/card/outbound-touchbase-count";
import { AdminKpiWeightedScores } from "@/components/roles/admin/dashboard/card/kpi-weighted-scores";
import { AdminSalesPipelineCard } from "@/components/roles/admin/dashboard/card/sales-pipeline";
import { AdminMonthlySiTrendCard } from "@/components/roles/admin/dashboard/card/monthly-si-trend";
import { AdminAgentPerformanceDetail } from "@/components/roles/admin/dashboard/card/agent-performance-detail";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

// ─── Dashboard Content ────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";

  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = React.useState<
    DateRange | undefined
  >(undefined);

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // ── Sales Quota — system-wide ─────────────────────────────────────────────
  const [salesQuotaTotal,   setSalesQuotaTotal]   = useState<number>(0);
  const [agentCount,        setAgentCount]        = useState<number>(0);
  const [loadingSalesQuota, setLoadingSalesQuota] = useState(false);

  const MONTH_NAMES = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  const fetchSalesQuota = useCallback(async () => {
    setLoadingSalesQuota(true);
    try {
      const refDate = dateCreatedFilterRange?.from
        ? new Date(dateCreatedFilterRange.from)
        : new Date();
      const year  = refDate.getFullYear().toString();
      const month = MONTH_NAMES[refDate.getMonth()];
      const res   = await fetch(`/api/admin-sales-quota?year=${year}&month=${month}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSalesQuotaTotal(Number(data.total)      || 0);
      setAgentCount(     Number(data.agentCount) || 0);
    } catch { /* silent */ } finally { setLoadingSalesQuota(false); }
  }, [dateCreatedFilterRange]);

  useEffect(() => { fetchSalesQuota(); }, [fetchSalesQuota]);

  // ── SI Actual — system-wide ───────────────────────────────────────────────
  const [totalActualSales, setTotalActualSales] = useState<number>(0);
  const [loadingSi,        setLoadingSi]        = useState(false);

  const fetchSi = useCallback(async () => {
    setLoadingSi(true);
    try {
      const params = new URLSearchParams();
      if (dateCreatedFilterRange?.from) params.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   params.append("to",   toDateStr(dateCreatedFilterRange.to));
      const suffix = params.toString() ? `?${params}` : "";
      const res  = await fetch(`/api/admin-history-si${suffix}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTotalActualSales(Number(data.total) || 0);
    } catch { /* silent */ } finally { setLoadingSi(false); }
  }, [dateCreatedFilterRange]);

  useEffect(() => { fetchSi(); }, [fetchSi]);

  // ── SO Actual — system-wide ───────────────────────────────────────────────
  const [totalSoAmount,  setTotalSoAmount]  = useState<number>(0);
  const [totalSoRegular, setTotalSoRegular] = useState<number>(0);
  const [totalSoSPF,     setTotalSoSPF]     = useState<number>(0);
  const [loadingSo,      setLoadingSo]      = useState(false);

  const fetchSo = useCallback(async () => {
    setLoadingSo(true);
    try {
      const params = new URLSearchParams();
      if (dateCreatedFilterRange?.from) params.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   params.append("to",   toDateStr(dateCreatedFilterRange.to));
      const suffix = params.toString() ? `?${params}` : "";
      const res  = await fetch(`/api/admin-history-so${suffix}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTotalSoAmount( Number(data.total)        || 0);
      setTotalSoRegular(Number(data.totalRegular) || 0);
      setTotalSoSPF(    Number(data.totalSPF)     || 0);
    } catch { /* silent */ } finally { setLoadingSo(false); }
  }, [dateCreatedFilterRange]);

  useEffect(() => { fetchSo(); }, [fetchSo]);

  // ── OB Calls — system-wide ────────────────────────────────────────────────
  const [outboundCallsCount,   setOutboundCallsCount]   = useState<number>(0);
  const [loadingOutboundCalls, setLoadingOutboundCalls] = useState(false);

  const fetchOutbound = useCallback(async () => {
    setLoadingOutboundCalls(true);
    try {
      const params = new URLSearchParams();
      if (dateCreatedFilterRange?.from) params.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   params.append("to",   toDateStr(dateCreatedFilterRange.to));
      const suffix = params.toString() ? `?${params}` : "";
      const res  = await fetch(`/api/admin-history-outbound${suffix}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Only Successful calls count
      setOutboundCallsCount(Number(data.successful) || 0);
    } catch { /* silent */ } finally { setLoadingOutboundCalls(false); }
  }, [dateCreatedFilterRange]);

  useEffect(() => { fetchOutbound(); }, [fetchOutbound]);

  // ── Pipeline — system-wide ────────────────────────────────────────────────
  const [quotesCount,              setQuotesCount]              = useState<number>(0);
  const [callsToQuotesCount,       setCallsToQuotesCount]       = useState<number>(0);
  const [quoteToSOQuotationCount,  setQuoteToSOQuotationCount]  = useState<number>(0);
  const [quoteToSOSalesOrderCount, setQuoteToSOSalesOrderCount] = useState<number>(0);
  const [soToSISalesOrderCount,    setSoToSISalesOrderCount]    = useState<number>(0);
  const [soToSIDeliveredCount,     setSoToSIDeliveredCount]     = useState<number>(0);
  const [loadingPipeline,          setLoadingPipeline]          = useState(false);

  const fetchPipeline = useCallback(async () => {
    setLoadingPipeline(true);
    try {
      const params = new URLSearchParams();
      if (dateCreatedFilterRange?.from) params.append("from", toDateStr(dateCreatedFilterRange.from));
      if (dateCreatedFilterRange?.to)   params.append("to",   toDateStr(dateCreatedFilterRange.to));
      const suffix = params.toString() ? `?${params}` : "";
      const res  = await fetch(`/api/admin-pipeline${suffix}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotesCount(             Number(data.quotesCount)              || 0);
      setCallsToQuotesCount(      Number(data.callsToQuotesCount)       || 0);
      setQuoteToSOQuotationCount( Number(data.quoteToSOQuotationCount)  || 0);
      setQuoteToSOSalesOrderCount(Number(data.quoteToSOSalesOrderCount) || 0);
      setSoToSISalesOrderCount(   Number(data.soToSISalesOrderCount)    || 0);
      setSoToSIDeliveredCount(    Number(data.soToSIDeliveredCount)     || 0);
    } catch { /* silent */ } finally { setLoadingPipeline(false); }
  }, [dateCreatedFilterRange]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                    Admin Dashboard
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <AdminRunningTargetCard
              total={salesQuotaTotal}
              agentCount={agentCount}
              loading={loadingSalesQuota}
            />
            <AdminRunningSiCard
              targetTotal={salesQuotaTotal}
              total={totalActualSales}
              loading={loadingSi}
            />
            <AdminRunningSoCard
              targetTotal={salesQuotaTotal}
              total={totalSoAmount}
              totalRegular={totalSoRegular}
              totalSPF={totalSoSPF}
              loading={loadingSo}
            />
            <AdminOutboundTouchbaseCountCard
              count={outboundCallsCount}
              loading={loadingOutboundCalls}
              dateRange={dateCreatedFilterRange}
            />
          </div>

          {/* KPI Weighted Scores — select a manager */}
          <AdminKpiWeightedScores dateRange={dateCreatedFilterRange} />

          {/* Sales Pipeline — Conversion Metrics */}
          <AdminSalesPipelineCard
            obCallsCount={outboundCallsCount}
            loadingObCalls={loadingOutboundCalls}
            quotesCount={quotesCount}
            loadingQuotes={loadingPipeline}
            callsToQuotesCount={callsToQuotesCount}
            quoteToSOQuotationCount={quoteToSOQuotationCount}
            quoteToSOSalesOrderCount={quoteToSOSalesOrderCount}
            soToSISalesOrderCount={soToSISalesOrderCount}
            soToSIDeliveredCount={soToSIDeliveredCount}
            loadingPipeline={loadingPipeline}
          />

          {/* Monthly SI Trend — System-wide */}
          <AdminMonthlySiTrendCard />

          {/* Agent Performance Detail — select a manager */}
          <AdminAgentPerformanceDetail dateRange={dateCreatedFilterRange} />
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
