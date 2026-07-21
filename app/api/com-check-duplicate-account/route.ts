import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";

const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL;
if (!TASKFLOW_DB_URL) {
  throw new Error("TASKFLOW_DB_URL is not set in environment variables.");
}

const sql = neon(TASKFLOW_DB_URL);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// Minimum length (after stripping spaces/punctuation) before we allow
// "reverse contains" / short-name fuzzy matching. Prevents 1-3 character
// company names in the DB from falsely matching almost any input.
const MIN_FUZZY_LENGTH = 4;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const companyNameRaw = url.searchParams.get("company_name");

    if (!companyNameRaw || companyNameRaw.trim().length < 3) {
      return NextResponse.json(
        { exists: false, companies: [], error: "Invalid or missing company_name." },
        { status: 400 }
      );
    }

    // Clean the input similarly to your client-side cleanCompanyName function
    let cleaned = companyNameRaw.toUpperCase();
    cleaned = cleaned.replace(/[-_.,]/g, "");
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    cleaned = cleaned.replace(/\d+$/g, "");
    cleaned = cleaned.trim();

    // Also produce a fully-collapsed version (no spaces/punctuation) for fuzzy matching
    // e.g. "BUILD XCHIRE" → "BUILDXCHIRE" so it matches "BUILDXCHIRE" and vice versa
    const collapsedInput = cleaned.replace(/\s+/g, "").replace(/[^A-Z0-9]/g, "");

    const allowFuzzy = collapsedInput.length >= MIN_FUZZY_LENGTH;

    // IMPORTANT: we branch in JS instead of passing a raw JS boolean into the
    // SQL template. Some drivers (including neon serverless) don't reliably
    // bind a bare `true`/`false` as SQL `boolean`, which throws
    // "argument of AND must be type boolean, not type text" and silently
    // breaks every duplicate check (the frontend swallows the error).
    const resultsRaw = allowFuzzy
      ? await sql`
          SELECT company_name, contact_person, contact_number, referenceid AS owner_referenceid,
                 tsm, status, type_client, region
          FROM accounts
          WHERE (
            company_name ILIKE ${`%${cleaned}%`}
            OR (
              LENGTH(REGEXP_REPLACE(company_name, '[^A-Za-z0-9]', '', 'g')) >= ${MIN_FUZZY_LENGTH}
              AND UPPER(REGEXP_REPLACE(company_name, '[^A-Za-z0-9]', '', 'g')) ILIKE ${`%${collapsedInput}%`}
            )
            OR (
              LENGTH(REGEXP_REPLACE(company_name, '[^A-Za-z0-9]', '', 'g')) >= ${MIN_FUZZY_LENGTH}
              AND ${collapsedInput} ILIKE CONCAT('%', UPPER(REGEXP_REPLACE(company_name, '[^A-Za-z0-9]', '', 'g')), '%')
            )
          )
            AND LOWER(status) NOT IN ('removed', 'approved for deletion')
          ORDER BY date_created DESC
          LIMIT 15;
        `
      : await sql`
          SELECT company_name, contact_person, contact_number, referenceid AS owner_referenceid,
                 tsm, status, type_client, region
          FROM accounts
          WHERE company_name ILIKE ${`%${cleaned}%`}
            AND LOWER(status) NOT IN ('removed', 'approved for deletion')
          ORDER BY date_created DESC
          LIMIT 15;
        `;

    if (resultsRaw.length === 0) {
      return NextResponse.json({ exists: false, companies: [] }, { status: 200 });
    }

    // Convert contact_person and contact_number from comma-separated strings to arrays
    // Collect unique referenceids (owner + tsm) for name resolution
    const refIds = new Set<string>();
    for (const row of resultsRaw) {
      if (row.owner_referenceid) refIds.add(row.owner_referenceid);
      if (row.tsm) refIds.add(row.tsm);
    }

    // Resolve owner + TSM names from Supabase users table
    const nameMap: Record<string, string> = {};
    if (refIds.size > 0) {
      try {
        const ids = Array.from(refIds);
        const { data: nameRows } = await supabase
          .from("users")
          .select("ReferenceID, Firstname, Lastname")
          .in("ReferenceID", ids);
        for (const r of nameRows ?? []) {
          nameMap[r.ReferenceID] = `${r.Firstname ?? ""} ${r.Lastname ?? ""}`.trim();
        }
      } catch { /* silent — fall back to IDs */ }
    }

    const results = resultsRaw.map((row: any) => ({
      company_name: row.company_name,
      owner_referenceid: row.owner_referenceid,
      owner_name: nameMap[row.owner_referenceid] || null,
      tsm: row.tsm || null,
      tsm_name: row.tsm ? (nameMap[row.tsm] || null) : null,
      status: row.status || null,
      type_client: row.type_client || null,
      region: row.region || null,
      contact_person: row.contact_person
        ? row.contact_person.split(",").map((s: string) => s.trim())
        : [],
      contact_number: row.contact_number
        ? row.contact_number.split(",").map((s: string) => s.trim())
        : [],
    }));

    return NextResponse.json({ exists: true, companies: results }, { status: 200 });
  } catch (error: any) {
    console.error("Error in /api/accounts/check-duplicate:", error);
    return NextResponse.json(
      { exists: false, companies: [], error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}