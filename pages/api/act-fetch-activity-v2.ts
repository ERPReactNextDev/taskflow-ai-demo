// pages/api/act-fetch-activity-v2.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local",
  );
}

if (!MONGODB_DB) {
  throw new Error(
    "Please define the MONGODB_DB environment variable inside .env.local",
  );
}

const mongoUri: string = MONGODB_URI;
const mongoDb: string = MONGODB_DB;

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

/* ================= DATABASE CONNECT START ================= */

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(mongoUri, { maxPoolSize: 5, minPoolSize: 1, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });

  await client.connect();

  const db = client.db(mongoDb);

  cachedClient = client;

  cachedDb = db;

  return { client, db };
}

/* ================= DATABASE CONNECT END ================= */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { referenceid } = req.query;

    const { db } = await connectToDatabase();

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