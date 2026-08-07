/** Canonical Meeting type — single source of truth */
export interface Meeting {
  id: number | string;  // Supabase bigint may come as string for large values
  referenceid: string;
  tsm: string;
  manager: string;
  type_activity: string;           // "Client Meeting" | "Group Meeting" | "Internal Meeting" | "Demo"
  company_name: string | null;
  remarks: string | null;
  start_date: string;              // UTC ISO
  end_date: string;                // UTC ISO
  date_created: string;
  date_updated: string | null;
  // New fields (added by module build — backward-compatible)
  status: string | null;           // "Scheduled" | "Completed" | "No Show" | "Cancelled"
  outcome: string | null;
  outcome_notes: string | null;
  location: string | null;
  meeting_link: string | null;
  attendees: string | null;        // JSON string array or comma-separated
  follow_up_date: string | null;
  follow_up_notes: string | null;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  conversion_score_delta: number | null;
}

export type MeetingStatus = "Scheduled" | "Completed" | "No Show" | "Cancelled";

export type MeetingOutcome =
  | "Quotation Requested"
  | "Proposal Sent"
  | "Interested"
  | "No Decision"
  | "Closed Won"
  | "Not Interested"
  | "Rescheduled"
  | "Referred Lead"
  | "No Show";

export type MeetingType = "Client Meeting" | "Group Meeting" | "Internal Meeting" | "Demo";

export const MEETING_TYPES: MeetingType[] = [
  "Client Meeting", "Group Meeting", "Internal Meeting", "Demo",
];

export const MEETING_OUTCOMES: MeetingOutcome[] = [
  "Quotation Requested", "Proposal Sent", "Interested", "No Decision",
  "Closed Won", "Not Interested", "Rescheduled", "Referred Lead", "No Show",
];

export const OUTCOME_SCORE: Record<MeetingOutcome, number> = {
  "Quotation Requested": +15,
  "Proposal Sent":       +10,
  "Interested":          +8,
  "No Decision":          0,
  "Closed Won":          +40,
  "Not Interested":      -20,
  "Rescheduled":          -5,
  "Referred Lead":       +10,
  "No Show":              0,
};

export const TYPE_COLORS: Record<string, string> = {
  "Client Meeting":   "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Group Meeting":    "bg-violet-100 text-violet-700 border-violet-200",
  "Internal Meeting": "bg-gray-100 text-gray-700 border-gray-200",
  "Demo":             "bg-amber-100 text-amber-700 border-amber-200",
};

export const STATUS_COLORS: Record<string, string> = {
  "Scheduled":  "bg-blue-100 text-blue-700 border-blue-200",
  "Completed":  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "No Show":    "bg-red-100 text-red-700 border-red-200",
  "Cancelled":  "bg-gray-100 text-gray-500 border-gray-200",
};

/** Manila timezone helpers */
export const MANILA = "Asia/Manila";

export function toManila(isoStr: string): Date {
  // Returns a Date whose local getHours/getMinutes reflect Manila time
  // Used only for display — actual comparisons still use UTC
  return new Date(new Date(isoStr).toLocaleString("en-US", { timeZone: MANILA }));
}

export function fmtManila(
  isoStr: string,
  opts: Intl.DateTimeFormatOptions = {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }
): string {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString("en-US", { timeZone: MANILA, ...opts });
  } catch {
    return isoStr;
  }
}

export function fmtManilaDate(isoStr: string): string {
  return fmtManila(isoStr, { month: "short", day: "numeric", year: "numeric" });
}

export function fmtManilaTime(isoStr: string): string {
  return fmtManila(isoStr, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Convert datetime-local input (local time) → UTC ISO for Supabase */
export function localInputToUTC(localStr: string): string {
  if (!localStr) return "";
  const [datePart, timePart] = localStr.split("T");
  if (!datePart || !timePart) return "";
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  const local = new Date(y, m - 1, d, h, min, 0, 0);
  if (isNaN(local.getTime())) return "";
  // Subtract timezone offset to get UTC
  return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
}

/** Convert UTC ISO → datetime-local input value (Manila time) */
export function utcToManilaInput(isoStr: string): string {
  if (!isoStr) return "";
  const manila = new Date(
    new Date(isoStr).toLocaleString("en-US", { timeZone: MANILA })
  );
  if (isNaN(manila.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${manila.getFullYear()}-${pad(manila.getMonth() + 1)}-${pad(manila.getDate())}T${pad(manila.getHours())}:${pad(manila.getMinutes())}`;
}
