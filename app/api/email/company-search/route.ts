/**
 * GET /api/email/company-search?referenceid=...
 *
 * Returns ALL active companies for the agent's cluster account.
 * Client-side filtering is done in the dialog — no domain matching, no q param.
 * Same DB and query as com-fetch-cluster-account.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");

    if (!referenceid) {
      return NextResponse.json({ error: "referenceid required" }, { status: 400 });
    }

    // Same filter as com-fetch-cluster-account
    const rows = await Xchire_sql`
      SELECT
        id,
        company_name,
        account_reference_number,
        type_client,
        email_address,
        contact_person,
        contact_number,
        address,
        status
      FROM accounts
      WHERE referenceid = ${referenceid}
        AND LOWER(status) IN ('active', 'for approval of tsm')
      ORDER BY company_name ASC
    `;

    return NextResponse.json({ companies: rows });
  } catch (err: any) {
    console.error("[email/company-search]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
