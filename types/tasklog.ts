/** Canonical TaskLog row — matches Supabase tasklog table columns exactly */
export interface TaskLogRow {
  id?: string | number;
  ReferenceID: string;
  Email?: string;
  Type: string;                     // Activity type
  Status: string;                   // Attendance status
  Remarks?: string | null;
  TSM?: string | null;              // Sales owner / agent
  Manager?: string | null;
  SiteVisitAccount?: string | null; // Client/company name
  Location?: string | null;
  Latitude?: string | number | null;
  Longitude?: string | number | null;
  PhotoURL?: string | null;         // Check-in photo
  SitePhotoURL?: string | null;     // Check-out photo
  date_created: string;             // Check-in timestamp
  updatedAt?: string | null;        // Check-out timestamp
  account_reference_number?: string | null;
}

/** Runtime-computed fields added by the read query */
export interface TaskLogComputed extends TaskLogRow {
  duration_minutes?: number | null;           // computed from date_created → updatedAt
  distance_from_site_meters?: number | null;  // GPS distance vs registered site
  is_within_allowed_radius?: boolean;         // distance <= 100m
  linked_meeting_id?: number | null;
  linked_client_id?: string | null;
  linked_lead_id?: string | null;
}

// ─── Allowed values ───────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  "Client Site Visit",
  "Initial Prospect Visit",
  "Quotation Presentation",
  "Contract Signing",
  "Payment Collection",
  "Site Inspection",
  "Delivery Verification",
  "Team Field Huddle",
  "Other",
] as const;

export const ATTENDANCE_STATUSES = [
  "Checked In",
  "Checked Out",
  "Late Check-In",
  "Early Check-Out",
  "Off-Site",
  "No Show",
  "Missed Visit",
  "Invalid GPS",
] as const;

export type ActivityType = typeof ACTIVITY_TYPES[number];
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];

// ─── Status colors ────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Checked In":     { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  "Checked Out":    { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500" },
  "Late Check-In":  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500" },
  "Early Check-Out":{ bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200",  dot: "bg-orange-500" },
  "Off-Site":       { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500" },
  "No Show":        { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-400" },
  "Missed Visit":   { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     dot: "bg-red-400" },
  "Invalid GPS":    { bg: "bg-gray-100",   text: "text-gray-600",    border: "border-gray-200",    dot: "bg-gray-400" },
  // Legacy values from existing data
  "Login":          { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  "Logout":         { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500" },
};

export const VIOLATION_STATUSES = ["Off-Site", "Invalid GPS", "Late Check-In", "Missed Visit", "Early Check-Out", "No Show"];

// ─── Manila timezone helpers ──────────────────────────────────────────────────

export const MANILA = "Asia/Manila";

export function fmtManila(isoStr: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString("en-PH", {
      timeZone: MANILA,
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      ...opts,
    });
  } catch { return isoStr; }
}

export function fmtManilaDate(isoStr: string): string {
  return fmtManila(isoStr, { month: "short", day: "numeric", year: "numeric" });
}

export function fmtManilaTime(isoStr: string): string {
  return fmtManila(isoStr, { hour: "numeric", minute: "2-digit", hour12: true });
}

export function todayManilaStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: MANILA }); // "2026-08-07"
}

export function computeDurationMinutes(checkIn: string, checkOut?: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return diff > 0 ? Math.round(diff / 60000) : null;
}
