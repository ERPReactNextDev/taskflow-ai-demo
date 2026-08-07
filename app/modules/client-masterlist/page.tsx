"use client";

import React, { Suspense } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ModuleRedirectPage } from "@/components/module-redirect-page";
import { CLIENT_MASTERLIST_CONFIG } from "@/lib/module-configs";

function PageContent() {
  return (
    <ModuleRedirectPage
      config={CLIENT_MASTERLIST_CONFIG}
      pageTitle="Client Masterlist"
      fallbackUrl="/roles/tsa/companies/active"
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
