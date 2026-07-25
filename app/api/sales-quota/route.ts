import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const Xchire_url = new URL(req.url);
    const referenceId = Xchire_url.searchParams.get("referenceid");
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[now.getMonth()];

    console.log("Received referenceid:", referenceId, "Year:", currentYear, "Month:", currentMonth);

    if (!referenceId) {
      return NextResponse.json(
        { success: false, error: "Missing reference ID." },
        { status: 400 }
      );
    }

    // Fetch total amount for the year — filtered by month if provided
    const month = Xchire_url.searchParams.get("month") ?? currentMonth;

    let query = supabase
      .from("sales_quota")
      .select("amount")
      .eq("referenceid", referenceId)
      .eq("year", currentYear)
      .eq("month", month);

    const { data: amountData, error: amountError } = await query;

    if (amountError) throw amountError;

    const total = amountData?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;

    // ✅ Standardized response format
    return NextResponse.json(
      { success: true, total },
      { status: 200 }
    );
  } catch (Xchire_error: any) {
    console.error("Error fetching sales quota:", Xchire_error);
    return NextResponse.json(
      { success: false, error: Xchire_error.message || "Failed to fetch sales quota." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; // Always fetch latest data
