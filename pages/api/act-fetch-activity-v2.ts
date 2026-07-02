// pages/api/act-fetch-activity-v2.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { referenceid } = req.query;

    const db = await connectToDatabase();
    const collection = db.collection("activity");

    /* ================= CSR METRICS FILTER START ================= */

    let filter = {};

    if (referenceid && typeof referenceid === "string") {
      filter = {
        $or: [
          { referenceid: referenceid },
          { agent: referenceid }, // CSR MATCH HERE
        ],
      };
    }

    /* ================= CSR METRICS FILTER END ================= */

    const data = await collection.find(filter).toArray();

    /* ================= DEBUG LOG START ================= */

    console.log("CSR METRICS V2 RESULT COUNT:", data.length);
    console.log("CSR METRICS V2 REF:", referenceid);

    /* ================= DEBUG LOG END ================= */

    return res.status(200).json({
      success: true,
      data,
      cached: false,
    });
  } catch (error: any) {
    console.error("MongoDB fetch error:", error);
    return res.status(500).json({
      error: "Server error",
    });
  }
}
