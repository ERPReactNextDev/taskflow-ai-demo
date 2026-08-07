"use client";

import React, { Suspense } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ModuleRedirectPage } from "@/components/module-redirect-page";
import { SALES_CALL_LEADERBOARD_CONFIG } from "@/lib/module-configs";

function PageContent() {
  return (
    <ModuleRedirectPage
      config={SALES_CALL_LEADERBOARD_CONFIG}
      pageTitle="Sales Call Leaderboard"
      fallbackUrl="/roles/tsa/national-call-ranking"
    />
  );
}

export default function Page() {
  return (
    <UserProvider>
      <FormatProvider>
        <NotificationProvider>
          <Suspense fallback={null}>
            <PageContent />
          </Suspense>
        </NotificationProvider>
      </FormatProvider>
    </UserProvider>
  );
}
