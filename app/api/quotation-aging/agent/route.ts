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

    if (!referenceid)
      return NextResponse.json({ success: false, error: "Missing referenceid." }, { status: 400 });

    const { data, error } = await supabase
      .from("quotation_aging")
      .select("*")
      .eq("referenceid", referenceid)
      .order("tsm_approval_date", { ascending: true });

    if (error) throw error;

    const now = new Date();
    const enriched = (data || []).map((row) => {
      const approvalDate = new Date(row.tsm_approval_date);
      const daysAging    = Math.max(0, Math.floor((now.getTime() - approvalDate.getTime()) / 86400000));
      const daysRemaining = row.aging_days - daysAging;

      let agingStatus: string = "ON_TRACK";
      if      (row.status === "CONVERTED_TO_SO") agingStatus = "CONVERTED";
      else if (row.status === "DISMISSED")        agingStatus = "DISMISSED";
      else if (row.status === "FOLLOWED_UP")      agingStatus = "FOLLOWED_UP";
      else if (daysAging > row.aging_days)        agingStatus = "OVERDUE";
      else if (daysRemaining >= 0 && daysRemaining <= 2) agingStatus = "DUE_SOON";

      return { ...row, daysAging, daysRemaining, agingStatus };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
