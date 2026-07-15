import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/**
 * GET /api/manager-quota-data?ids=ID1,ID2,...&year=2026
 *
 * Returns all monthly quota amounts for the given agent IDs and year.
 * Response: { success: true, quotas: { [referenceid]: { [month]: number } } }
 */
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const raw  = url.searchParams.get("ids");
    const year = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!raw) {
      return NextResponse.json(
        { success: false, error: "Missing ids parameter." },
        { status: 400 }
      );
    }

    // Parse comma-separated IDs, skip blanks
    const ids = raw.split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, quotas: {} }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("sales_quota")
      .select("referenceid, month, amount")
      .in("referenceid", ids)
      .eq("year", year);

    if (error) throw error;

    // Build map: { [referenceid]: { [month]: number } }
    const quotas: Record<string, Record<string, number>> = {};
    for (const row of data ?? []) {
      if (!quotas[row.referenceid]) quotas[row.referenceid] = {};
      quotas[row.referenceid][row.month] = Number(row.amount) || 0;
    }

    return NextResponse.json({ success: true, quotas }, { status: 200 });
  } catch (err: any) {
    console.error("manager-quota-data GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch quota data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
