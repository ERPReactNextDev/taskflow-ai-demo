"use client";

import React, { Suspense } from "react";
import { Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";//

// Lazy load the actual UnifiedNotificationBell
const UnifiedNotificationBell = React.lazy(() => 
  import("./unified-notification-bell").then(module => ({ default: module.UnifiedNotificationBell }))
);

// Loading placeholder component
function NotificationBellSkeleton() {
  return (
    <div className="flex items-center px-3">
      <div className="relative">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="absolute -top-1 -right-1 h-4 w-4 rounded-full" />
      </div>
    </div>
  );
}

// Lazy wrapper component
export function UnifiedNotificationBellLazy() {
  return (
    <Suspense fallback={<NotificationBellSkeleton />}>
      <UnifiedNotificationBell />
    </Suspense>
  );
}
