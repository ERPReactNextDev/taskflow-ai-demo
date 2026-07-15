import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

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
      return NextResponse.json({ success: true, count: 0 }, { status: 200 });
    }

    const now        = new Date();
    const manilaMonth = now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 7);
    const startISO    = from ? `${from}T00:00:00+08:00` : `${manilaMonth}-01T00:00:00+08:00`;
    const endISO      = to   ? `${to}T23:59:59.999+08:00` : (from ? `${from}T23:59:59.999+08:00` : null);

    let q = supabase
      .from("history")
      .select("id", { count: "exact", head: true })
      .in("referenceid", agentIds)
      .eq("source", "Outbound - Touchbase")
      .gte("date_created", startISO);
    if (endISO) q = q.lte("date_created", endISO);

    const { count, error } = await q;
    if (error) throw error;

    return NextResponse.json({ success: true, count: count || 0 }, { status: 200 });
  } catch (err: any) {
    console.error("manager-history-outbound GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
