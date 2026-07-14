import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const BATCH_SIZE = 500;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

async function fetchAllRows(
  table: string,
  referenceid: string,
  fromDate?: string,
  toDate?: string,
  limit?: number,
  fields: string = "*"
) {
  let allData: any[] = [];
  let offset = 0;
  let hasMore = false;

  while (true) {
    let query = supabase
      .from(table)
      .select(fields)
      .eq("referenceid", referenceid)
      .order("date_created", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (fromDate) query = query.gte("date_created", fromDate);
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      query = query.lte("date_created", d.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) break;

    // Only check limit if it's provided
    if (limit) {
      if (allData.length + data.length > limit) {
        const remaining = limit - allData.length;
        allData.push(...data.slice(0, remaining));
        hasMore = true;
        break;
      }
      if (allData.length >= limit) {
        hasMore = true;
        break;
      }
    }

    allData.push(...data);

    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return { data: allData, hasMore };
}

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { referenceid, from, to, limit, fetchAll, cursor, fields } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Check if this is a fetch-all request
  const isFetchAll = fetchAll === "true";
  // We'll use '*' to avoid errors if some tables lack specific columns
  const selectFields = "*";

  // Parse limit - for fetchAll mode, don't set any limit
  let parsedLimit: number | undefined;
  if (!isFetchAll) {
    parsedLimit = Math.min(
      parseInt(typeof limit === "string" ? limit : String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
  }

  const fromDate = typeof from === "string" ? from : undefined;
  const toDate = typeof to === "string" ? to : undefined;
  const cursorDate = typeof cursor === "string" ? cursor : undefined;

  try {
    // For fetchAll mode, don't set per-table limit - fetch all from each table
    const perTableLimit = isFetchAll ? undefined : Math.ceil(parsedLimit! / 5);

    /* -------------------- 1️⃣ ACTIVITY (Current) -------------------- */
    const { data: activityData, hasMore: activityHasMore } = await fetchAllRows(
      "activity", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 2️⃣ HISTORY -------------------- */
    const { data: historyData, hasMore: historyHasMore } = await fetchAllRows(
      "history", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 3️⃣ REVISED QUOTATIONS -------------------- */
    const { data: revisedData, hasMore: revisedHasMore } = await fetchAllRows(
      "revised_quotations", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 4️⃣ MEETINGS -------------------- */
    const { data: meetingsData, hasMore: meetingsHasMore } = await fetchAllRows(
      "meetings", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 5️⃣ DOCUMENTATION -------------------- */
    const { data: documentationData, hasMore: docHasMore } = await fetchAllRows(
      "documentation", referenceid, fromDate, toDate, perTableLimit, selectFields
    );

    /* -------------------- 6️⃣ NORMALIZE + MERGE -------------------- */
    const normalizeActivity = (item: any, tableSource: string) => {
      return {
        ...item,
        table_source: tableSource,
        // Normalize company name: use company_name if available, otherwise customer_name
        company_name: item.company_name || item.customer_name || item.company,
      };
    };

    let activities = [
      ...(activityData || []).map((item) => normalizeActivity(item, "activity")),
      ...(historyData || []).map((item) => normalizeActivity(item, "history")),
      ...(revisedData || []).map((item) => normalizeActivity(item, "revised_quotations")),
      ...(meetingsData || []).map((item) => normalizeActivity(item, "meeting")),
      ...(documentationData || []).map((item) => normalizeActivity(item, "documentation")),
    ].sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    );

    // Generate next cursor based on last item's date
    let nextCursor: string | null = null;
    let hasMore = false;
    
    if (!isFetchAll) {
      hasMore = activities.length > parsedLimit! ||
        activityHasMore || historyHasMore || revisedHasMore || meetingsHasMore || docHasMore;

      if (activities.length > parsedLimit!) {
        activities = activities.slice(0, parsedLimit!);
      }

      // Generate cursor from the last item's date_created
      if (hasMore && activities.length > 0) {
        const lastItem = activities[activities.length - 1];
        if (lastItem?.date_created) {
          // Use the date of the last item as cursor for next request
          const lastDate = new Date(lastItem.date_created);
          // Subtract 1ms to ensure we don't include the last item again
          lastDate.setMilliseconds(lastDate.getMilliseconds() - 1);
          nextCursor = lastDate.toISOString();
        }
      }
    }

    return res.status(200).json({
      activities,
      pagination: {
        limit: parsedLimit,
        returned: activities.length,
        hasMore,
        nextCursor,
        isFetchAll,
      },
      filters: {
        from: fromDate || null,
        to: toDate || null,
        cursor: cursorDate || null,
      },
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
