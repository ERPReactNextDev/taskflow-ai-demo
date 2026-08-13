/**
 * GET /api/tsm-top50-priority?tsm=<TSM_REF_ID>
 *
 * Returns all Top 50 clients under the TSM's agents that have
 * NO successful Outbound - Touchbase call this calendar month.
 * Includes forecast data based on previous transactions.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const sql = neon(process.env.TASKFLOW_DB_URL!);

const PAGE_SIZE = 1000;

async function fetchAllRows<T = any>(query: any): Promise<T[]> {
  let all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tsm = url.searchParams.get("tsm");
    if (!tsm) return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });

    // ── 1. Get all active TSAs under this TSM ─────────────────────────────
    const { data: agentRows, error: agentErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("TSM", tsm)
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentErr) throw agentErr;

    const agents = (agentRows ?? []).map((a) => ({
      referenceid: a.ReferenceID as string,
      name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
    }));

    if (agents.length === 0) {
      return NextResponse.json({ success: true, rows: [], agents: [], totalTop50: 0 });
    }

    const agentIds = agents.map((a) => a.referenceid);

    // ── 2. Get ALL Top 50 accounts for these agents from Neon ─────────────
    const agentIdsStr = agentIds.map(String); // ensure all strings
    const top50Rows = await sql`
      SELECT account_reference_number, company_name, type_client, status, referenceid
      FROM accounts
      WHERE referenceid = ANY(${agentIdsStr})
        AND LOWER(type_client) = 'top 50'
        AND LOWER(status) NOT IN ('removed', 'approved for deletion', 'subject for transfer')
      ORDER BY company_name ASC
    `;

    const totalTop50 = top50Rows.length;

    if (totalTop50 === 0) {
      return NextResponse.json({ success: true, rows: [], agents, totalTop50: 0 });
    }

    // ── 3. Check which accounts already have a successful OB call this month ──
    const now = new Date();
    const manilaStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaStr.split("-");
    const monthStart = `${mYear}-${mMonth}-01`;
    const monthLastDay = new Date(Number(mYear), Number(mMonth), 0).getDate();
    const monthEnd = `${mYear}-${mMonth}-${String(monthLastDay).padStart(2, "0")}`;

    const allAccountRefs = top50Rows.map((r: any) => r.account_reference_number).filter(Boolean) as string[];
    const top50RefSet = new Set(allAccountRefs);

    // Query by agent referenceid (not account ref) — each agent's history
    const coveredRefs = new Set<string>();

    const obRows = await fetchAllRows(
      supabase
        .from("history")
        .select("referenceid, account_reference_number")
        .in("referenceid", agentIds)
        .eq("source", "Outbound - Touchbase")
        .eq("call_status", "Successful")
        .gte("date_created", `${monthStart}T00:00:00+08:00`)
        .lte("date_created", `${monthEnd}T23:59:59.999+08:00`)
    );

    obRows.forEach((row: any) => {
      const ref = row.account_reference_number?.trim();
      if (ref && top50RefSet.has(ref)) coveredRefs.add(ref);
    });

    // ── 4. Get last OB call date per account (any time) ───────────────────
    // Chunk allAccountRefs to avoid Supabase .in() limit
    const IN_CHUNK = 200;
    const lastObRows: any[] = [];
    for (let i = 0; i < allAccountRefs.length; i += IN_CHUNK) {
      const chunk = allAccountRefs.slice(i, i + IN_CHUNK);
      const rows = await fetchAllRows(
        supabase
          .from("history")
          .select("account_reference_number, date_created")
          .in("referenceid", agentIds)
          .in("account_reference_number", chunk)
          .eq("source", "Outbound - Touchbase")
          .eq("call_status", "Successful")
          .order("date_created", { ascending: false })
      );
      lastObRows.push(...rows);
    }

    const lastObMap: Record<string, string> = {};
    lastObRows.forEach((row: any) => {
      const ref = row.account_reference_number?.trim();
      if (ref && !lastObMap[ref]) lastObMap[ref] = row.date_created;
    });

    // ── 5. Pending = not in coveredRefs ────────────────────────────────────
    const pendingRows = top50Rows.filter(
      (r: any) => r.account_reference_number && !coveredRefs.has(r.account_reference_number.trim())
    );

    if (pendingRows.length === 0) {
      return NextResponse.json({ success: true, rows: [], agents, totalTop50, clearedCount: totalTop50 });
    }

    const pendingRefs = pendingRows.map((r: any) => r.account_reference_number).filter(Boolean) as string[];

    // ── 6. Fetch sales history for forecast ───────────────────────────────
    // Last 6 months for frequency check
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

    const CHUNK = 100;
    const allSalesRows: any[] = [];

    for (let i = 0; i < pendingRefs.length; i += CHUNK) {
      const chunk = pendingRefs.slice(i, i + CHUNK);
      const rows = await fetchAllRows(
        supabase
          .from("history")
          .select("account_reference_number, actual_sales, delivery_date, date_created")
          .in("account_reference_number", chunk)
          .eq("type_activity", "Delivered / Closed Transaction")
          .gt("actual_sales", 0)
          .order("date_created", { ascending: false })
      );
      allSalesRows.push(...rows);
    }

    // Group sales by account ref
    const salesByRef: Record<string, any[]> = {};
    for (const row of allSalesRows) {
      const ref = row.account_reference_number?.trim();
      if (!ref) continue;
      if (!salesByRef[ref]) salesByRef[ref] = [];
      salesByRef[ref].push(row);
    }

    // ── 7. Build result rows ──────────────────────────────────────────────
    const agentMap = new Map(agents.map((a) => [a.referenceid, a.name]));

    const rows = pendingRows.map((account: any) => {
      const ref = account.account_reference_number?.trim();
      const agentName = agentMap.get(account.referenceid) ?? account.referenceid;
      const lastObDate = lastObMap[ref] ?? null;

      const allSales = (salesByRef[ref] ?? []).sort((a: any, b: any) => {
        const da = (a.delivery_date || a.date_created || "").slice(0, 10);
        const db = (b.delivery_date || b.date_created || "").slice(0, 10);
        return db.localeCompare(da);
      });

      // Last 3 months sales
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const threeMonthsAgoStr = threeMonthsAgo.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

      const last3MonthsSales = allSales.filter((r: any) => {
        const d = (r.delivery_date || r.date_created || "").slice(0, 10);
        return d >= threeMonthsAgoStr;
      });
      const totalSalesLast3Months = last3MonthsSales.reduce((s: number, r: any) => s + (Number(r.actual_sales) || 0), 0);
      const txCountLast3Months = last3MonthsSales.length;

      // Forecast — based on 3 most recent transactions
      const top3 = allSales.slice(0, 3);
      let forecastAmount = 0;

      if (top3.length === 0) {
        forecastAmount = 0;
      } else {
        const baseAmount = top3.reduce((s: number, r: any) => s + (Number(r.actual_sales) || 0), 0) / top3.length;
        const adjustedBase = top3.length === 1 ? baseAmount * 0.9 : baseAmount;

        // Frequency multiplier based on last 6 months
        const recentTxCount = allSales.filter((r: any) => {
          const d = (r.delivery_date || r.date_created || "").slice(0, 10);
          return d >= sixMonthsAgoStr;
        }).length;

        const multiplier = recentTxCount >= 4 ? 1.4 : recentTxCount >= 2 ? 1.2 : 1.0;
        forecastAmount = Math.round((adjustedBase * multiplier) / 100) * 100;
      }

      // Current month SI for progress
      const currentMonthSales = allSales
        .filter((r: any) => {
          const d = (r.delivery_date || r.date_created || "").slice(0, 10);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((s: number, r: any) => s + (Number(r.actual_sales) || 0), 0);

      // Days since last OB call
      const daysSinceLastCall = lastObDate
        ? Math.floor((now.getTime() - new Date(lastObDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Priority score (1–10)
      const forecastScore = forecastAmount > 0 ? Math.min((forecastAmount / 100000) * 5, 5) : 0;
      const callScore = daysSinceLastCall !== null
        ? Math.min((daysSinceLastCall / 30) * 5, 5)
        : 5 + 3; // never called bonus
      const rawScore = forecastScore + callScore;
      const priorityScore = Math.min(Math.max(Math.round(rawScore), 1), 10);

      return {
        account_reference_number: ref,
        company_name: account.company_name,
        agent_referenceid: account.referenceid,
        agent_name: agentName,
        last_ob_date: lastObDate,
        days_since_last_call: daysSinceLastCall,
        total_sales_last3months: totalSalesLast3Months,
        tx_count_last3months: txCountLast3Months,
        forecast_amount: forecastAmount,
        current_month_sales: currentMonthSales,
        priority_score: priorityScore,
      };
    });

    // Sort by priority score desc
    rows.sort((a: any, b: any) => b.priority_score - a.priority_score);

    const clearedCount = totalTop50 - rows.length;

    // ── 8. Build cleared rows (Top 50 that already have OB call this month) ──
    const clearedRows = top50Rows
      .filter((r: any) => r.account_reference_number && coveredRefs.has(r.account_reference_number.trim()))
      .map((account: any) => {
        const ref = account.account_reference_number?.trim();
        const agentName = agentMap.get(account.referenceid) ?? account.referenceid;
        const obDate = lastObMap[ref] ?? null;
        return {
          account_reference_number: ref,
          company_name: account.company_name,
          agent_referenceid: account.referenceid,
          agent_name: agentName,
          ob_date_this_month: obDate,
        };
      })
      .sort((a: any, b: any) => a.company_name.localeCompare(b.company_name));

    return NextResponse.json({ success: true, rows, clearedRows, agents, totalTop50, clearedCount });
  } catch (err: any) {
    console.error("[tsm-top50-priority] Error:", err?.message ?? err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch Top 50 priority data." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
