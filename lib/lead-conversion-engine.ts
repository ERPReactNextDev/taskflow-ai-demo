/**
 * Lead-to-Client Conversion Engine
 * ─────────────────────────────────
 * Core business logic: reads history table (Supabase) and accounts table (Neon).
 * Runs conversion algorithm per account_reference_number.
 */

import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";

// ─── Clients ──────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

function getSql() {
  const url = process.env.TASKFLOW_DB_URL;
  if (!url) throw new Error("TASKFLOW_DB_URL is not set");
  return neon(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConversionStatus =
  | "NEW LEAD"           // 0%   — no activity
  | "PROSPECT"           // 10%  — has outbound call
  | "QUALIFIED PROSPECT" // 35%  — has quotation
  | "COMMITTED PROSPECT" // 75%  — has sales order
  | "OFFICIAL CLIENT";   // 100% — has closed/delivered transaction

export const STATUS_PROBABILITY: Record<ConversionStatus, number> = {
  "NEW LEAD":           0,
  "PROSPECT":           10,
  "QUALIFIED PROSPECT": 35,
  "COMMITTED PROSPECT": 75,
  "OFFICIAL CLIENT":    100,
};

export const STATUS_PIPELINE_STAGE: Record<ConversionStatus, string> = {
  "NEW LEAD":           "Unqualified",
  "PROSPECT":           "Lead Stage",
  "QUALIFIED PROSPECT": "Quote Sent",
  "COMMITTED PROSPECT": "Order Received",
  "OFFICIAL CLIENT":    "Closed / Won",
};

export interface ActivitySummary {
  account_reference_number: string;
  has_outbound: boolean;
  has_quote: boolean;
  has_so: boolean;
  has_closed: boolean;
  latest_outbound_at:  string | null;
  latest_quote_at:     string | null;
  latest_so_at:        string | null;
  latest_closed_at:    string | null;
}

export interface ConversionResult {
  account_reference_number: string;
  old_status: ConversionStatus | null;
  new_status: ConversionStatus;
  probability: number;
  pipeline_stage: string;
  flags: string[];
  changed: boolean;
}

// ─── Core: fetch activity summary from Supabase ───────────────────────────────

export async function getActivitySummary(
  account_reference_number: string
): Promise<ActivitySummary> {
  const { data, error } = await supabase
    .from("history")
    .select("type_activity, source, date_created")
    .eq("account_reference_number", account_reference_number)
    .order("date_created", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];

  let has_outbound = false, has_quote = false, has_so = false, has_closed = false;
  let latest_outbound_at = null, latest_quote_at = null;
  let latest_so_at = null, latest_closed_at = null;

  for (const row of rows) {
    if (row.source === "Outbound - Touchbase" || row.type_activity === "Outbound Calls") {
      has_outbound = true;
      latest_outbound_at = row.date_created;
    }
    if (row.type_activity === "Quotation Preparation") {
      has_quote = true;
      latest_quote_at = row.date_created;
    }
    if (row.type_activity === "Sales Order Preparation") {
      has_so = true;
      latest_so_at = row.date_created;
    }
    if (row.type_activity === "Delivered / Closed Transaction") {
      has_closed = true;
      latest_closed_at = row.date_created;
    }
  }

  return {
    account_reference_number,
    has_outbound, has_quote, has_so, has_closed,
    latest_outbound_at, latest_quote_at, latest_so_at, latest_closed_at,
  };
}

// ─── Core: determine new status ───────────────────────────────────────────────

export function determineStatus(summary: ActivitySummary): {
  status: ConversionStatus;
  flags: string[];
} {
  const flags: string[] = [];

  if (summary.has_closed) {
    if (!summary.has_so)    flags.push("Incomplete Activity History");
    return { status: "OFFICIAL CLIENT", flags };
  }

  if (summary.has_so) {
    if (!summary.has_quote) flags.push("Missing Quotation History");
    return { status: "COMMITTED PROSPECT", flags };
  }

  if (summary.has_quote) {
    return { status: "QUALIFIED PROSPECT", flags };
  }

  if (summary.has_outbound) {
    return { status: "PROSPECT", flags };
  }

  return { status: "NEW LEAD", flags };
}

// ─── Core: run conversion for one account ─────────────────────────────────────

export async function runConversionForAccount(
  account_reference_number: string,
  triggered_by_user_id?: string
): Promise<ConversionResult> {
  const sql = getSql();

  // 1. Get current account status from Neon
  const accounts = await sql`
    SELECT id, status, referenceid, tsm, manager, company_name,
           contact_person, contact_number, email_address, address,
           delivery_address, region, type_client, industry, company_group,
           account_reference_number
    FROM accounts
    WHERE account_reference_number = ${account_reference_number}
    LIMIT 1;
  `;

  if (accounts.length === 0) {
    return {
      account_reference_number,
      old_status: null, new_status: "NEW LEAD",
      probability: 0, pipeline_stage: "Unqualified",
      flags: ["Account not found"], changed: false,
    };
  }

  const account = accounts[0];
  const old_db_status = (account.status ?? "").toLowerCase();

  // Never revert a confirmed client
  if (old_db_status === "official client") {
    return {
      account_reference_number,
      old_status: "OFFICIAL CLIENT", new_status: "OFFICIAL CLIENT",
      probability: 100, pipeline_stage: "Closed / Won",
      flags: [], changed: false,
    };
  }

  // 2. Compute old conversion status from DB flag
  const old_status = dbStatusToConversionStatus(old_db_status);

  // 3. Get activity summary from Supabase
  const summary = await getActivitySummary(account_reference_number);
  const { status: new_status, flags } = determineStatus(summary);

  const changed = new_status !== old_status;

  // 4. If changed, update accounts table + log to conversion_audit_log
  if (changed) {
    const new_db_status = conversionStatusToDbStatus(new_status);

    await sql`
      UPDATE accounts
      SET
        status       = ${new_db_status},
        date_updated = ${new Date().toISOString()},
        conversion_status = ${new_status},
        conversion_probability = ${STATUS_PROBABILITY[new_status]},
        conversion_flags = ${flags.join(", ") || null},
        pipeline_stage = ${STATUS_PIPELINE_STAGE[new_status]}
      WHERE account_reference_number = ${account_reference_number};
    `;

    // Log to audit table
    try {
      await sql`
        INSERT INTO conversion_audit_log
          (account_reference_number, old_status, new_status,
           trigger_activity, trigger_timestamp, user_id, timestamp, flags)
        VALUES
          (${account_reference_number}, ${old_status ?? "NEW LEAD"},
           ${new_status}, ${getTriggerActivity(summary, new_status)},
           ${getTriggerTimestamp(summary, new_status)},
           ${triggered_by_user_id ?? null},
           ${new Date().toISOString()},
           ${flags.join(", ") || null});
      `;
    } catch {
      // Audit log table may not exist yet — non-fatal
    }

    // 5. If converted to OFFICIAL CLIENT → auto-create if not already active
    if (new_status === "OFFICIAL CLIENT" && old_db_status !== "active") {
      await handleClientConversion(account, summary, sql);
    }
  }

  return {
    account_reference_number,
    old_status, new_status,
    probability: STATUS_PROBABILITY[new_status],
    pipeline_stage: STATUS_PIPELINE_STAGE[new_status],
    flags, changed,
  };
}

// ─── Auto-create client record when converted ─────────────────────────────────

async function handleClientConversion(account: any, summary: ActivitySummary, sql: any) {
  // Check for duplicate by company_name — merge if exists
  const existing = await sql`
    SELECT id FROM accounts
    WHERE LOWER(company_name) = LOWER(${account.company_name})
    AND LOWER(status) = 'active'
    AND account_reference_number != ${account.account_reference_number}
    LIMIT 1;
  `;

  if (existing.length > 0) {
    // Duplicate found — mark current as merged, don't create new record
    await sql`
      UPDATE accounts SET
        status = 'active',
        conversion_status = 'OFFICIAL CLIENT',
        conversion_flags = ${(account.conversion_flags ? account.conversion_flags + ", " : "") + "Merged with existing client"},
        date_updated = ${new Date().toISOString()}
      WHERE account_reference_number = ${account.account_reference_number};
    `;
    return;
  }

  // Mark as official client in accounts table (status already updated above)
  // Auto-assign segment based on type_client
  await sql`
    UPDATE accounts SET
      status = 'active',
      conversion_status = 'OFFICIAL CLIENT',
      date_updated = ${new Date().toISOString()}
    WHERE account_reference_number = ${account.account_reference_number};
  `;
}

// ─── Run conversion for all leads under a referenceid ─────────────────────────

export async function runConversionForAgent(referenceid: string): Promise<ConversionResult[]> {
  const sql = getSql();

  // Get all non-client accounts for this agent
  const leads = await sql`
    SELECT account_reference_number
    FROM accounts
    WHERE referenceid = ${referenceid}
    AND LOWER(status) != 'official client'
    AND account_reference_number IS NOT NULL;
  `;

  const results: ConversionResult[] = [];
  for (const lead of leads) {
    try {
      const result = await runConversionForAccount(lead.account_reference_number);
      results.push(result);
    } catch (err) {
      console.error(`Conversion failed for ${lead.account_reference_number}:`, err);
    }
  }
  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbStatusToConversionStatus(dbStatus: string): ConversionStatus | null {
  const s = dbStatus.toLowerCase();
  if (s === "official client") return "OFFICIAL CLIENT";
  if (s === "committed prospect") return "COMMITTED PROSPECT";
  if (s === "qualified prospect") return "QUALIFIED PROSPECT";
  if (s === "prospect") return "PROSPECT";
  if (s === "new lead") return "NEW LEAD";
  return null;
}

function conversionStatusToDbStatus(status: ConversionStatus): string {
  if (status === "OFFICIAL CLIENT") return "active";
  return status.toLowerCase();
}

function getTriggerActivity(summary: ActivitySummary, newStatus: ConversionStatus): string {
  if (newStatus === "OFFICIAL CLIENT")    return "Delivered / Closed Transaction";
  if (newStatus === "COMMITTED PROSPECT") return "Sales Order Preparation";
  if (newStatus === "QUALIFIED PROSPECT") return "Quotation Preparation";
  if (newStatus === "PROSPECT")           return "Outbound Calls";
  return "none";
}

function getTriggerTimestamp(summary: ActivitySummary, newStatus: ConversionStatus): string | null {
  if (newStatus === "OFFICIAL CLIENT")    return summary.latest_closed_at;
  if (newStatus === "COMMITTED PROSPECT") return summary.latest_so_at;
  if (newStatus === "QUALIFIED PROSPECT") return summary.latest_quote_at;
  if (newStatus === "PROSPECT")           return summary.latest_outbound_at;
  return null;
}
