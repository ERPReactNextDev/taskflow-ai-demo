"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { AllActivities } from "@/components/roles/tsa/activity/planner/all/all";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import {
  Loader2, Calendar, List, ChevronDown, ChevronRight,
} from "lucide-react";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface SupervisorDetails {
  firstname: string;
  lastname: string;
  email: string;
  profilePicture: string;
  signatureImage: string;
  contact: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
  target_quota: string;
  firstname: string;
  lastname: string;
  email: string;
  contact: string;
  tsmname: string;
  managername: string;
  signature: string;
  managerDetails: SupervisorDetails | null;
  tsmDetails: SupervisorDetails | null;
}

// ─── Collapsible Card ─────────────────────────────────────────────────────────

function PlannerCard({
  title,
  icon,
  count,
  isOpen,
  onToggle,
  countColor = "text-blue-600",
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
        className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 p-0"
          }`}
      >
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function AllActivitiesContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
    target_quota: "",
    firstname: "",
    lastname: "",
    email: "",
    contact: "",
    tsmname: "",
    managername: "",
    signature: "",
    managerDetails: null,
    tsmDetails: null,
  });

  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  const [isOpen, setIsOpen] = useState(true);
  const [allActivitiesCount, setAllActivitiesCount] = useState(0);

  const queryUserId = searchParams?.get("id") ?? "";

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
      sileo.error({
        title: "Connection Error",
        description: "Unable to retrieve user details. Please check your connection.",
        duration: 4000,
        position: "top-center",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" }
      });
    } finally {
      setLoadingUser(false);
    }
  }, [userId]);

  useEffect(() => { fetchUserData(); }, [fetchUserData]);

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
  };

  return (
    <SidebarProvider>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="Activity Planners" />

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
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
              <div className="grid grid-cols-1 gap-4">
                {/* ── All Activities (full width) ── */}
                <PlannerCard
                  title="All Activities"
                  icon={<List className="w-4 h-4" />}
                  count={allActivitiesCount}
                  isOpen={isOpen}
                  onToggle={() => setIsOpen(!isOpen)}
                  countColor="text-blue-600"
                >
                  <AllActivities {...sharedProps} tsm={userDetails.tsm} onCountChange={setAllActivitiesCount} />
                </PlannerCard>
              </div>
            )}
          </main>
        </SidebarInset>
      </ProtectedPageWrapper>
    </SidebarProvider>
  );
}

// ─── Wrapper with Providers ───────────────────────────────────────────────────

function AllActivitiesPageContent() {
  return (
    <UserProvider>
      <FormatProvider>
        <AllActivitiesContent />
      </FormatProvider>
    </UserProvider>
  );
}

export default function AllActivitiesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <p className="text-xs text-zinc-500 animate-pulse font-mono uppercase tracking-widest">
            Loading...
          </p>
        </div>
      </div>
    }>
      <AllActivitiesPageContent />
    </Suspense>
  );
}
