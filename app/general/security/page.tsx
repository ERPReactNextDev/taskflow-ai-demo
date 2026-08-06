"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { useGlobalDate } from "@/contexts/GlobalDateContext";

import { SmartSidebarLeft as SidebarLeft } from "@/components/smart-sidebar-left";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";
import { GlobalTopBar } from "@/components/global-top-bar";

import {
  Laptop, Smartphone, Monitor, Globe, AlertCircle,
  ShieldAlert, Loader2, Inbox,
} from "lucide-react";
import { UAParser } from "ua-parser-js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityAlert {
  Email: string;
  ipAddress: string;
  deviceId: string;
  userAgent?: string;
  message: string;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

function getDeviceIcon(userAgent?: string) {
  if (!userAgent) return Monitor;
  const parser = new UAParser(userAgent);
  const type = parser.getDevice().type ?? "desktop";
  if (type === "mobile") return Smartphone;
  if (type === "tablet") return Laptop;
  return Monitor;
}

function getDeviceLabel(userAgent?: string): string {
  if (!userAgent) return "Desktop";
  const parser = new UAParser(userAgent);
  const type = parser.getDevice().type ?? "desktop";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getDeviceModel(userAgent?: string, deviceId?: string): string {
  if (!userAgent) return deviceId ? `Device: ${deviceId}` : "Unknown Device";
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();

  const model = device.model || "";
  const vendor = device.vendor || "";

  const deviceNameMap: Record<string, string> = {
    "iPhone15,2": "iPhone 14 Pro",
    "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone14,7": "iPhone 14",
    "iPhone14,8": "iPhone 14 Plus",
    "iPhone13,1": "iPhone 12 mini",
    "iPhone13,2": "iPhone 12",
    "iPhone13,3": "iPhone 12 Pro",
    "iPhone13,4": "iPhone 12 Pro Max",
    "iPhone12,1": "iPhone 11",
    "iPhone12,3": "iPhone 11 Pro",
    "iPhone12,5": "iPhone 11 Pro Max",
    "SM-G991B": "Samsung Galaxy S21",
    "SM-G996B": "Samsung Galaxy S21+",
    "SM-G998B": "Samsung Galaxy S21 Ultra",
    "SM-S901B": "Samsung Galaxy S22",
    "SM-S906B": "Samsung Galaxy S22+",
    "SM-S908B": "Samsung Galaxy S22 Ultra",
    "SM-S911B": "Samsung Galaxy S23",
    "SM-S916B": "Samsung Galaxy S23+",
    "SM-S918B": "Samsung Galaxy S23 Ultra",
    "SM-F711B": "Samsung Galaxy Z Flip 3",
    "SM-F721B": "Samsung Galaxy Z Flip 4",
    "SM-F926B": "Samsung Galaxy Z Fold 3",
    "SM-F936B": "Samsung Galaxy Z Fold 4",
    "iPad13,1": "iPad Air (5th gen)",
    "iPad13,2": "iPad Air (5th gen)",
    "iPad14,1": "iPad mini (6th gen)",
    "iPad14,2": "iPad mini (6th gen)",
    "iPad13,4": "iPad Pro 11-inch (3rd gen)",
    "iPad13,5": "iPad Pro 11-inch (3rd gen)",
    "iPad13,6": "iPad Pro 11-inch (3rd gen)",
    "iPad13,7": "iPad Pro 11-inch (3rd gen)",
    "iPad13,8": "iPad Pro 12.9-inch (5th gen)",
    "iPad13,9": "iPad Pro 12.9-inch (5th gen)",
    "iPad13,10": "iPad Pro 12.9-inch (5th gen)",
    "iPad13,11": "iPad Pro 12.9-inch (5th gen)",
  };

  const mappedName = deviceNameMap[model];
  if (mappedName) return mappedName;
  if (model && vendor) return `${vendor} ${model}`;
  if (model) return model;
  if (vendor) return vendor;

  const browser = parser.getBrowser();
  const os = parser.getOS();
  if (browser.name && os.name) return `${browser.name} on ${os.name}`;
  if (browser.name) return browser.name;
  if (os.name) return os.name;
  if (deviceId) return `Device: ${deviceId}`;
  return "Unknown Device";
}

// ─── Section card ─────────────────────────────────────────────────────────────

const SectionCard = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
    <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
      <div className="mt-0.5 p-1.5 bg-gray-900 text-white">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-800">
          {title}
        </h2>
        {description && (
          <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ─── Alert row ────────────────────────────────────────────────────────────────

const AlertRow = ({ alert, index, tableStyles }: {
  alert: SecurityAlert;
  index: number;
  tableStyles: Record<string, string>;
}) => {
  const DeviceIcon = getDeviceIcon(alert.userAgent);
  const deviceLabel = getDeviceLabel(alert.userAgent);
  const deviceModel = getDeviceModel(alert.userAgent, alert.deviceId);

  const tdStyle: React.CSSProperties = {
    color: tableStyles.td_text,
    fontSize: `${tableStyles.td_font_size}px`,
    padding: `${tableStyles.td_padding}px 12px`,
    borderColor: tableStyles.td_border,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
  };

  return (
    <tr
      style={{ borderColor: tableStyles.tr_border, backgroundColor: tableStyles.table_bg }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.tr_hover_bg; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = tableStyles.table_bg; }}
    >
      <td style={tdStyle}>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="font-mono text-[11px]">{alert.Email}</span>
        </div>
      </td>
      <td style={tdStyle}>
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-mono text-[11px]">{alert.ipAddress || "—"}</span>
        </div>
      </td>
      <td style={tdStyle}>
        <div className="flex items-center gap-2">
          <DeviceIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-[11px] font-bold uppercase">{deviceLabel}</p>
            <p className="text-[10px] font-semibold truncate max-w-[120px]">{deviceModel}</p>
            <p className="text-[9px] font-mono truncate max-w-[120px] opacity-60">{alert.deviceId || "—"}</p>
          </div>
        </div>
      </td>
      <td style={tdStyle}>
        <span className="inline-block bg-red-50 border border-red-100 text-red-700 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide max-w-[200px] truncate">
          {alert.message || "—"}
        </span>
      </td>
      <td style={tdStyle} className="whitespace-nowrap">
        <span className="text-[11px] font-mono">
          {new Date(alert.timestamp).toLocaleString("en-PH", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </td>
    </tr>
  );
};

// ─── Main content ─────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  const { dateRange: dateCreatedFilterRange, setDateRange: setDateCreatedFilterRangeAction } = useGlobalDate();

  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [page, setPage] = useState(1);

  const [tableStyles, setTableStyles] = useState({
    table_bg: "#ffffff",
    table_border: "#111111",
    table_border_radius: "0",
    tr_border: "#d1d5db",
    tr_hover_bg: "#f3f4f6",
    th_bg: "#1f1f1f",
    th_text: "#ffffff",
    th_border: "#111111",
    th_padding: "14",
    th_font_size: "11",
    td_text: "#111827",
    td_border: "#e5e7eb",
    td_padding: "14",
    td_font_size: "12",
    tfoot_bg: "#1f1f1f",
    tfoot_text: "#ffffff",
    tfoot_border: "#111111",
    tfoot_padding: "12",
    tfoot_font_size: "12",
    toolbar_bg: "#1f1f1f",
    toolbar_border: "#111111",
    toolbar_btn_text: "#ffffff",
    toolbar_btn_border: "#3f3f3f",
    pagination_bg: "#1f1f1f",
    pagination_text: "#ffffff",
  });

  useEffect(() => {
    fetch("/api/table-styles")
      .then((res) => res.json())
      .then((data) => { if (data?.table_styles) setTableStyles(data.table_styles); })
      .catch(() => {});
  }, []);

  // ── Sync userId from URL ──────────────────────────────────────────────────

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // ── Fetch user email ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        setUserEmail(data.Email || "");
      } catch (err) {
        console.error("User fetch error:", err);
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, [userId]);

  // ── Fetch security alerts ─────────────────────────────────────────────────

  useEffect(() => {
    if (!userEmail) return;
    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const res = await fetch("/api/security-alerts");
        if (!res.ok) throw new Error("Failed to fetch alerts");
        const data: SecurityAlert[] = await res.json();
        const mine = (data || []).filter((a) => a.Email === userEmail);
        mine.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setSecurityAlerts(mine);
        setPage(1);
      } catch (err) {
        console.error("Security alerts fetch error:", err);
      } finally {
        setLoadingAlerts(false);
      }
    };
    fetchAlerts();
  }, [userEmail]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const pageCount = Math.ceil(securityAlerts.length / PAGE_SIZE);

  const paginated = useMemo(
    () => securityAlerts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [securityAlerts, page]
  );

  const isLoading = loadingUser || loadingAlerts;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />

      <SidebarInset>
        {/* Header */}
        <GlobalTopBar
          title="Security"
          rightExtra={
            securityAlerts.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-red-600 text-white px-2.5 py-1">
                <ShieldAlert className="w-3 h-3" />
                {securityAlerts.length} Alert{securityAlerts.length !== 1 ? "s" : ""}
              </span>
            ) : undefined
          }
        />

        {/* Content */}
        <div className="flex flex-col gap-5 p-5 w-full mx-auto">
          <SectionCard
            icon={ShieldAlert}
            title="Security Alerts"
            description="Recent login and access events associated with your account."
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Loading security data…</span>
              </div>
            ) : securityAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-300 gap-3">
                <Inbox className="w-10 h-10 opacity-40" />
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  No security alerts on record
                </p>
                <p className="text-[10px] text-gray-300">
                  Your account has no recent security events.
                </p>
              </div>
            ) : (
              <>
                {/* Record count */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {securityAlerts.length} record{securityAlerts.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-gray-300 font-mono">
                    Showing {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, securityAlerts.length)} of{" "}
                    {securityAlerts.length}
                  </span>
                </div>

                {/* Table */}
                <div
                  className="overflow-x-auto border"
                  style={{
                    borderColor: tableStyles.table_border,
                    borderRadius: `${tableStyles.table_border_radius}px`,
                  }}
                >
                  <table className="w-full border-collapse" style={{ backgroundColor: tableStyles.table_bg }}>
                    <thead>
                      <tr style={{ backgroundColor: tableStyles.th_bg }}>
                        {["Email", "IP Address", "Device Info", "Message", "Timestamp"].map((h) => (
                          <th
                            key={h}
                            className="text-left font-black uppercase tracking-widest"
                            style={{
                              color: tableStyles.th_text,
                              fontSize: `${tableStyles.th_font_size}px`,
                              padding: `${tableStyles.th_padding}px 12px`,
                              borderColor: tableStyles.th_border,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((alert, i) => (
                        <AlertRow
                          key={`${alert.timestamp}-${i}`}
                          alert={alert}
                          index={i}
                          tableStyles={tableStyles}
                        />
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: tableStyles.tfoot_bg, borderColor: tableStyles.tfoot_border }}>
                        <td
                          colSpan={5}
                          className="uppercase tracking-wider"
                          style={{
                            color: tableStyles.tfoot_text,
                            fontSize: `${tableStyles.tfoot_font_size}px`,
                            padding: `${tableStyles.tfoot_padding}px 12px`,
                          }}
                        >
                          {securityAlerts.length} alert{securityAlerts.length !== 1 ? "s" : ""} total
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pagination */}
                {pageCount > 1 && (
                  <div
                    className="flex items-center justify-center border-t"
                    style={{ backgroundColor: tableStyles.pagination_bg, borderColor: tableStyles.toolbar_border }}
                  >
                    <Pagination style={{ color: tableStyles.pagination_text, padding: `${tableStyles.tfoot_padding}px 12px` }}>
                      <PaginationContent className="flex items-center gap-4 justify-center text-xs">
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }}
                            aria-disabled={page === 1}
                            className={`rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all ${page === 1 ? "pointer-events-none opacity-30" : ""}`}
                          />
                        </PaginationItem>
                        <span
                          className="font-mono text-[11px] font-bold select-none px-3 py-1 border"
                          style={{ color: tableStyles.pagination_text, borderColor: tableStyles.toolbar_btn_border }}
                        >
                          {page} / {pageCount}
                        </span>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (page < pageCount) setPage(page + 1); }}
                            aria-disabled={page === pageCount}
                            className={`rounded-none h-8 px-3 text-[10px] font-bold uppercase tracking-widest transition-all ${page === pageCount ? "pointer-events-none opacity-30" : ""}`}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>
      </SidebarInset>
    </ProtectedPageWrapper>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            }
          >
            <SettingsContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}