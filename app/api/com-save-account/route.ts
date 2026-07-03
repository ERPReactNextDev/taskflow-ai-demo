import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { logAuditTrailApp } from "@/lib/auditTrail";

const Xchire_databaseUrl = process.env.TASKFLOW_DB_URL;
if (!Xchire_databaseUrl) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const Xchire_sql = neon(Xchire_databaseUrl);

function normalizeField(value: any): string {
  if (Array.isArray(value)) {
    const filtered = value.filter((v) => v && v.trim() !== "");
    return filtered.join(", ");
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

/**
 * Build the prefix from the first 3 letters of the company name + region.
 * e.g. "Ecoshift Corporation" + "NCR" → "ECO-NCR"
 */
function getPrefix(companyName: string, region: string): string {
  const companyPart = companyName.trim().substring(0, 3).toUpperCase();
  const regionPart = region.trim().toUpperCase().replace(/\s+/g, "");
  return `${companyPart}-${regionPart}`;
}

/**
 * Check whether a given account_reference_number already exists in the DB.
 */
async function referenceNumberExists(refNumber: string): Promise<boolean> {
  const result = await Xchire_sql`
    SELECT 1
    FROM accounts
    WHERE account_reference_number = ${refNumber}
    LIMIT 1;
  `;
  return result.length > 0;
}

/**
 * Get the next sequential number for a given prefix by finding the current max.
 * Returns 1 if no records exist for the prefix yet.
 */
async function getNextSequenceNumber(prefix: string): Promise<number> {
  const lastEntry = await Xchire_sql`
    SELECT account_reference_number
    FROM accounts
    WHERE account_reference_number LIKE ${prefix + "-%"}
    ORDER BY account_reference_number DESC
    LIMIT 1;
  `;

  if (lastEntry.length === 0) return 1;

  const lastNumberStr = lastEntry[0].account_reference_number.substring(
    prefix.length + 1
  );
  const lastNumber = parseInt(lastNumberStr, 10);
  return isNaN(lastNumber) ? 1 : lastNumber + 1;
}

/**
 * Generate a unique account_reference_number for the given prefix.
 *
 * Strategy:
 *  1. Try the next sequential number (current max + 1).
 *  2. If that somehow already exists (race condition / manual insert),
 *     fall back to a random 10-digit suffix and keep retrying until
 *     a free one is found (max 10 attempts before throwing).
 */
async function generateUniqueRefNumber(prefix: string): Promise<string> {
  // Step 1: sequential attempt
  const nextSeq = await getNextSequenceNumber(prefix);
  const seqCandidate = `${prefix}-${nextSeq.toString().padStart(10, "0")}`;

  if (!(await referenceNumberExists(seqCandidate))) {
    return seqCandidate;
  }

  // Step 2: random fallback — keep generating until we find one that's free
  const MAX_ATTEMPTS = 10;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Random 10-digit number (100000000 – 9999999999)
    const randomSuffix = Math.floor(
      1_000_000_000 + Math.random() * 8_999_999_999
    )
      .toString()
      .padStart(10, "0");

    const candidate = `${prefix}-${randomSuffix}`;

    if (!(await referenceNumberExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to generate a unique account reference number for prefix "${prefix}" after ${MAX_ATTEMPTS} attempts.`
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Received save account data:", body);

    const {
      referenceid,
      tsm,
      manager,
      company_name,
      contact_person,
      contact_number,
      email_address,
      address,
      delivery_address,
      region,
      type_client,
      date_created,
      industry,
      status,
      company_group,
      tin_number,
    } = body;

    if (!referenceid || !company_name || !type_client || !region) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: referenceid, company_name, type_client or region.",
        },
        { status: 400 }
      );
    }

    // Generate a guaranteed-unique account_reference_number
    const prefix = getPrefix(company_name, region);
    const account_reference_number = await generateUniqueRefNumber(prefix);

    // Normalize array or string fields
    const normalizedContactPerson = normalizeField(contact_person);
    const normalizedContactNumber = normalizeField(contact_number);
    const normalizedEmailAddress = normalizeField(email_address);

    // Use current timestamp if date_created not provided or invalid
    const createdDate =
      date_created && !isNaN(Date.parse(date_created))
        ? date_created
        : new Date().toISOString();

    const inserted = await Xchire_sql`
      INSERT INTO accounts
      (
        referenceid,
        tsm,
        manager,
        company_name,
        contact_person,
        contact_number,
        email_address,
        address,
        delivery_address,
        region,
        type_client,
        date_created,
        industry,
        status,
        company_group,
        account_reference_number,
        tin_number
      )
      VALUES
      (
        ${referenceid},
        ${tsm || null},
        ${manager || null},
        ${company_name},
        ${normalizedContactPerson || null},
        ${normalizedContactNumber || null},
        ${normalizedEmailAddress || null},
        ${address || null},
        ${delivery_address || null},
        ${region || null},
        ${type_client},
        ${createdDate},
        ${industry || null},
        ${status || "Active"},
        ${company_group || null},
        ${account_reference_number},
        ${tin_number || null}
      )
      RETURNING *;
    `;

    // Log audit trail for account creation
    await logAuditTrailApp(
      req,
      "create",
      "company account",
      inserted[0].id?.toString(),
      account_reference_number,
      `Created company account: ${company_name}`,
      { company_name, type_client, region }
    );

    return NextResponse.json(
      { success: true, data: inserted[0] },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error saving account:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save account." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

// PUT handler - same logic as POST (for frontend compatibility)
export async function PUT(req: Request) {
  return POST(req);
}
