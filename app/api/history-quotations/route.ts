import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/** Fetch all rows from Supabase (handles pagination for large datasets) */
async function fetchAllRows<T = any>(query: any): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allData;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");

    if (!referenceid) {
      return NextResponse.json({ success: false, error: "Missing reference ID." }, { status: 400 });
    }

    const now = new Date();

    // Default range: start of current month in Manila time (date-only format)
    const manilaMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
    const defaultStartDate = `${manilaMonth}-01`;

    const startDate = from || defaultStartDate;
    const endDate   = to || (from ? from : null);

    let query = supabase
      .from("history")
      .select("quotation_number, quotation_amount")
      .eq("referenceid", referenceid)
      .eq("type_activity", "Quotation Preparation")
      .eq("status", "Quote-Done")
      .gte("date_created", startDate);

    if (endDate) query = query.lte("date_created", endDate);

    const data = await fetchAllRows(query);

    // Count unique quotation numbers and calculate total amount
    const uniqueQuotations = new Set<string>();
    let totalQuotationAmount = 0;
    data?.forEach(row => {
      if (row.quotation_number) {
        uniqueQuotations.add(row.quotation_number);
      }
      if (row.quotation_amount) {
        const amount = parseFloat(row.quotation_amount);
        if (!isNaN(amount)) {
          totalQuotationAmount += amount;
        }
      }
    });

    return NextResponse.json({ success: true, count: uniqueQuotations.size, totalAmount: totalQuotationAmount }, { status: 200 });
  } catch (err: any) {
    console.error("Error fetching approved quotations:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch approved quotations." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
