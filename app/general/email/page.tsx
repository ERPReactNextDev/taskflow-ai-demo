"use client";

import React, { Suspense } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { ActiveModuleProvider } from "@/contexts/ActiveModuleContext";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { EmailShell } from "@/components/email/email-shell";
import { Loader2 } from "lucide-react";

export default function EmailPage() {
  return (
    <ActiveModuleProvider>
      <UserProvider>
        <FormatProvider>
          <SidebarProvider>
            <SidebarLeft />
            <SidebarInset className="overflow-hidden">
              <GlobalTopBar title="Email" hideSidebarTrigger={false} />
              <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>
                <Suspense fallback={
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                }>
                  <EmailShell />
                </Suspense>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </FormatProvider>
      </UserProvider>
    </ActiveModuleProvider>
  );
}
