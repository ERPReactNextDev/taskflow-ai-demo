"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { sileo } from "sileo";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";

/**
 * EngineeringPortalContent
 * * Provides a full-screen "System-within-a-System" portal for Engiconnect.
 * Optimized for Sales users to book and track engineering services.
 */
function EngineeringPortalContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const [portalLoading, setPortalLoading] = useState(true);

  const queryUserId = searchParams?.get("id") ?? "";

  // 1. Sync User Session from Login/URL
  useEffect(() => {
    const storedId = localStorage.getItem("userId");
    if (queryUserId) {
      setUserId(queryUserId);
    } else if (storedId) {
      setUserId(storedId);
    }
  }, [queryUserId, setUserId]);

  // 2. Portal Handshake Notification
  useEffect(() => {
    if (userId) {
      sileo.success({
        title: "Engiconnect Portal Active",
        description: "Synchronizing engineering workspace...",
        duration: 2000,
        position: "top-right",
      });
    }
  }, [userId]);

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="flex flex-col h-screen overflow-hidden bg-white">
        {/* SHARED HEADER - No Right Sidebar Trigger */}

        <GlobalTopBar title="Engiconnect Protocol" />

        {/* ENGICONNECT CORE PORTAL - FULL WIDTH WORKSPACE */}
        <main className="flex-1 relative bg-slate-50">
          {portalLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-50">
              <div className="animate-spin h-10 w-10 border-4 border-[#E33636] border-t-transparent rounded-full mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E33636]">
                Secure System Handshake
              </p>
            </div>
          )}

          {/* The Iframe allows Sales users to use the established Engiconnect 
            process flows without leaving the Taskflow environment.
          */}
          <iframe
            src={`https://engiconnect.vercel.app/dashboard?userId=${userId}`}
            allow="geolocation; notifications"
            className="w-full h-full border-none shadow-inner"
            title="Engiconnect Portal"
            onLoad={() => setPortalLoading(false)}
          />
        </main>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

export default function EngineeringPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={
            <div className="flex h-screen items-center justify-center bg-white">
              <div className="animate-pulse font-black text-[#E33636] uppercase tracking-widest">
                Loading Portal...
              </div>
            </div>
          }>
            <EngineeringPortalContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}