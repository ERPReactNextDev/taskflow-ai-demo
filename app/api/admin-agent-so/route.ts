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

function manilaMonthIndex(dateStr: string): number {
  return parseInt(
    new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).split("-")[1],
    10
  ) - 1;
}

// GET /api/admin-agent-so?year=2026
export async function GET(req: Request) {
  try {
    const url  = new URL(req.url);
    const year = url.searchParams.get("year") ??
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4);

    // 1. All active TSAs with their TSM and Manager
    const { data: agents, error: agentsErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname, TSM, Manager")
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentsErr) throw agentsErr;
    if (!agents || agents.length === 0) {
      return NextResponse.json({ success: true, groups: [], soMap: {}, totalAgents: 0 }, { status: 200 });
    }

    const agentIds = agents.map((a) => a.ReferenceID);

    // 2. Fetch SO records for the year
    const startISO = `${year}-01-01T00:00:00+08:00`;
    const endISO   = `${year}-12-31T23:59:59.999+08:00`;

    const soRows = await fetchAllRows(
      supabase
        .from("history")
        .select("referenceid, so_amount, call_type, date_created")
        .in("referenceid", agentIds)
        .eq("status", "SO-Done")
        .gte("date_created", startISO)
        .lte("date_created", endISO)
    );

    // 3. Build soMap: { [referenceid]: { [month]: { regular, spf, total } } }
    const soMap: Record<string, Record<string, { regular: number; spf: number; total: number }>> = {};
    for (const row of soRows) {
      const ref   = row.referenceid;
      const month = MONTHS[manilaMonthIndex(row.date_created)];
      const amt   = Number(row.so_amount) || 0;
      const isSpf = SPF_TYPES.includes((row.call_type || "").toLowerCase());
      if (!soMap[ref])        soMap[ref] = {};
      if (!soMap[ref][month]) soMap[ref][month] = { regular: 0, spf: 0, total: 0 };
      if (isSpf) soMap[ref][month].spf     += amt;
      else        soMap[ref][month].regular += amt;
      soMap[ref][month].total += amt;
    }

    // 4. Resolve TSM and Manager names
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

    // 5. Build grouped structure
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
      { success: true, groups, soMap, months: MONTHS, year, totalAgents: agents.length },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("admin-agent-so GET error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to fetch." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
