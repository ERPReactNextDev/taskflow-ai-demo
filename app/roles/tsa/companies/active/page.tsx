"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { AccountsTable } from "@/components/roles/tsa/accounts/active/table/table";
import { type DateRange } from "react-day-picker";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

interface Account {
  id: string;
  referenceid: string;
  company_name: string;
  type_client: string;
  date_created: string;
  date_updated: string;
  tsm_remarks?: string;
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
  firstname?: string;
  lastname?: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const { dateRange: dateCreatedFilterRange, setDateRange } = useGlobalDate();

  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "",
    tsm: "",
    manager: "",
  });

  const [posts, setPosts] = useState<Account[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details when userId changes
  useEffect(() => {
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const response = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();

        setUserDetails({
          referenceid: data.ReferenceID || "",
          tsm: data.TSM || "",
          manager: data.Manager || "",
          firstname: data.FirstName || "",
          lastname: data.LastName || "",
        });

        sileo.success({
          title: "Success",
          description: "User data loaded successfully!",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
      } catch (err) {
        sileo.warning({
          title: "Failed",
          description: "Error fetching user data:",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        sileo.error({
          title: "Failed",
          description: "Failed to connect to server. Please try again later or refresh your network connection",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Fetch accounts when userDetails.referenceid changes
  useEffect(() => {
    if (!userDetails.referenceid) {
      setPosts([]);
      return;
    }

    const fetchAccounts = async () => {
      setError(null);
      setLoadingAccounts(true);
      try {
        const response = await fetch(
          `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`
        );
        if (!response.ok) throw new Error("Failed to fetch accounts");
        const data = await response.json();
        setPosts(data.data || []);
        // Removed toast here to avoid spam when just fetching accounts on load or refresh
      } catch (err) {
        sileo.warning({
          title: "Failed",
          description: "Error fetching user data:",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
        sileo.error({
          title: "Failed",
          description: "Failed to connect to server. Please try again later or refresh your network connection",
          duration: 4000,
          position: "top-right",
          fill: "black",
          styles: {
            title: "text-white!",
            description: "text-white",
          },
        });
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, [userDetails.referenceid]);

  const loading = loadingUser || loadingAccounts;

  // Filter accounts by created date range
  const filteredData = useMemo(() => {
    if (
      !dateCreatedFilterRange ||
      !dateCreatedFilterRange.from ||
      !dateCreatedFilterRange.to
    ) {
      return posts;
    }

    const fromTime = dateCreatedFilterRange.from.setHours(0, 0, 0, 0);
    const toTime = dateCreatedFilterRange.to.setHours(23, 59, 59, 999);

    return posts.filter((item) => {
      const createdDate = new Date(item.date_created).getTime();
      return createdDate >= fromTime && createdDate <= toTime;
    });
  }, [posts, dateCreatedFilterRange]);

  // Refresh accounts list from API
  async function refreshAccounts() {
    if (!userDetails.referenceid) return;
    try {
      setLoadingAccounts(true);
      const response = await fetch(
        `/api/com-fetch-cluster-account?referenceid=${encodeURIComponent(userDetails.referenceid)}`
      );
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setPosts(data.data || []);
    } catch (error) {
      sileo.error({
        title: "Failed",
        description: "Failed to connect to server. Please try again later or refresh your network connection",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    } finally {
      setLoadingAccounts(false);
    }
  }

  // Save account handler (for create & update)
  async function handleSaveAccount(data: Account & UserDetails, originalData?: Account) {
    const payload = {
      ...data,
      contact_person: Array.isArray(data.contact_person)
        ? data.contact_person
        : typeof data.contact_person === 'string'
          ? data.contact_person.split(',').map((v) => v.trim())
          : [],
      contact_number: Array.isArray(data.contact_number)
        ? data.contact_number
        : typeof data.contact_number === 'string'
          ? data.contact_number.split(',').map((v) => v.trim())
          : [],
      email_address: Array.isArray(data.email_address)
        ? data.email_address
        : typeof data.email_address === 'string'
          ? data.email_address.split(',').map((v) => v.trim())
          : [],
    };

    try {
      const isEdit = Boolean(payload.id);

      const url = isEdit ? "/api/com-edit-account" : "/api/com-save-account";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          date_updated: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error("Failed to save account");

      sileo.success({
        title: "Success",
        description: `Account ${isEdit ? "updated" : "created"} successfully!`,
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });

      // Refresh accounts after save to reflect latest data
      await refreshAccounts();
    } catch (error) {
      sileo.error({
        title: "Failed",
        description: "Failed to save account.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: {
          title: "text-white!",
          description: "text-white",
        },
      });
    }
  }

  const normalizedPosts = filteredData.map(post => ({
    ...post,
    contact_person: Array.isArray(post.contact_person)
      ? post.contact_person.join(", ")
      : post.contact_person,
    contact_number: Array.isArray(post.contact_number)
      ? post.contact_number.join(", ")
      : post.contact_number,
    email_address: Array.isArray(post.email_address)
      ? post.email_address.join(", ")
      : post.email_address,
  }));

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="Customer Database" />

          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <Spinner className="size-10" />
              </div>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}

                <AccountsTable
                  posts={normalizedPosts}
                  dateCreatedFilterRange={dateCreatedFilterRange}
                  setDateCreatedFilterRangeAction={setDateRange as any}
                  userDetails={userDetails}
                  onSaveAccountAction={handleSaveAccount}
                  onRefreshAccountsAction={refreshAccounts}
                />
              </>
            )}
          </main>
        </SidebarInset>
      </ProtectedPageWrapper>
    </>
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
