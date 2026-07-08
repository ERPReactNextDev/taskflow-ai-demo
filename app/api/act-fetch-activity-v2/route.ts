import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * GET /api/act-fetch-activity-v2?referenceid=<id>
 *
 * Returns all activity records from MongoDB for a given TSA referenceid.
 * Used by CSRMetricsCard and related components to compute response time,
 * quotation HT, non-quotation HT, and SPF handling duration client-side.
 */
export async function GET(req: Request) {
  try {
    const url         = new URL(req.url);
    const referenceid = url.searchParams.get("referenceid");

    if (!referenceid) {
      return NextResponse.json(
        { success: false, error: "Missing referenceid." },
        { status: 400 }
      );
    }

    const db  = await connectToDatabase();
    const col = db.collection("activity");

    const data = await col
      .find({
        $or: [
          { referenceid: referenceid },
          { agent: referenceid },
        ],
      })
      .toArray();

    // Serialize MongoDB _id to string so the response is JSON-safe
    const serialized = data.map((doc) => ({
      ...doc,
      _id: doc._id?.toString(),
    }));

    return NextResponse.json({ success: true, data: serialized }, { status: 200 });
  } catch (err: any) {
    console.error("act-fetch-activity-v2 error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch activity data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
