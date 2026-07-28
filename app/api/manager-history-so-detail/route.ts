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

interface AgentInfo { referenceid: string; name: string; }

async function getAgentsUnderManager(manager: string): Promise<AgentInfo[]> {
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
    .select("ReferenceID, Firstname, Lastname")
    .in("TSM", tsmIds)
    .eq("Role", "Territory Sales Associate")
    .not("Status", "in", '("Resigned","Terminated","Inactive")')
    .order("Lastname", { ascending: true });

  return (agents ?? []).map((a) => ({
    referenceid: a.ReferenceID,
    name: `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim(),
  }));
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

    const agents = await getAgentsUnderManager(manager);
    if (agents.length === 0) {
      return NextResponse.json({ success: true, rows: [] }, { status: 200 });
    }

    const agentIds   = agents.map((a) => a.referenceid);
    const nameMap    = Object.fromEntries(agents.map((a) => [a.referenceid, a.name]));

    const now        = new Date();
    const manilaYear = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);
    const startISO   = from ? `${from}T00:00:00+08:00` : `${manilaYear}-01-01T00:00:00+08:00`;
    const endISO     = to   ? `${to}T23:59:59.999+08:00` : null;

    let q = supabase
      .from("history")
      .select("referenceid, so_amount, call_type")
      .in("referenceid", agentIds)
      .eq("status", "SO-Done")
      .gte("date_created", startISO);
    if (endISO) q = q.lte("date_created", endISO);

    const records = await fetchAllRows(q);

    // Aggregate per agent
    const byAgent: Record<string, { regular: number; spf: number }> = {};
    for (const r of records) {
      const id       = r.referenceid;
      const amount   = Number(r.so_amount) || 0;
      const callType = (r.call_type || "").toLowerCase();
      if (!byAgent[id]) byAgent[id] = { regular: 0, spf: 0 };
      if (SPF_TYPES.includes(callType)) byAgent[id].spf += amount;
      else byAgent[id].regular += amount;
    }

    const rows = Object.entries(byAgent)
      .map(([id, v]) => ({
        referenceid: id,
        name:    nameMap[id] ?? id,
        regular: v.regular,
        spf:     v.spf,
        total:   v.regular + v.spf,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ success: true, rows }, { status: 200 });
  } catch (err: any) {
    console.error("manager-history-so-detail GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
