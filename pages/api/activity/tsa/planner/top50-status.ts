/**
 * GET /api/activity/tsa/planner/top50-status?referenceid=...
 *
 * Returns:
 *  - top50Accounts: all Top 50 accounts for this agent
 *  - pendingTop50: Top 50 accounts with NO Outbound Call this calendar month
 *  - allClearTop50: boolean — true when all Top 50 are covered
 *  - forecastMap: { [account_reference_number]: { latestSale, forecastAmount, currentMonthSales } }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.TASKFLOW_DB_URL!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { referenceid } = req.query;
  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ error: "Missing referenceid" });
  }

  try {
    // ── 1. Get Top 50 accounts from Neon `accounts` ────────────────────────
    const top50Rows = await sql`
      SELECT account_reference_number, company_name, type_client, status
      FROM accounts
      WHERE referenceid = ${referenceid}
        AND LOWER(type_client) = 'top 50'
        AND LOWER(status) NOT IN ('removed', 'approved for deletion', 'subject for transfer')
    `;

    if (top50Rows.length === 0) {
      return res.status(200).json({
        top50Accounts: [],
        pendingTop50: [],
        allClearTop50: true,
        forecastMap: {},
      });
    }

    const top50RefSet = new Set(top50Rows.map((r: any) => r.account_reference_number).filter(Boolean));

    // ── 2. Check which ones have an Outbound Call this calendar month ──────    // Current month bounds in Manila time
    const now = new Date();
    const manilaStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaStr.split("-");
    const monthStart = `${mYear}-${mMonth}-01`;
    const monthLastDay = new Date(Number(mYear), Number(mMonth), 0).getDate();
    const monthEnd = `${mYear}-${mMonth}-${String(monthLastDay).padStart(2, "0")}`;

    // Fetch history rows: Outbound Touchbase Successful this month for these accounts
    const PAGE_SIZE = 1000;
    const coveredRefs = new Set<string>();
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("history")
        .select("account_reference_number")
        .eq("referenceid", referenceid)
        .eq("source", "Outbound - Touchbase")
        .eq("call_status", "Successful")
        .gte("date_created", `${monthStart}T00:00:00+08:00`)
        .lte("date_created", `${monthEnd}T23:59:59.999+08:00`)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((row: any) => {
        const ref = row.account_reference_number?.trim();
        if (ref && top50RefSet.has(ref)) {
          coveredRefs.add(ref);
        }
      });

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // ── 3. Split into pending vs covered ──────────────────────────────────
    const pendingTop50 = top50Rows.filter(
      (r: any) => r.account_reference_number && !coveredRefs.has(r.account_reference_number.trim())
    );
    const allClearTop50 = pendingTop50.length === 0;

    // ── 4. Forecast — only for pending Top 50 (saves query cost) ─────────
    // Queries ALL history for these accounts (not filtered by referenceid)
    // so we get the full account-level sales history, not just this agent's entries.
    const forecastMap: Record<string, {
      latestSale: number;
      forecastAmount: number;
      currentMonthSales: number;
    }> = {};

    if (pendingTop50.length > 0) {
      const pendingRefs = pendingTop50
        .map((r: any) => r.account_reference_number)
        .filter(Boolean) as string[];

      // Last 3 months bound for frequency check
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

      const CHUNK = 100;
      const allSalesRows: any[] = [];

      for (let i = 0; i < pendingRefs.length; i += CHUNK) {
        const chunk = pendingRefs.slice(i, i + CHUNK);
        let off = 0;
        while (true) {
          const { data, error } = await supabase
            .from("history")
            .select("account_reference_number, actual_sales, delivery_date, date_created")
            .in("account_reference_number", chunk)
            // No referenceid filter — get full account-level history across all agents
            .eq("type_activity", "Delivered / Closed Transaction")
            .gt("actual_sales", 0)
            .order("delivery_date", { ascending: false, nullsFirst: false })
            .range(off, off + PAGE_SIZE - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;
          allSalesRows.push(...data);
          if (data.length < PAGE_SIZE) break;
          off += PAGE_SIZE;
        }
      }

      // Group by account_reference_number
      const salesByRef: Record<string, any[]> = {};
      for (const row of allSalesRows) {
        const ref = row.account_reference_number?.trim();
        if (!ref) continue;
        if (!salesByRef[ref]) salesByRef[ref] = [];
        salesByRef[ref].push(row);
      }

      for (const ref of pendingRefs) {
        const rows = salesByRef[ref] ?? [];

        if (rows.length === 0) {
          forecastMap[ref] = { latestSale: 0, forecastAmount: 0, currentMonthSales: 0 };
          continue;
        }

        // Sort by delivery_date desc (nulls last), fallback to date_created
        rows.sort((a, b) => {
          const da = (a.delivery_date || a.date_created || "").slice(0, 10);
          const db = (b.delivery_date || b.date_created || "").slice(0, 10);
          return db.localeCompare(da);
        });

        // Latest sale = most recent transaction, any time period
        const latestSale = Number(rows[0].actual_sales) || 0;

        // Count transactions in last 3 months for multiplier
        const recentTxCount = rows.filter((r) => {
          const d = (r.delivery_date || r.date_created || "").slice(0, 10);
          return d >= threeMonthsAgoStr;
        }).length;

        // Multiplier: frequent buyer → 1.4, occasional → 1.3, rare → 1.1
        const multiplier = recentTxCount > 3 ? 1.4 : recentTxCount < 2 ? 1.1 : 1.3;
        const forecastAmount = Math.round(latestSale * multiplier);

        // Current month actual sales for progress bar
        const currentMonthSales = rows
          .filter((r) => {
            const d = (r.delivery_date || r.date_created || "").slice(0, 10);
            return d >= monthStart && d <= monthEnd;
          })
          .reduce((sum: number, r: any) => sum + (Number(r.actual_sales) || 0), 0);

        forecastMap[ref] = { latestSale, forecastAmount, currentMonthSales };
      }
    }

    return res.status(200).json({
      top50Accounts: top50Rows,
      pendingTop50,
      allClearTop50,
      forecastMap,
    });
  } catch (err: any) {
    console.error("[top50-status]", err);
    return res.status(500).json({ error: err.message || "Failed to fetch Top 50 status" });
  }
}
