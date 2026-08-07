/**
 * POST /api/lead-conversion/run
 * Runs the conversion engine for one or all leads under a referenceid.
 *
 * Body: { referenceid: string, account_reference_number?: string }
 * - If account_reference_number is provided → run for that single lead
 * - Otherwise → run for all leads under referenceid
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const sql = neon(process.env.TASKFLOW_DB_URL!);

// ─── Types ────────────────────────────────────────────────────────────────────

type ConversionStatus =
  | "NEW LEAD"
  | "PROSPECT"
  | "QUALIFIED PROSPECT"
  | "COMMITTED PROSPECT"
  | "OFFICIAL CLIENT";

const STATUS_PROBABILITY: Record<ConversionStatus, number> = {
  "NEW LEAD": 0, "PROSPECT": 10, "QUALIFIED PROSPECT": 35,
  "COMMITTED PROSPECT": 75, "OFFICIAL CLIENT": 100,
};

const STATUS_PIPELINE: Record<ConversionStatus, string> = {
  "NEW LEAD": "Unqualified", "PROSPECT": "Lead Stage",
  "QUALIFIED PROSPECT": "Quote Sent", "COMMITTED PROSPECT": "Order Received",
  "OFFICIAL CLIENT": "Closed / Won",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function determineStatus(
  hasOutbound: boolean, hasQuote: boolean, hasSO: boolean, hasClosed: boolean
): { status: ConversionStatus; flags: string[] } {
  const flags: string[] = [];
  if (hasClosed) {
    if (!hasSO)    flags.push("Incomplete Activity History");
    return { status: "OFFICIAL CLIENT", flags };
  }
  if (hasSO) {
    if (!hasQuote) flags.push("Missing Quotation History");
    return { status: "COMMITTED PROSPECT", flags };
  }
  if (hasQuote) return { status: "QUALIFIED PROSPECT", flags };
  if (hasOutbound) return { status: "PROSPECT", flags };
  return { status: "NEW LEAD", flags };
}

async function getActivitySummary(account_reference_number: string) {
  const { data, error } = await supabase
    .from("history")
    .select("type_activity, source, date_created")
    .eq("account_reference_number", account_reference_number)
    .order("date_created", { ascending: true });

  if (error) throw error;
  const rows = data ?? [];

  let hasOutbound = false, hasQuote = false, hasSO = false, hasClosed = false;
  let latestOutbound: string | null = null, latestQuote: string | null = null;
  let latestSO: string | null = null, latestClosed: string | null = null;

  for (const r of rows) {
    if (r.source === "Outbound - Touchbase" || r.type_activity === "Outbound Calls") {
      hasOutbound = true; latestOutbound = r.date_created;
    }
    if (r.type_activity === "Quotation Preparation")       { hasQuote  = true; latestQuote  = r.date_created; }
    if (r.type_activity === "Sales Order Preparation")     { hasSO     = true; latestSO     = r.date_created; }
    if (r.type_activity === "Delivered / Closed Transaction") { hasClosed = true; latestClosed = r.date_created; }
  }

  return { hasOutbound, hasQuote, hasSO, hasClosed, latestOutbound, latestQuote, latestSO, latestClosed };
}

async function runForAccount(ref: string, userId?: string) {
  // Fetch current account
  const accounts = await sql`
    SELECT id, status, conversion_status, company_name, referenceid
    FROM accounts WHERE account_reference_number = ${ref} LIMIT 1;
  `;
  if (!accounts.length) return { account_reference_number: ref, changed: false, error: "Not found" };

  const acct = accounts[0];
  const currentConvStatus = (acct.conversion_status ?? "NEW LEAD") as ConversionStatus;

  // Never revert a confirmed client
  if (currentConvStatus === "OFFICIAL CLIENT") {
    return { account_reference_number: ref, changed: false, new_status: "OFFICIAL CLIENT" };
  }

  // Get activity summary
  const summary = await getActivitySummary(ref);
  const { status: newStatus, flags } = determineStatus(
    summary.hasOutbound, summary.hasQuote, summary.hasSO, summary.hasClosed
  );

  const changed = newStatus !== currentConvStatus;

  if (changed) {
    const newDbStatus = newStatus === "OFFICIAL CLIENT" ? "active" : newStatus.toLowerCase();

    await sql`
      UPDATE accounts SET
        conversion_status      = ${newStatus},
        conversion_probability = ${STATUS_PROBABILITY[newStatus]},
        conversion_flags       = ${flags.join(", ") || null},
        pipeline_stage         = ${STATUS_PIPELINE[newStatus]},
        status                 = ${newDbStatus},
        date_updated           = ${new Date().toISOString()}
      WHERE account_reference_number = ${ref};
    `;

    // Log to conversion_audit_log (if table exists)
    try {
      await sql`
        INSERT INTO conversion_audit_log
          (account_reference_number, old_status, new_status, trigger_activity,
           trigger_timestamp, user_id, timestamp, flags)
        VALUES
          (${ref}, ${currentConvStatus}, ${newStatus},
           ${newStatus === "OFFICIAL CLIENT" ? "Delivered / Closed Transaction"
             : newStatus === "COMMITTED PROSPECT" ? "Sales Order Preparation"
             : newStatus === "QUALIFIED PROSPECT" ? "Quotation Preparation"
             : "Outbound Calls"},
           ${newStatus === "OFFICIAL CLIENT" ? summary.latestClosed
             : newStatus === "COMMITTED PROSPECT" ? summary.latestSO
             : newStatus === "QUALIFIED PROSPECT" ? summary.latestQuote
             : summary.latestOutbound},
           ${userId ?? null}, ${new Date().toISOString()}, ${flags.join(", ") || null});
      `;
    } catch { /* audit table may not exist yet */ }
  }

  return {
    account_reference_number: ref,
    old_status: currentConvStatus,
    new_status: newStatus,
    probability: STATUS_PROBABILITY[newStatus],
    pipeline_stage: STATUS_PIPELINE[newStatus],
    flags,
    changed,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { referenceid, account_reference_number, user_id } = await req.json();

    if (!referenceid && !account_reference_number) {
      return NextResponse.json({ success: false, error: "referenceid or account_reference_number required" }, { status: 400 });
    }

    if (account_reference_number) {
      // Single account
      const result = await runForAccount(account_reference_number, user_id);
      return NextResponse.json({ success: true, results: [result] });
    }

    // All leads under this agent
    const leads = await sql`
      SELECT account_reference_number FROM accounts
      WHERE referenceid = ${referenceid}
      AND LOWER(COALESCE(conversion_status, '')) != 'official client'
      AND account_reference_number IS NOT NULL;
    `;

    const results = [];
    for (const lead of leads) {
      try {
        const r = await runForAccount(lead.account_reference_number, user_id);
        results.push(r);
      } catch (e: any) {
        results.push({ account_reference_number: lead.account_reference_number, error: e.message });
      }
    }

    return NextResponse.json({ success: true, total: results.length, results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
