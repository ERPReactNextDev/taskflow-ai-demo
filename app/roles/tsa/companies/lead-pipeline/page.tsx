"use client";

import React, { Suspense, useEffect, useRef } from "react";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";
import { GlobalTopBar } from "@/components/global-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { PipelineBoard } from "@/components/roles/tsa/lead-conversion/pipeline-board";
import { Loader2 } from "lucide-react";

// ─── Auto-runs conversion engine every 5 minutes ─────────────────────────────

function ConversionPoller({ referenceid }: { referenceid: string }) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!referenceid) return;

    const run = () => {
      fetch("/api/lead-conversion/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceid }),
      }).catch(() => {});
    };

    // Run immediately on mount
    run();

    // Then every 5 minutes
    intervalRef.current = setInterval(run, 5 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [referenceid]);

  return null;
}

// ─── Page Content ─────────────────────────────────────────────────────────────

function PageContent() {
  const { user } = useUser();
  const referenceid = (user as any)?.ReferenceID ?? "";

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />
      <SidebarInset className="overflow-hidden">
        <GlobalTopBar title="Lead Pipeline" />

        {/* Conversion engine poller — runs silently in background */}
        {referenceid && <ConversionPoller referenceid={referenceid} />}

        <main className="flex flex-1 flex-col gap-4 p-4 overflow-hidden h-[calc(100vh-3.5rem)]">
          {!referenceid ? (
            <div className="flex items-center justify-center h-full gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading user data...</span>
            </div>
          ) : (
            <PipelineBoard referenceid={referenceid} />
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
          <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading...</div>}>
            <PageContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}
