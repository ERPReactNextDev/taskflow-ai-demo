import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

/**
 * GET /api/site-visit-target?referenceid=<id>&year=<YYYY>&month=<MonthName>
 *
 * Returns the site visit target for a specific agent, year, and month.
 * Uses maybeSingle() to handle both zero rows and multiple rows gracefully.
 * If multiple rows exist, picks the one with the highest target value.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const referenceid = req.query.referenceid as string;
  const year        = req.query.year  as string | undefined;
  const month       = req.query.month as string | undefined;

  if (!referenceid) {
    return res.status(400).json({ error: "referenceid query parameter is required" });
  }

  try {
    // Use select without .single() so we can handle zero or multiple rows safely
    let query = supabase
      .from("site_visit_target")
      .select("*")
      .eq("referenceid", referenceid)
      .order("target", { ascending: false }); // highest target first

    if (year)  query = query.eq("year",  year);
    if (month) query = query.eq("month", month);

    const { data, error } = await query.limit(1);

    if (error) {
      console.error("Error fetching site visit target:", error);
      return res.status(500).json({ error: "Server error fetching site visit target" });
    }

    // No rows found → return null target (caller will use its own default)
    if (!data || data.length === 0) {
      return res.status(200).json({ success: true, target: null });
    }

    // Return the first (highest-target) row
    return res.status(200).json({ success: true, target: data[0] });
  } catch (err: any) {
    console.error("Error fetching site visit target:", err);
    return res.status(500).json({ error: err.message || "Server error fetching site visit target" });
  }
}
