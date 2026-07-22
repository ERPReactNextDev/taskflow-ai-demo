import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) throw new Error("TASKFLOW_DB_URL is not set.");
const Xchire_sql = neon(Xchire_databaseUrl);

// GET /api/com-fetch-tsm-approval-accounts?tsm=<referenceid>
// Returns all accounts under a TSM with status = 'for approval of tsm'
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tsm = url.searchParams.get("tsm");

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
    }

    const rows = await Xchire_sql`
      SELECT
        id, referenceid, tsm, company_name, contact_person, contact_number,
        email_address, address, region, type_client, industry,
        status, date_created, date_updated, account_reference_number
      FROM accounts
      WHERE tsm = ${tsm}
        AND LOWER(status) = 'for approval of tsm'
      ORDER BY date_updated DESC
    `;

    return NextResponse.json({ success: true, data: rows }, { status: 200 });
  } catch (err: any) {
    console.error("com-fetch-tsm-approval-accounts error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/com-fetch-tsm-approval-accounts
// Body: { id: string, status: 'active' | 'inactive' }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Missing id or status." }, { status: 400 });
    }

    if (!["active", "inactive"].includes(status)) {
      return NextResponse.json({ success: false, error: "Status must be 'active' or 'inactive'." }, { status: 400 });
    }

    await Xchire_sql`
      UPDATE accounts
      SET status = ${status}, date_updated = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("com-fetch-tsm-approval-accounts PATCH error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
