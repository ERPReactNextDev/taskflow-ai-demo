"use client";

import React, { Suspense } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ModuleRedirectPage } from "@/components/module-redirect-page";
import { SYSTEM_SETTINGS_CONFIG } from "@/lib/module-configs";

function PageContent() {
  return (
    <ModuleRedirectPage
      config={SYSTEM_SETTINGS_CONFIG}
      pageTitle="System Settings"
      fallbackUrl="/general/settings"
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
