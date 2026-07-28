"use client";

import * as React from "react";
import { useUser } from "@/contexts/UserContext";
import { DatePicker } from "@/components/rightbar/date-picker";
import { NavUser } from "@/components/nav/user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { useFormat } from "@/contexts/FormatContext";
import { type DateRange } from "react-day-picker";
import { Menu, X } from "lucide-react";

import { Meeting } from "@/components/roles/tsa/activity/meeting/meeting";
import { BreachesDialog } from "@/components/popup/breaches";
import { BreachesTSMDialog } from "@/components/popup/breaches-tsm";
import { BreachesManagerDialog } from "@/components/popup/breaches-manager";
import { TimeLogComponent } from "@/components/roles/tsa/activity/timelog/logs";

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
};

type TimeLog = {
  Type: string;
  Status: string;
  date_created: string;
  Location: string;
  PhotoURL: string;
};

type UserDetails = {
  ReferenceID: string;
  TSM: string;
  Manager: string;
  Firstname: string;
  Lastname: string;
  Position: string;
  Email: string;
  profilePicture: string;
  Role: string;
};

const DEFAULT_USER: UserDetails = {
  ReferenceID: "",
  TSM: "",
  Manager: "",
  Firstname: "",
  Lastname: "",
  Position: "",
  Email: "",
  profilePicture: "",
  Role: "",
};

// ─── Clock helpers ────────────────────────────────────────────────────────────

function useFormattedClock(timeFormat: string, dateFormat: string) {
  const [time, setTime] = React.useState("");
  const [date, setDate] = React.useState("");

  React.useEffect(() => {
    const update = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: timeFormat === "12h",
        })
      );

      if (dateFormat === "short") {
        setDate(now.toLocaleDateString("en-US"));
      } else if (dateFormat === "iso") {
        setDate(now.toISOString().split("T")[0]);
      } else {
        setDate(
          now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        );
      }
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timeFormat, dateFormat]);

  return { time, date };
}

// ─── Shared sidebar content ───────────────────────────────────────────────────

interface SidebarInnerProps {
  navUser: {
    name: string;
    position: string;
    email: string;
    ReferenceID: string;
    TSM: string;
    Manager: string;
    avatar: string;
  };
  userId: string;
  dateCreatedFilterRange: DateRange | undefined;
  setDateCreatedFilterRangeAction: React.Dispatch<
    React.SetStateAction<DateRange | undefined>
  >;
  // FIX: use isTSA only — TSM and Manager must NOT see Meeting/TimeLog
  isTSA: boolean;
  userDetails: UserDetails;
  timeLogs: TimeLog[];
  loadingLogs: boolean;
  errorLogs: string | null;
  time: string;
  date: string;
  onClose?: () => void;
}

function SidebarInner({
  navUser,
  userId,
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  isTSA,
  userDetails,
  timeLogs,
  loadingLogs,
  errorLogs,
  time,
  date,
  onClose,
}: SidebarInnerProps) {
  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="border-b border-sidebar-border h-16 flex items-center justify-between px-3">
        <NavUser user={navUser} userId={userId} />
        {/* Close button — visible only on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <DatePicker
          selectedDateRange={dateCreatedFilterRange}
          onDateSelectAction={setDateCreatedFilterRangeAction}
          disableFuture={false}
        />

        <div className="mx-0 border-t border-sidebar-border" />

        {/* FIX: Only TSA sees Meeting and TimeLog */}
        {isTSA && (
          <Card className="rounded-none shadow-none border-0">
            <CardContent className="space-y-2 px-3 py-2">
              <Meeting
                referenceid={userDetails.ReferenceID}
                tsm={userDetails.TSM}
                manager={userDetails.Manager}
              />
              <TimeLogComponent
                timeLogs={timeLogs}
                loadingLogs={loadingLogs}
                errorLogs={errorLogs}
                dateCreatedFilterRange={dateCreatedFilterRange}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Footer clock ── */}
      <div className="border-t border-sidebar-border pt-2 pb-1 text-center select-none">
        <div className="text-xs font-mono font-semibold text-gray-700 tabular-nums tracking-tight">
          {time}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
          {date}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SidebarRight({
  dateCreatedFilterRange,
  setDateCreatedFilterRangeAction,
  ...props
}: SidebarRightProps) {
  const { userId } = useUser();
  
  // Remove userId from props if it exists to avoid React warning on DOM elements
  const sidebarProps = React.useMemo(() => {
    const { userId: _, ...rest } = props as any;
    return rest;
  }, [props]);

  const { timeFormat, dateFormat } = useFormat();
  const { time, date } = useFormattedClock(timeFormat, dateFormat);

  const [mobileOpen, setMobileOpen] = React.useState(false);

  const [userDetails, setUserDetails] = React.useState<UserDetails>(DEFAULT_USER);
  const [timeLogs, setTimeLogs] = React.useState<TimeLog[]>([]);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [errorLogs, setErrorLogs] = React.useState<string | null>(null);

  // ── Fetch user ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!userId) return;

    fetch(`/api/user?id=${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      })
      .then((data) =>
        setUserDetails({
          ReferenceID: data.ReferenceID || "",
          TSM: data.TSM || "",
          Manager: data.Manager || "",
          Firstname: data.Firstname || "",
          Lastname: data.Lastname || "",
          Position: data.Position || "",
          Email: data.Email || "",
          profilePicture: data.profilePicture || "",
          Role: data.Role || "",
        })
      )
      .catch((err) => console.error("User fetch error:", err));
  }, [userId]);

  // ── Fetch all time logs ─────────────────────────────────────────────────

  React.useEffect(() => {
    if (!userDetails.Email) {
      setTimeLogs([]);
      return;
    }

    setLoadingLogs(true);
    setErrorLogs(null);

    fetch(`/api/fetch-timelogs?Email=${encodeURIComponent(userDetails.Email)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch timelogs");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setTimeLogs(data.data);
        } else {
          setErrorLogs("Failed to fetch logs");
          setTimeLogs([]);
        }
      })
      .catch(() => {
        setErrorLogs("Error fetching logs");
        setTimeLogs([]);
      })
      .finally(() => setLoadingLogs(false));
  }, [userDetails.Email]);

  // ── Derived ─────────────────────────────────────────────────────────────

  // FIX: define each role cleanly — Meeting/TimeLog shown ONLY for TSA
  const isTSA     = userDetails.Role === "Territory Sales Associate";
  const isTSM     = userDetails.Role === "Territory Sales Manager";
  const isManager = userDetails.Role === "Manager";

  const navUser = {
    name: `${userDetails.Firstname} ${userDetails.Lastname}`.trim() || "Unknown User",
    position: userDetails.Position,
    email: userDetails.Email,
    ReferenceID: userDetails.ReferenceID,
    TSM: userDetails.TSM,
    Manager: userDetails.Manager,
    avatar: userDetails.profilePicture || "/avatars/shadcn.jpg",
  };

  const sharedProps = {
    navUser,
    userId: userId ?? "",
    dateCreatedFilterRange,
    setDateCreatedFilterRangeAction,
    isTSA,
    userDetails,
    timeLogs,
    loadingLogs,
    errorLogs,
    time,
    date,
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ════════════════════════════════════════════════
          DESKTOP — original sticky sidebar (lg and up)
      ════════════════════════════════════════════════ */}
      <Sidebar
        collapsible="none"
        className="sticky top-0 hidden h-svh border-l lg:flex"
        {...sidebarProps}
      >
        <SidebarHeader className="border-b border-sidebar-border h-16 flex items-center">
          <NavUser user={navUser} userId={userId ?? ""} />
        </SidebarHeader>

        <SidebarContent className="custom-scrollbar overflow-y-auto">
          <DatePicker
            selectedDateRange={dateCreatedFilterRange}
            onDateSelectAction={setDateCreatedFilterRangeAction}
            disableFuture={false}
          />

          <SidebarSeparator className="mx-0" />

          {/* FIX: Only TSA sees Meeting and TimeLog */}
          {isTSA && (
            <Card className="rounded-none shadow-none border-0">
              <CardContent className="space-y-2 px-3 py-2">
                <Meeting
                  referenceid={userDetails.ReferenceID}
                  tsm={userDetails.TSM}
                  manager={userDetails.Manager}
                />
                <TimeLogComponent
                  timeLogs={timeLogs}
                  loadingLogs={loadingLogs}
                  errorLogs={errorLogs}
                  dateCreatedFilterRange={dateCreatedFilterRange}
                />
              </CardContent>
            </Card>
          )}
        </SidebarContent>

        <SidebarFooter>
          <div className="border-t border-sidebar-border pt-2 pb-1 text-center select-none">
            <div className="text-xs font-mono font-semibold text-gray-700 tabular-nums tracking-tight">
              {time}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
              {date}
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* ════════════════════════════════════════════════
          MOBILE — hamburger button (hidden on lg+)
      ════════════════════════════════════════════════ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3.5 right-4 z-40 p-2 rounded-md bg-white border border-gray-200 shadow-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        aria-label="Open panel"
      >
        <Menu size={20} />
      </button>

      {/* ════════════════════════════════════════════════
          MOBILE — backdrop
      ════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ════════════════════════════════════════════════
          MOBILE — slide-in drawer from the right
      ════════════════════════════════════════════════ */}
      <div
        className={[
          "lg:hidden fixed top-0 right-0 z-50 h-full w-[85vw] max-w-sm",
          "bg-white border-l border-sidebar-border shadow-2xl",
          "transform transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-modal="true"
        role="dialog"
      >
        <SidebarInner
          {...sharedProps}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      {/* ── Floating breach dialogs (role-based) ── 
      {isTSA && <BreachesDialog />}
      {isTSM && <BreachesTSMDialog />}
      {isManager && <BreachesManagerDialog />}*/}
      
    </>
  );
}