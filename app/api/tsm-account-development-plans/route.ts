import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const tsm  = url.searchParams.get("tsm");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
    }

    // Use date range if provided, otherwise use current year
    const now = new Date();
    let startDate, endDate;
    
    if (from && to) {
      startDate = `${from}T00:00:00Z`;
      endDate = `${to}T23:59:59Z`;
    } else {
      const currentYear = now.getFullYear();
      startDate = `${currentYear}-01-01T00:00:00Z`;
      endDate = `${currentYear}-12-31T23:59:59Z`;
    }

    const { count, error } = await supabase
      .from("account_development_plans")
      .select("id", { count: "exact", head: true })
      .eq("tsm", tsm)
      .gte("created_at", startDate)
      .lte("created_at", endDate);
    if (error) throw error;

    return NextResponse.json({ success: true, count: count ?? 0 }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching TSM account development plans:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
