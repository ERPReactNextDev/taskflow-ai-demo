"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { sileo } from "sileo";

import { RevisedQuotation } from "@/components/roles/tsa/activity/quotation/revised-quotation";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

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

function DashboardContent() {
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

  const queryUserId = searchParams?.get("id") ?? "";

  // Sync URL query param with userId context
  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  // Fetch user details when userId changes
  useEffect(() => {
    // ✅ Guard: skip fetch if userId is not ready yet
    if (!userId) {
      setLoadingUser(false);
      return;
    }

    const fetchUserData = async () => {
      setError(null);
      setLoadingUser(true);
      try {
        const response = await fetch(
          `/api/user?id=${encodeURIComponent(userId)}`,
        );
        if (!response.ok) throw new Error("Failed to fetch user data");
        const data = await response.json();

        // Check if managername is empty OR if it looks like an ID (e.g. contains dashes/numbers)
        let finalManagerName = data.ManagerName || "";
        const looksLikeId = (val: string) =>
          /^[A-Z0-9-]+$/.test(val) && val.includes("-");

        if (
          (!finalManagerName || looksLikeId(finalManagerName)) &&
          data.Manager
        ) {
          try {
            const mRes = await fetch(
              `/api/user?id=${encodeURIComponent(data.Manager)}`,
            );
            if (mRes.ok) {
              const mData = await mRes.json();
              const resolvedName =
                `${mData.Firstname ?? ""} ${mData.Lastname ?? ""}`.trim();
              if (resolvedName) {
                finalManagerName = resolvedName;
              }
            }
          } catch (e) {
            console.error("Failed to fetch manager name:", e);
          }
        }

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
          managername: finalManagerName || "",
          signature: data.signatureImage || "",
          managerDetails: data.managerDetails || null,
          tsmDetails: data.tsmDetails || null,
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
        setError("Failed to fetch user data");
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
          description:
            "Failed to connect to server. Please try again later or refresh your network connection",
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

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">

        <GlobalTopBar title="Quotations" />

        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
          <div>
            {userDetails.referenceid ? (
              <RevisedQuotation
                referenceid={userDetails.referenceid}
                firstname={userDetails.firstname}
                lastname={userDetails.lastname}
                email={userDetails.email}
                contact={userDetails.contact}
                tsmname={userDetails.tsmname}
                managername={userDetails.managername}
                target_quota={userDetails.target_quota}
                signature={userDetails.signature}
                managerDetails={userDetails.managerDetails}
                tsmDetails={userDetails.tsmDetails}
                dateCreatedFilterRange={dateCreatedFilterRange}
                setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction as any}
              />
            ) : loadingUser ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                Loading user data...
              </div>
            ) : null}
          </div>
        </main>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

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