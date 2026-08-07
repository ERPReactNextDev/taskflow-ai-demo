/**
 * GET /api/field-attendance
 * Fetch tasklog rows with runtime-computed fields.
 * Params: referenceid | tsm | manager | from | to | status | limit | offset
 *
 * ZERO writes to tasklog — read-only.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const referenceid = searchParams.get("referenceid");
    const tsm         = searchParams.get("tsm");
    const manager     = searchParams.get("manager");
    const from        = searchParams.get("from");   // YYYY-MM-DD
    const to          = searchParams.get("to");     // YYYY-MM-DD
    const status      = searchParams.get("status"); // filter by status
    const limit       = parseInt(searchParams.get("limit") ?? "500");
    const offset      = parseInt(searchParams.get("offset") ?? "0");

    // Build base query — select all existing columns
    let query = supabase
      .from("tasklog")
      .select(
        `id, "ReferenceID", "Email", "Type", "Status", "Remarks", "TSM", "Manager",
         "SiteVisitAccount", "Location", "Latitude", "Longitude",
         "PhotoURL", "SitePhotoURL", date_created, "updatedAt",
         "account_reference_number"`,
        { count: "exact" }
      )
      .order("date_created", { ascending: false })
      .range(offset, offset + limit - 1);

    // Role-based filter
    if (referenceid) query = query.eq('"ReferenceID"', referenceid);
    else if (tsm)    query = query.eq('"TSM"', tsm);
    else if (manager) query = query.eq('"Manager"', manager);

    // Date range (Manila +08:00)
    if (from) query = query.gte("date_created", `${from}T00:00:00+08:00`);
    if (to)   query = query.lte("date_created", `${to}T23:59:59+08:00`);

    // Status filter
    if (status) query = query.eq('"Status"', status);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = data ?? [];

    // ── Runtime computed fields ───────────────────────────────────────────────
    const enriched = rows.map((row: any) => {
      // Duration: date_created → updatedAt
      let duration_minutes: number | null = null;
      if (row.updatedAt && row.date_created) {
        const diff = new Date(row.updatedAt).getTime() - new Date(row.date_created).getTime();
        if (diff > 0) duration_minutes = Math.round(diff / 60000);
      }

      return {
        ...row,
        duration_minutes,
        // GPS distance computed client-side when needed (avoid extra DB calls)
      };
    });

    return NextResponse.json({ success: true, data: enriched, total: count ?? enriched.length });
  } catch (err: any) {
    console.error("[GET /api/field-attendance]", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
