import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { neon } from "@neondatabase/serverless";

// Initialize Neon DB
const TASKFLOW_DB_URL = process.env.TASKFLOW_DB_URL;
if (!TASKFLOW_DB_URL) {
  throw new Error("TASKFLOW_DB_URL is not set in the environment variables.");
}
const sql = neon(TASKFLOW_DB_URL);

// Normalize company name function
const normalizeCompany = (name: string): string =>
  (name || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/\.+$/, "");

// Helper to fetch all rows from Supabase
async function fetchAllRowsFromTable(
  table: string,
  referenceid: string,
  monthStartDate: string,
  monthEndDate: string
) {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(table)
      .select("company_name, contact_person, account_reference_number, date_created")
      .eq("referenceid", referenceid)
      .gte("date_created", monthStartDate);

    const d = new Date(monthEndDate);
    d.setHours(23, 59, 59, 999);
    query = query.lte("date_created", d.toISOString());
    query = query.range(offset, offset + PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allData;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { referenceid, from, to } = req.query;

    if (!referenceid || typeof referenceid !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid referenceid parameter.",
      });
    }

    // Calculate month range if from/to not provided
    let monthStartDate: string;
    let monthEndDate: string;
    const today = new Date();
    const manilaToday = today.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [year, month] = manilaToday.split("-").map(Number);
    const fromDate = typeof from === "string" ? from : undefined;
    const toDate = typeof to === "string" ? to : undefined;

    if (fromDate) {
      const [y, m] = fromDate.split("-").map(Number);
      monthStartDate = `${y}-${String(m).padStart(2, "0")}-01`;
      monthEndDate = toDate || `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    } else {
      monthStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
      monthEndDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    }

    console.log("db-coverage: params", { referenceid, monthStartDate, monthEndDate });

    // 1. Fetch cluster accounts
    const clusterAccounts = await sql`
      SELECT company_name, account_reference_number, status, type_client
      FROM accounts
      WHERE referenceid = ${referenceid}
        AND LOWER(status) NOT IN ('removed', 'approved for deletion', 'subject for transfer')
    `;
    console.log("db-coverage: cluster accounts", clusterAccounts.length);

    // Filter accounts (same as database-coverage.tsx)
    const excludedStatuses = new Set(["removed", "approved for deletion", "subject for transfer"]);
    const allowedTypes = new Set(["top 50", "next 30", "balance 20", "tsa client", "csr client", "new client"]);
    const filteredAccounts = clusterAccounts.filter((acc: any) => {
      const status = (acc.status || "").toLowerCase();
      const typeClient = (acc.type_client || "").toLowerCase();
      return status && typeClient && !excludedStatuses.has(status) && allowedTypes.has(typeClient);
    });
    console.log("db-coverage: filtered accounts", filteredAccounts.length);

    // 2. Fetch all activities from 5 tables
    const allActivities: any[] = [];
    const tables = ["history"];
    
    for (const table of tables) {
      const data = await fetchAllRowsFromTable(table, referenceid, monthStartDate, monthEndDate);
      console.log(`db-coverage: table ${table}`, data.length);
      allActivities.push(...data);
    }
    console.log("db-coverage: total activities", allActivities.length);

    // 3. Calculate touched companies/accounts
    const touchedCompanyNames = new Set<string>();
    const touchedAccountRefs = new Set<string>();

    const [msY, msM] = monthStartDate.split("-").map(Number);
    const [meY, meM] = monthEndDate.split("-").map(Number);
    const monthStart = Date.UTC(msY, msM - 1, 1);
    const monthEnd = Date.UTC(meY, meM, 0, 23, 59, 59, 999);

    for (const act of allActivities) {
      const dateStr = act.date_created?.toString().split("T")[0];
      if (!dateStr) continue;
      const [y, m, day] = dateStr.split("-").map(Number);
      if (!y || !m || !day) continue;
      const actDate = Date.UTC(y, m - 1, day);
      if (actDate < monthStart || actDate > monthEnd) continue;

      if (act.account_reference_number) {
        touchedAccountRefs.add(act.account_reference_number.toString().trim());
      }
      const companyName = act.company_name || act.customer_name || act.company;
      if (companyName) {
        touchedCompanyNames.add(normalizeCompany(companyName));
      }
    }
    console.log("db-coverage: touched companies", touchedCompanyNames.size, "account refs", touchedAccountRefs.size);

    // 4. Calculate covered count
    const coveredCount = filteredAccounts.filter((acc: any) => {
      if (acc.account_reference_number && touchedAccountRefs.has(acc.account_reference_number.toString().trim())) {
        return true;
      }
      if (acc.company_name && touchedCompanyNames.has(normalizeCompany(acc.company_name))) {
        return true;
      }
      return false;
    }).length;

    console.log("db-coverage: covered count", coveredCount, "total count", filteredAccounts.length);

    // 5. If detail=true, return per-company breakdown
    const detail = req.query.detail === "true";
    if (detail) {
      const withActivity: string[] = [];
      const noActivity:   string[] = [];

      for (const acc of filteredAccounts) {
        const isCovered =
          (acc.account_reference_number && touchedAccountRefs.has(acc.account_reference_number.toString().trim())) ||
          (acc.company_name && touchedCompanyNames.has(normalizeCompany(acc.company_name)));

        const name = (acc.company_name || "").trim() || "—";
        if (isCovered) withActivity.push(name);
        else noActivity.push(name);
      }

      withActivity.sort((a, b) => a.localeCompare(b));
      noActivity.sort((a, b) => a.localeCompare(b));

      return res.status(200).json({
        success: true,
        coveredCount,
        totalCount: filteredAccounts.length,
        withActivity,
        noActivity,
      });
    }

    return res.status(200).json({
      success: true,
      coveredCount,
      totalCount: filteredAccounts.length,
    });
  } catch (err: any) {
    console.error("db-coverage error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to calculate DB coverage",
    });
  }
}
