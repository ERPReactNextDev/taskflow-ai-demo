import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { spf_number } = req.query;

  if (!spf_number || typeof spf_number !== "string") {
    return res.status(400).json({ message: "Missing or invalid spf_number" });
  }

  try {
    // Fetch the latest revision from spf_request_revision_history
    const { data: revisionData, error: revisionError } = await supabase
      .from("spf_request_revision_history")
      .select("revision_result, revision_date")
      .eq("spf_number", spf_number)
      .order("revision_date", { ascending: false })
      .limit(1)
      .single();

    if (revisionError) {
      // If no revision found, return null
      if (revisionError.code === 'PGRST116') {
        return res.status(200).json({ data: null });
      }
      throw revisionError;
    }

    return res.status(200).json({
      data: revisionData
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      message: err.message || "Server error"
    });
  }
}
