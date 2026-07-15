import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/**
 * POST /api/sales-quota-upsert
 * Body: { referenceid, month, year, amount, tsm?, manager? }
 *
 * Insert or update a single monthly quota row in sales_quota.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { referenceid, month, year, amount, tsm, manager } = body;

    if (!referenceid || !month || !year || amount === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: referenceid, month, year, amount." },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      return NextResponse.json(
        { success: false, error: "amount must be a non-negative number." },
        { status: 422 }
      );
    }

    // Check if row already exists
    const { data: existing } = await supabase
      .from("sales_quota")
      .select("id")
      .eq("referenceid", referenceid)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabase
        .from("sales_quota")
        .update({
          amount:       amountNum,
          date_updated: new Date().toISOString(),
        })
        .eq("referenceid", referenceid)
        .eq("month", month)
        .eq("year", year);
    } else {
      result = await supabase
        .from("sales_quota")
        .insert({
          referenceid,
          month,
          year,
          amount:  amountNum,
          tsm:     tsm     ?? null,
          manager: manager ?? null,
        });
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("sales-quota-upsert POST error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save quota." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
