import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { spf_number } = req.query;

  if (!spf_number || typeof spf_number !== "string") {
    return res.status(400).json({ message: "Missing or invalid spf_number" });
  }

  try {
    // Fetch from spf_request table by spf_number
    const { data: requestData, error: requestError } = await supabase
      .from("spf_request")
      .select("*")
      .eq("spf_number", spf_number)
      .single();

    if (requestError) {
      console.error("SPF request query error:", requestError);
      throw requestError;
    }

    if (!requestData) {
      return res.status(404).json({ message: "SPF request not found" });
    }

    return res.status(200).json({
      data: requestData
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ 
      message: err.message || "Server error"
    });
  }
}
