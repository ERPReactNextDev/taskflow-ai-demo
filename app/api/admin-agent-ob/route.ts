import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
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

// GET /api/admin-agent-ob?year=2026
// Returns OB call counts for ALL active TSAs, grouped by Manager → TSM.
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const year = url.searchParams.get("year") ?? new Date().getFullYear().toString();

    // 1. All active TSAs with their TSM and Manager
    const { data: agents, error: agentsErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname, TSM, Manager")
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentsErr) throw agentsErr;
    if (!agents || agents.length === 0) {
      return NextResponse.json({ success: true, groups: [], obMap: {}, totalAgents: 0 }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);
    const yearStart = `${year}-01-01T00:00:00Z`;
    const yearEnd   = `${year}-12-31T23:59:59Z`;

    // 2. Fetch all OB records for the year
    const obRows = await fetchAllRows(
      supabase
        .from("history")
        .select("referenceid, date_created")
        .in("referenceid", agentIds)
        .eq("source", "Outbound - Touchbase")
        .gte("date_created", yearStart)
        .lte("date_created", yearEnd)
    );

    // 3. Build obMap: { [referenceid]: { [month]: count } }
    const obMap: Record<string, Record<string, number>> = {};
    for (const row of obRows) {
      const ref   = row.referenceid;
      const month = MONTHS[new Date(row.date_created).getMonth()];
      if (!obMap[ref])        obMap[ref] = {};
      if (!obMap[ref][month]) obMap[ref][month] = 0;
      obMap[ref][month]++;
    }

    // 4. Resolve TSM and Manager display names
    const tsmIds     = [...new Set(agents.map((a) => a.TSM).filter(Boolean))];
    const managerIds = [...new Set(agents.map((a) => a.Manager).filter(Boolean))];
    const { data: userNames } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .in("ReferenceID", [...new Set([...tsmIds, ...managerIds])]);

    const nameMap: Record<string, string> = {};
    for (const u of userNames ?? []) {
      nameMap[u.ReferenceID] = `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim();
    }

    // 5. Build grouped structure: Manager → TSM → Agents[]
    type AgentRow    = { referenceid: string; name: string };
    type TSMGroup    = { tsmId: string; tsmName: string; agents: AgentRow[] };
    type ManagerGroup = { managerId: string; managerName: string; tsms: TSMGroup[] };

    const grouped: Record<string, ManagerGroup> = {};
    for (const a of agents) {
      const referenceid = a.ReferenceID;
      const name        = `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim();
      const tsmId       = a.TSM     ?? "UNASSIGNED_TSM";
      const managerId   = a.Manager ?? "UNASSIGNED_MANAGER";
      const tsmName     = nameMap[tsmId]     ?? tsmId;
      const managerName = nameMap[managerId] ?? managerId;

      if (!grouped[managerId]) grouped[managerId] = { managerId, managerName, tsms: [] };
      let tsmGroup = grouped[managerId].tsms.find((t) => t.tsmId === tsmId);
      if (!tsmGroup) { tsmGroup = { tsmId, tsmName, agents: [] }; grouped[managerId].tsms.push(tsmGroup); }
      tsmGroup.agents.push({ referenceid, name });
    }

    const groups = Object.values(grouped).sort((a, b) => a.managerName.localeCompare(b.managerName));

    return NextResponse.json(
      { success: true, groups, obMap, months: MONTHS, year, totalAgents: agents.length },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("admin-agent-ob GET error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
