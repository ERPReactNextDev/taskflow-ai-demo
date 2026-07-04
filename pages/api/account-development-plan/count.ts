import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const referenceid = req.query.referenceid as string;
    const month = req.query.month as string; // optional YYYY-MM
    const year = req.query.year as string; // optional YYYY
    const from = req.query.from as string; // optional YYYY-MM-DD
    const to = req.query.to as string; // optional YYYY-MM-DD

    if (!referenceid) {
      return res.status(400).json({ error: "Reference ID is required" });
    }

    // Calculate date range
    let startDate, endDate;
    const now = new Date();
    
    if (from && to) {
      // Explicit range provided — use it exactly
      startDate = from;
      endDate = to;
    } else if (from) {
      // Only "from" provided — scope to that calendar month
      const d = new Date(from);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-indexed
      const lastDay = new Date(year, month + 1, 0).getDate();
      startDate = from;
      endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    } else {
      // No params — default to current calendar month
      const year = now.getFullYear();
      const month = now.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      endDate   = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }

    // Fetch count from account_development_plans table
    const { data: plans, error: plansError } = await supabase
      .from("account_development_plans")
      .select("id")
      .eq("referenceid", referenceid)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (plansError) throw plansError;

    res.status(200).json({ count: plans?.length || 0, target: 2 });
  } catch (error) {
    console.error("Error fetching account development plan count:", error);
    res.status(500).json({ error: "Server error" });
  }
}
