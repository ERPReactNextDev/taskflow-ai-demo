import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url   = new URL(req.url);
    const tsm   = url.searchParams.get("tsm");
    const year  = url.searchParams.get("year") ?? new Date().getFullYear().toString();
    const month = url.searchParams.get("month"); // optional — if provided, return only this month's quota

    if (!tsm) {
      return NextResponse.json(
        { success: false, error: "Missing tsm parameter." },
        { status: 400 }
      );
    }

    // Step 1: Get all TSA ReferenceIDs under this TSM
    const { data: agents, error: agentsError } = await supabase
      .from("users")
      .select("ReferenceID")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")');

    if (agentsError) throw agentsError;

    if (!agents || agents.length === 0) {
      return NextResponse.json({ success: true, total: 0 }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    // Step 2: Sum quota amounts — filtered by month if provided, otherwise full year
    let quotaQuery = supabase
      .from("sales_quota")
      .select("amount")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (month) {
      quotaQuery = quotaQuery.eq("month", month);
    }

    const { data: quotaData, error: quotaError } = await quotaQuery;

    if (quotaError) throw quotaError;

    const total = (quotaData ?? []).reduce(
      (sum, row) => sum + (Number(row.amount) || 0), 0
    );

    return NextResponse.json({ success: true, total }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching TSM sales quota:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch TSM sales quota." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
