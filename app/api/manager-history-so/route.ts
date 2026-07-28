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

/** Get all TSA ReferenceIDs under a manager (via TSMs → TSAs) */
async function getAgentIds(manager: string): Promise<string[]> {
  const { data: tsms } = await supabase
    .from("users")
    .select("ReferenceID")
    .eq("Manager", manager)
    .eq("Role", "Territory Sales Manager")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');

  if (!tsms || tsms.length === 0) return [];
  const tsmIds = tsms.map((t) => t.ReferenceID);

  const { data: agents } = await supabase
    .from("users")
    .select("ReferenceID")
    .in("TSM", tsmIds)
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');

  return (agents ?? []).map((a) => a.ReferenceID);
}

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const from    = url.searchParams.get("from");
    const to      = url.searchParams.get("to");

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    const agentIds = await getAgentIds(manager);
    if (agentIds.length === 0) {
      return NextResponse.json({ success: true, total: 0, totalRegular: 0, totalSPF: 0 }, { status: 200 });
    }

    const now      = new Date();
    const manilaYear = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);
    const startISO   = from ? `${from}T00:00:00+08:00` : `${manilaYear}-01-01T00:00:00+08:00`;
    const endISO     = to   ? `${to}T23:59:59.999+08:00` : null;

    let q = supabase
      .from("history")
      .select("so_amount, call_type")
      .in("referenceid", agentIds)
      .eq("status", "SO-Done")
      .gte("date_created", startISO);
    if (endISO) q = q.lte("date_created", endISO);

    const data = await fetchAllRows(q);

    let totalRegular = 0, totalSPF = 0;
    for (const item of data) {
      const amount   = Number(item.so_amount) || 0;
      const callType = (item.call_type || "").toLowerCase();
      if (SPF_TYPES.includes(callType)) totalSPF += amount;
      else totalRegular += amount;
    }

    return NextResponse.json(
      { success: true, total: totalRegular + totalSPF, totalRegular, totalSPF },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("manager-history-so GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
