"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import { type DateRange } from "react-day-picker";

import { LeadsTable } from "@/components/roles/tsa/accounts/leads/table";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account {
  id: string;
  referenceid: string;
  company_name: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  contact_person: string | string[];
  contact_number: string | string[];
  email_address: string | string[];
  address: string;
  delivery_address: string;
  region: string;
  industry: string;
  status?: string;
  company_group: string;
  next_available_date: string;
  tin_number?: string;
  account_reference_number: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

// ─── Dashboard Content ────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });

  const [posts, setPosts] = useState<Account[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const { dateRange: dateCreatedFilterRange, setDateRange } = useGlobalDate();

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL → UserContext
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // Fetch user details
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
        });
        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 4000, position: "top-right", fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      })
      .catch(() => {
        sileo.error({
          title: "Failed",
          description: "Failed to connect to server. Please try again later.",
          duration: 4000, position: "top-right", fill: "black",
          styles: { title: "text-white!", description: "text-white" },
        });
      })
      .finally(() => setLoadingUser(false));
  }, [userId]);

  // Fetch inactive (leads) accounts
  const fetchAccounts = useCallback(async () => {
    if (!userDetails.referenceid) { setPosts([]); return; }
    setLoadingAccounts(true);
    try {
      const res = await fetch(`/api/com-fetch-leads-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      setPosts(data.data || []);
    } catch {
      sileo.error({
        title: "Failed",
        description: "Failed to load inactive accounts.",
        duration: 4000, position: "top-right", fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [userDetails.referenceid]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const loading = loadingUser || loadingAccounts;

  // Optional: client-side date filter
  const filteredData = useMemo(() => {
    if (!dateCreatedFilterRange?.from || !dateCreatedFilterRange?.to) return posts;
    const from = new Date(dateCreatedFilterRange.from).setHours(0, 0, 0, 0);
    const to   = new Date(dateCreatedFilterRange.to).setHours(23, 59, 59, 999);
    return posts.filter((item) => {
      const d = new Date(item.date_created).getTime();
      return d >= from && d <= to;
    });
  }, [posts, dateCreatedFilterRange]);

  // Normalize array fields
  const normalizedPosts = filteredData.map((post) => ({
    ...post,
    contact_person: Array.isArray(post.contact_person)
      ? post.contact_person.join(", ") : post.contact_person,
    contact_number: Array.isArray(post.contact_number)
      ? post.contact_number.join(", ") : post.contact_number,
    email_address: Array.isArray(post.email_address)
      ? post.email_address.join(", ") : post.email_address,
  }));

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        <GlobalTopBar title="Inactive Accounts" />

        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Spinner className="size-10" />
            </div>
          ) : (
            <LeadsTable
              posts={normalizedPosts}
              userDetails={userDetails}
              dateCreatedFilterRange={dateCreatedFilterRange}
              setDateCreatedFilterRangeAction={setDateRange as any}
              onRefreshAccountsAction={fetchAccounts}
            />
          )}
        </main>
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
