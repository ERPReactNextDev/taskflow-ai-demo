"use client";

import React, { Suspense } from "react";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ModuleRedirectPage } from "@/components/module-redirect-page";
import { FIELD_ATTENDANCE_CONFIG } from "@/lib/module-configs";

function PageContent() {
  return (
    <ModuleRedirectPage
      config={FIELD_ATTENDANCE_CONFIG}
      pageTitle="Field Attendance Log"
      fallbackUrl="/general/acculog"
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
