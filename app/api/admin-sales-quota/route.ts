import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// GET /api/admin-sales-quota?year=2026&month=July
// Returns the sum of sales_quota rows for active TSAs for the given month (MTD target).
export async function GET(req: Request) {
  try {
    const url   = new URL(req.url);
    const now   = new Date();
    const year  = url.searchParams.get("year")  ?? now.getFullYear().toString();
    const month = url.searchParams.get("month") ?? MONTH_NAMES[now.getMonth()];

    // Get all active TSA ReferenceIDs system-wide
    const { data: agents, error: agentError } = await supabase
      .from("users")
      .select("ReferenceID")
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');

    if (agentError) throw agentError;

    const agentIds = (agents ?? []).map((a) => a.ReferenceID).filter(Boolean);
    if (agentIds.length === 0) {
      return NextResponse.json({ success: true, total: 0, agentCount: 0 }, { status: 200 });
    }

    const { data: quotaData, error: quotaError } = await supabase
      .from("sales_quota")
      .select("amount")
      .in("referenceid", agentIds)
      .eq("year", year)
      .eq("month", month);

    if (quotaError) throw quotaError;

    const total = (quotaData ?? []).reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0
    );

    return NextResponse.json(
      { success: true, total, agentCount: agentIds.length },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("admin-sales-quota GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
