import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/** Fetch all rows from Supabase (handles pagination for large datasets) */
async function fetchAllRows<T = any>(query: any): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allData: T[] = [];
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
    const Xchire_url  = new URL(req.url);
    const referenceId = Xchire_url.searchParams.get("referenceid");
    const from        = Xchire_url.searchParams.get("from");
    const to          = Xchire_url.searchParams.get("to");

    if (!referenceId) {
      return NextResponse.json({ success: false, error: "Missing reference ID." }, { status: 400 });
    }

    const now = new Date();
    
    // Helper to convert YYYY-MM-DD to date string (YYYY-MM-DD)
    function formatDateString(d: Date): string {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // Default range: start of current year
    const defaultStart = new Date(now.getFullYear(), 0, 1);
    const startDateStr = from ? from : formatDateString(defaultStart);
    const endDateStr = to ? to : null;

    let q = supabase
      .from("history")
      .select("actual_sales, activity_reference_number")
      .eq("referenceid", referenceId)
      .eq("type_activity", "Delivered / Closed Transaction")
      .gte("delivery_date", startDateStr);

    if (endDateStr) q = q.lte("delivery_date", endDateStr);

    const data = await fetchAllRows(q);
    
    // Prevent duplicate counting by tracking unique activity_reference_number
    const seenActivityRefs = new Set<string>();
    let skippedDuplicates = 0;
    let processedRows = 0;
    
    const total = data?.reduce((sum, item) => {
      const activityRef = item.activity_reference_number;
      
      // Skip if we've already counted this activity (only if ref exists)
      if (activityRef && seenActivityRefs.has(activityRef)) {
        console.log(`[history] Skipping duplicate activity_ref: ${activityRef}, amount: ${item.actual_sales}`);
        skippedDuplicates++;
        return sum;
      }
      
      // Mark this activity as seen (only if ref exists)
      if (activityRef) {
        seenActivityRefs.add(activityRef);
      }
      
      processedRows++;
      return sum + (Number(item.actual_sales) || 0);
    }, 0) || 0;
    
    console.log(`[history] referenceid: ${referenceId}, Total rows: ${data?.length}, Processed: ${processedRows}, Skipped duplicates: ${skippedDuplicates}, Final total: ${total}`);

    return NextResponse.json({ success: true, total }, { status: 200 });
  } catch (Xchire_error: any) {
    console.error("Error fetching history:", Xchire_error);
    return NextResponse.json({ success: false, error: Xchire_error.message || "Failed to fetch history." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
