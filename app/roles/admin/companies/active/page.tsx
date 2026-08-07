"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { AccountsTable } from "@/components/roles/admin/accounts/table/all";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

interface Account {
  id: string;
  tsm: string;
  referenceid: string;
  company_name: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  region: string;
  industry: string;
  status?: string;
  company_group?: string;
}

interface UserDetails {
  referenceid: string;
  firstname: string;
  lastname: string;
  tsm: string;
  manager: string;
  profilepicture: string;
}

/* ─── Batched fetch ───────────────────────────────────────────────── */
const BATCH_SIZE = 5000;

async function fetchAllAccounts(): Promise<Account[]> {
  const all: Account[] = [];
  let offset = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    const url = `/api/com-fetch-account-admin?limit=${BATCH_SIZE}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

    const json = await res.json();
    let batch: Account[] = [];
    if (Array.isArray(json))            batch = json;
    else if (Array.isArray(json.data))  batch = json.data;
    else break;

    all.push(...batch);
    if (batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return all;
}

/* ─── Dashboard ───────────────────────────────────────────────────── */

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", firstname: "", lastname: "", tsm: "", manager: "", profilepicture: "",
  });
  const [posts,           setPosts]           = useState<Account[]>([]);
  const [loadingUser,     setLoadingUser]     = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  /* ── Fetch user ── */
  useEffect(() => {
    if (!userId) { setLoadingUser(false); return; }

    (async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        setUserDetails({
          referenceid:    data.ReferenceID   || "",
          firstname:      data.FirstName     || "",
          lastname:       data.LastName      || "",
          tsm:            data.TSM           || "",
          manager:        data.Manager       || "",
          profilepicture: data.profilePicture|| "",
        });
      } catch {
        sileo.error({
          title: "Failed",
          description: "Failed to connect to server. Please try again later.",
          duration: 4000, position: "top-right", fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } finally {
        setLoadingUser(false);
      }
    })();
  }, [userId]);

  /* ── Fetch ALL accounts ── */
  useEffect(() => {
    if (loadingUser) return;

    (async () => {
      setError(null);
      setLoadingAccounts(true);
      try {
        const all = await fetchAllAccounts();
        setPosts(all);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        sileo.error({
          title: "Failed",
          description: "Failed to load accounts.",
          duration: 4000, position: "top-right", fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      } finally {
        setLoadingAccounts(false);
      }
    })();
  }, [loadingUser]);

  // NOTE: Do NOT filter posts by date here.
  // All active accounts are always shown in the table.
  // The date range only affects activity counts (With/No Activities)
  // which is handled inside AccountsTable via /api/reports/tsm/fetch.

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        <GlobalTopBar title="Customer Database - All" />

        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          {(loadingUser || loadingAccounts) ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
              <Skeleton className="h-[400px] rounded-xl" />
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}
              {/* Pass dateCreatedFilterRange so AccountsTable can filter activities by date */}
              <AccountsTable
                posts={posts}
                userDetails={userDetails}
                dateCreatedFilterRange={dateCreatedFilterRange}
                setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
              />
            </>
          )}
        </main>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div />}>
            <DashboardContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}