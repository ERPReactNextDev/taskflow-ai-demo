"use client";

import React, { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";

import { sileo, Toaster } from "sileo";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";

// Popups
import { Reminders } from "@/components/popup/reminders";
import { TransferAlertDialog } from "@/components/popup/transfer";
import { ApproveDeletionDialog } from "@/components/popup/deletion";
import { ApproveTransferDialog } from "@/components/popup/approval-transferred";
import { RemoveDeletionDialog } from "@/components/popup/approval-deletion";
import { TicketEndorsed } from "@/components/popup/ticket-endorsed";
import { ActivityToday } from "@/components/popup/activity-today";
import { FollowUpToday } from "@/components/popup/followup-today";
import { OfflineDialog } from "@/components/popup/offline";
import { MaintenanceDialog } from "@/components/popup/maintenance";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { QuotationNotificationProvider } from "@/contexts/QuotationNotificationContext";
import { GlobalDateProvider } from "@/contexts/GlobalDateContext";
import { ActiveModuleProvider } from "@/contexts/ActiveModuleContext";

// ─── Dynamic Page Titles ──────────────────────────────────────────────────────

const getPageTitle = (pathname: string): string => {
  if (!pathname) return "Taskflow";
  
  // Extract meaningful parts from URL
  const parts = pathname.split('/').filter(Boolean);
  
  // Build title from path segments
  const segments: string[] = [];
  
  for (const part of parts) {
    switch (part) {
      case 'roles':
        continue; // Skip 'roles' segment
      case 'tsa':
        segments.push('TSA');
        break;
      case 'tsm':
        segments.push('TSM');
        break;
      case 'manager':
        segments.push('Manager');
        break;
      case 'admin':
        segments.push('Admin');
        break;
      case 'csr':
        segments.push('CSR');
        break;
      case 'activity':
        segments.push('Activity');
        break;
      case 'planner':
        segments.push('Planner');
        break;
      case 'reports':
        segments.push('Reports');
        break;
      case 'companies':
        segments.push('Companies');
        break;
      case 'dashboard':
        segments.push('Dashboard');
        break;
      case 'sales-performance':
        segments.push('Sales Performance');
        break;
      case 'quotation':
        segments.push('Quotation');
        break;
      case 'pending':
        segments.push('Pending');
        break;
      case 'approved':
      case 'approval':
        segments.push('Approved');
        break;
      case 'declined':
        segments.push('Declined');
        break;
      case 'all':
        segments.push('All');
        break;
      case 'general':
        segments.push('Settings');
        break;
      case 'security':
        segments.push('Security');
        break;
      case 'calendar':
        segments.push('Calendar');
        break;
      default:
        // Capitalize and format other segments
        segments.push(part.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    }
  }
  
  if (segments.length === 0) return "Taskflow";
  
  return `${segments.join(' - ')} | Taskflow`;
};

function DynamicTitle() {
  const pathname = usePathname();
  
  useEffect(() => {
    const title = getPageTitle(pathname || '');
    document.title = title;
  }, [pathname]);
  
  return null;
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();

  return (
    <>
      <DynamicTitle />
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Suspense fallback={null}>
          {userId && (
            <>
              <Reminders />
              <TransferAlertDialog />
              <ApproveDeletionDialog />
              <ApproveTransferDialog />
              <RemoveDeletionDialog />
              <TicketEndorsed />
              <ActivityToday />
              <FollowUpToday />
            </>
          )}
        </Suspense>
        <Analytics />
        {children}
        <OfflineDialog />
        <MaintenanceDialog />
      </ThemeProvider>

      <Toaster position="top-right" />
      
    </>
  );
}

export default function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <GlobalDateProvider>
        <ActiveModuleProvider>
          <NotificationProvider>
            <QuotationNotificationProvider>
              <LayoutContent>{children}</LayoutContent>
            </QuotationNotificationProvider>
          </NotificationProvider>
        </ActiveModuleProvider>
      </GlobalDateProvider>
    </UserProvider>
  );
}
