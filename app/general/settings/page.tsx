"use client";

import { useGlobalDate } from "@/contexts/GlobalDateContext";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider, useFormat } from "@/contexts/FormatContext";

import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { type DateRange } from "react-day-picker";

import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Palette, Clock3, Settings2 } from "lucide-react";

import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { GlobalTopBar } from "@/components/global-top-bar";

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 shrink-0">
          <Icon size={15} className="text-indigo-500" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {description && (
            <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {/* Section body */}
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {description && (
          <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();

  const queryUserId = searchParams?.get("id") ?? "";
  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) {
      setUserId(queryUserId);
    }
  }, [queryUserId, userId, setUserId]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { theme, setTheme } = useTheme();
  const { timeFormat, setTimeFormat, dateFormat, setDateFormat } = useFormat();

  const onTimeFormatChange = (val: string) => {
    setTimeFormat(val);
    toast.success(`Time format set to ${val === "12h" ? "12-Hour" : "24-Hour"}`);
  };

  const onDateFormatChange = (val: string) => {
    setDateFormat(val);
    toast.success("Date format updated");
  };

  const onThemeChange = (val: string) => {
    setTheme(val);
    toast.success("Theme updated");
  };

  if (!mounted) return null;

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />

      <SidebarInset>
        <GlobalTopBar title="Settings" />

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="mx-auto w-full max-w-2xl space-y-4">

            {/* Page title */}
            <div className="mb-2">
              <h1 className="text-lg font-bold text-slate-800">Preferences</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Customize your display and format settings.
              </p>
            </div>

            {/* Theme */}
            <SettingsSection
              icon={Palette}
              title="Appearance"
              description="Choose a theme that suits your workspace."
            >
              <SettingRow
                label="Theme"
                description="Applies to the entire interface"
              >
                <Select value={theme} onValueChange={onThemeChange}>
                  <SelectTrigger className="w-[200px] h-8 text-xs border-slate-200">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>

                  </SelectContent>
                </Select>
              </SettingRow>
            </SettingsSection>

            {/* Time & Date Format */}
            <SettingsSection
              icon={Clock3}
              title="Time & Date Format"
              description="Control how time and dates are displayed across the app."
            >
              <SettingRow
                label="Time Format"
                description="12-hour (AM/PM) or 24-hour clock"
              >
                <Select value={timeFormat} onValueChange={onTimeFormatChange}>
                  <SelectTrigger className="w-[200px] h-8 text-xs border-slate-200">
                    <SelectValue placeholder="Select time format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-Hour (AM/PM)</SelectItem>
                    <SelectItem value="24h">24-Hour</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator className="my-1" />

              <SettingRow
                label="Date Format"
                description="How dates appear throughout the app"
              >
                <Select value={dateFormat} onValueChange={onDateFormatChange}>
                  <SelectTrigger className="w-[200px] h-8 text-xs border-slate-200">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">MM/DD/YYYY</SelectItem>
                    <SelectItem value="long">Monday, November 11, 2025</SelectItem>
                    <SelectItem value="iso">2025-11-11</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </SettingsSection>

          </div>
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense fallback={<div />}>
            <SettingsContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}