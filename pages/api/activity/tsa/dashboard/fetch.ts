import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 1000; // Reduced batch size to prevent strain

async function* fetchRowsInBatches(
  table: string,
  referenceid: string,
  fromDate?: string,
  toDate?: string
) {
  let offset = 0;
  
  // Identify the correct date column for this table
  let dateColumn = "date_created";
  if (table === "meetings") dateColumn = "date_updated";
  if (table === "revised_quotations") dateColumn = "date_updated";
  // Add other table-specific columns if needed

  while (true) { // No safety limit - fetch all available data
    let query = supabase
      .from(table)
      .select("*")
      .eq("referenceid", referenceid)
      .order(dateColumn, { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate && toDate) {
      // Use inclusive range for timestamps
      query = query
        .gte(dateColumn, `${fromDate}T00:00:00.000Z`)
        .lte(dateColumn, `${toDate}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      break; // stop fetching this table but don't crash the whole API
    }

    if (!data || data.length === 0) break;

    yield data;

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid, from, to } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;

  try {
    // For multiple tables, we process sequentially to reduce memory usage
    const tables = ["activity", "history", "revised_quotations", "meetings", "documentation", "spf_request", "spf"];
    let totalCount = 0;

    // Store merged activities in a temporary array if needed for sorting
    const activities: any[] = [];

    for (const table of tables) {
      for await (const batch of fetchRowsInBatches(table, referenceid, fromDate, toDate)) {
        const normalized = batch.map((item) => {
          // Identify the actual date to use for dashboard display and sorting
          const dateToUse = item.date_created || item.date_updated || item.created_at || item.updated_at;
          
          const base = { 
            source: table, 
            ...item,
            // Ensure every item has date_created for the frontend filter
            date_created: dateToUse 
          };

          // If it's from spf_request or spf, set type_activity to "SPF Creation"
          if (table === "spf_request" || table === "spf") {
            return { ...base, type_activity: "SPF Creation" };
          }
          return base;
        });
        totalCount += normalized.length;
        activities.push(...normalized);
      }
    }

    // Sort at the end by date_created (now guaranteed to exist)
    activities.sort(
      (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    return res.status(200).json({
      activities,
      total: totalCount,
      cached: false,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}