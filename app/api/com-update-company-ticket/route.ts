import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";
import { logAuditTrailApp } from "@/lib/auditTrail";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { account_reference_number, ticket_reference_number, referenceid, tsm, manager } = body;

    if (!account_reference_number || !ticket_reference_number || !referenceid || !tsm || !manager) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: account_reference_number, ticket_reference_number, referenceid, tsm, or manager",
        },
        { status: 400 }
      );
    }

    // ── Step 1: Verify the ticket exists in Supabase ────────────────────────
    const { error: ticketErr, data: ticketData } = await supabase
      .from("endorsed-ticket")
      .select("id, account_reference_number")
      .eq("ticket_reference_number", ticket_reference_number)
      .single();

    if (ticketErr || !ticketData) {
      return NextResponse.json(
        { success: false, error: "Endorsed ticket not found." },
        { status: 404 }
      );
    }

    // ── Step 2: Resolve the numeric account id from Neon ────────────────────
    const accountLookup = await Xchire_sql`
      SELECT id FROM accounts
      WHERE account_reference_number = ${account_reference_number}
      LIMIT 1;
    `;

    if (accountLookup.length === 0) {
      return NextResponse.json(
        { success: false, error: "Account not found in database." },
        { status: 404 }
      );
    }

    const accountId = accountLookup[0].id;

    // ── Step 3: Update the account in Neon using the resolved id ────────────
    const updated = await Xchire_sql`
      UPDATE accounts
      SET
        referenceid = ${referenceid},
        manager     = ${manager},
        tsm         = ${tsm}
      WHERE id = ${accountId}
      RETURNING id, referenceid, manager, tsm, account_reference_number;
    `;

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: "Account not found in Neon or no changes applied." },
        { status: 404 }
      );
    }

    await logAuditTrailApp(
      req,
      "update",
      "company ticket assignment",
      accountId,
      account_reference_number,
      `Updated ticket assignment for account via endorsed ticket ${ticket_reference_number}`,
      { manager, tsm, ticket_reference_number }
    );

    return NextResponse.json({ success: true, data: updated[0] }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating account referenceid and manager:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to update account referenceid and manager.",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
