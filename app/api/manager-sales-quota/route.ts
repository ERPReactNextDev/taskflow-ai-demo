import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

/** Get all TSA ReferenceIDs under a manager (via TSMs → TSAs) */
async function getAgentIds(manager: string): Promise<string[]> {
  // Step 1: Get all TSMs under this manager
  const { data: tsms } = await supabase
    .from("users")
    .select("ReferenceID")
    .eq("Manager", manager)
    .eq("Role", "Territory Sales Manager")
    .not("Status", "in", '("Resigned","Terminated","Inactive")');

  if (!tsms || tsms.length === 0) return [];

  const tsmIds = tsms.map((t) => t.ReferenceID);

  // Step 2: Get all TSAs under those TSMs
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
    const year    = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    if (!manager) {
      return NextResponse.json(
        { success: false, error: "Missing manager parameter." },
        { status: 400 }
      );
    }

    const agentIds = await getAgentIds(manager);
    if (agentIds.length === 0) {
      return NextResponse.json({ success: true, total: 0 }, { status: 200 });
    }

    const { data: quotaData, error: quotaError } = await supabase
      .from("sales_quota")
      .select("amount")
      .in("referenceid", agentIds)
      .eq("year", year);

    if (quotaError) throw quotaError;

    const total = (quotaData ?? []).reduce(
      (sum, row) => sum + (Number(row.amount) || 0),
      0
    );

    return NextResponse.json({ success: true, total }, { status: 200 });
  } catch (err: any) {
    console.error("manager-sales-quota GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch manager sales quota." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
