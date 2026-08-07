/**
 * GET /api/lead-conversion/pipeline?referenceid=
 * Returns all leads grouped by conversion_status with full details.
 * Used by the Pipeline Kanban and Lead Management page.
 */

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.TASKFLOW_DB_URL!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");

    if (!referenceid) {
      return NextResponse.json({ success: false, error: "referenceid required" }, { status: 400 });
    }

    const data = await sql`
      SELECT
        id,
        account_reference_number,
        company_name,
        type_client,
        industry,
        region,
        status,
        COALESCE(conversion_status, 'NEW LEAD')      AS conversion_status,
        COALESCE(conversion_probability, 0)          AS conversion_probability,
        COALESCE(pipeline_stage, 'Unqualified')      AS pipeline_stage,
        conversion_flags,
        date_created,
        date_updated,
        contact_person,
        contact_number,
        email_address,
        address,
        company_group,
        referenceid
      FROM accounts
      WHERE referenceid = ${referenceid}
        AND account_reference_number IS NOT NULL
      ORDER BY conversion_probability DESC, date_updated DESC;
    `;

    // Group by conversion_status
    const grouped: Record<string, typeof data> = {
      "OFFICIAL CLIENT":    [],
      "COMMITTED PROSPECT": [],
      "QUALIFIED PROSPECT": [],
      "PROSPECT":           [],
      "NEW LEAD":           [],
    };

    for (const row of data) {
      const key = (row.conversion_status as string) ?? "NEW LEAD";
      if (grouped[key]) grouped[key].push(row);
      else grouped["NEW LEAD"].push(row);
    }

    // Count totals
    const totals = Object.fromEntries(
      Object.entries(grouped).map(([k, v]) => [k, v.length])
    );

    return NextResponse.json({ success: true, data, grouped, totals });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
