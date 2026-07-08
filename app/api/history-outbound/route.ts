import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from        = url.searchParams.get("from");
    const to          = url.searchParams.get("to");

    if (!referenceid) {
      return NextResponse.json({ success: false, error: "Missing reference ID." }, { status: 400 });
    }

    const now = new Date();

    // Helper to convert YYYY-MM-DD to Asia/Manila time range as UTC ISO strings
    function getManilaDateRange(dateStr: string): { start: string; end: string } {
      // Asia/Manila is UTC+8, so midnight Manila = UTC-8h
      return {
        start: `${dateStr}T00:00:00+08:00`,
        end:   `${dateStr}T23:59:59.999+08:00`,
      };
    }

    // Default range: start of current month in Manila time
    const manilaMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
    const defaultStartISO = `${manilaMonth}-01T00:00:00+08:00`;

    const startISO = from ? getManilaDateRange(from).start : defaultStartISO;
    const endISO   = to   ? getManilaDateRange(to).end   : (from ? getManilaDateRange(from).end : null);

    let q = supabase
      .from("history")
      .select("*", { count: "exact" })
      .eq("referenceid", referenceid)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", startISO);

    if (endISO) q = q.lte("date_created", endISO);

    const { error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching outbound calls:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch outbound calls." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
