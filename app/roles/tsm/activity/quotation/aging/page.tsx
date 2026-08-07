"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";
import { QuotationAging } from "@/components/roles/tsm/activity/quotation/aging/quotation-aging";
import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { UnifiedNotificationBellLazy } from "@/components/unified-notification-bell-lazy";

interface UserDetails {
  referenceid: string; tsm: string; manager: string; target_quota: string;
  firstname: string; lastname: string; email: string; contact: string;
  tsmname: string; managername: string; profilePicture: string; signature: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const [userDetails, setUserDetails] = useState<UserDetails>({
    referenceid: "", tsm: "", manager: "", target_quota: "",
    firstname: "", lastname: "", email: "", contact: "",
    tsmname: "", managername: "", profilePicture: "", signature: "",
  });
  const [loadingUser, setLoadingUser] = useState(true);
  const queryUserId = searchParams?.get("id") ?? "";

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  useEffect(() => {
    if (!userId) { setLoadingUser(false); return; }
    const fetchUserData = async () => {
      setLoadingUser(true);
      try {
        const res  = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        setUserDetails({
          referenceid: data.ReferenceID || "", tsm: data.TSM || "", manager: data.Manager || "",
          target_quota: data.TargetQuota || "", firstname: data.Firstname || "",
          lastname: data.Lastname || "", email: data.Email || "",
          contact: data.ContactNumber || "", tsmname: data.TSMName || "",
          managername: data.ManagerName || "", profilePicture: data.profilePicture || "",
          signature: data.signatureImage || "",
        });
        sileo.success({ title: "Success", description: "User data loaded successfully!", duration: 4000,
          position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } catch {
        sileo.error({ title: "Failed", description: "Failed to connect to server.", duration: 4000,
          position: "top-right", fill: "black", styles: { title: "text-white!", description: "text-white" } });
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [userId]);

  return (
    <>
      <ProtectedPageWrapper>
        <SidebarLeft />
        <SidebarInset className="overflow-hidden">

          <GlobalTopBar title="Quotation Aging Tracker" />
          <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">
            <Card className="rounded-none">
              <CardContent className="pt-4">
                {userDetails.referenceid && (
                  <QuotationAging
                    referenceid={userDetails.referenceid}
                    tsmname={userDetails.tsmname}
                  />
                )}
                {!userDetails.referenceid && !loadingUser && (
                  <p className="text-xs text-gray-400 text-center py-8">Loading user data…</p>
                )}
              </CardContent>
            </Card>
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
