import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const SPF_TYPES = ["spf - special project", "spf - local", "spf - foreign"];
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
    const Xchire_url  = new URL(req.url);
    const referenceId = Xchire_url.searchParams.get("referenceid");
    const from        = Xchire_url.searchParams.get("from");
    const to          = Xchire_url.searchParams.get("to");

    if (!referenceId) {
      return NextResponse.json({ success: false, error: "Missing reference ID." }, { status: 400 });
    }

    const now = new Date();
    // Derive current month in Manila time
    const manilaToday = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const [mYear, mMonth] = manilaToday.split("-");
    const monthDays = new Date(Number(mYear), Number(mMonth), 0).getDate();
    const manilaMonthStart = `${mYear}-${mMonth}-01`;
    const manilaMonthEnd   = `${mYear}-${mMonth}-${String(monthDays).padStart(2, "0")}`;

    // Default: current month. Manila +08:00 timezone for all bounds.
    const startISO = from ? `${from}T00:00:00+08:00` : `${manilaMonthStart}T00:00:00+08:00`;
    const endISO   = to   ? `${to}T23:59:59.999+08:00` : `${manilaMonthEnd}T23:59:59.999+08:00`;

    let q = supabase
      .from("history")
      .select("so_amount, call_type")
      .eq("referenceid", referenceId)
      .eq("status", "SO-Done")
      .gte("date_created", startISO)
      .lte("date_created", endISO);

    const data = await fetchAllRows(q);

    let totalRegular = 0, totalSPF = 0;
    for (const item of data) {
      const amount   = Number(item.so_amount) || 0;
      const callType = (item.call_type || "").toLowerCase();
      if (SPF_TYPES.includes(callType)) totalSPF += amount;
      else totalRegular += amount;
    }

    return NextResponse.json({ success: true, total: totalRegular + totalSPF, totalRegular, totalSPF }, { status: 200 });
  } catch (Xchire_error: any) {
    console.error("Error fetching history so:", Xchire_error);
    return NextResponse.json({ success: false, error: Xchire_error.message || "Failed to fetch history so." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
