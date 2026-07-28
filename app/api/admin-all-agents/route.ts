import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// GET /api/admin-all-agents
// Returns all active TSAs grouped by manager → TSM for the admin quota settings page.
export async function GET() {
  try {
    // Get all active TSAs with their TSM and Manager fields
    const { data: agents, error: agentErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname, TSM, Manager")
      .eq("Role", "Territory Sales Associate")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (agentErr) throw agentErr;

    // Get all active TSMs
    const { data: tsms, error: tsmErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname, Manager")
      .eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (tsmErr) throw tsmErr;

    // Get all active Managers
    const { data: managers, error: mgrErr } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("Role", "Manager")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (mgrErr) throw mgrErr;

    // Build lookup maps
    const tsmMap: Record<string, { name: string; manager: string }> = {};
    for (const t of tsms ?? []) {
      tsmMap[t.ReferenceID] = {
        name: `${t.Firstname ?? ""} ${t.Lastname ?? ""}`.trim(),
        manager: t.Manager ?? "",
      };
    }

    const managerMap: Record<string, string> = {};
    for (const m of managers ?? []) {
      managerMap[m.ReferenceID] = `${m.Firstname ?? ""} ${m.Lastname ?? ""}`.trim();
    }

    // Build grouped structure: manager → tsm → agents[]
    type AgentRow = { referenceid: string; name: string };
    type TSMGroup = { tsmId: string; tsmName: string; agents: AgentRow[] };
    type ManagerGroup = { managerId: string; managerName: string; tsms: TSMGroup[] };

    const grouped: Record<string, ManagerGroup> = {};
    const allAgentRows: AgentRow[] = [];

    for (const a of agents ?? []) {
      const referenceid = a.ReferenceID;
      const name = `${a.Firstname ?? ""} ${a.Lastname ?? ""}`.trim();
      const tsmId = a.TSM ?? "UNASSIGNED_TSM";
      const tsmName = tsmMap[tsmId]?.name ?? tsmId;
      const managerId = tsmMap[tsmId]?.manager ?? a.Manager ?? "UNASSIGNED_MANAGER";
      const managerName = managerMap[managerId] ?? managerId;

      if (!grouped[managerId]) {
        grouped[managerId] = { managerId, managerName, tsms: [] };
      }

      let tsmGroup = grouped[managerId].tsms.find((t) => t.tsmId === tsmId);
      if (!tsmGroup) {
        tsmGroup = { tsmId, tsmName, agents: [] };
        grouped[managerId].tsms.push(tsmGroup);
      }

      tsmGroup.agents.push({ referenceid, name });
      allAgentRows.push({ referenceid, name });
    }

    const result = Object.values(grouped).sort((a, b) =>
      a.managerName.localeCompare(b.managerName)
    );

    return NextResponse.json(
      { success: true, groups: result, totalAgents: allAgentRows.length },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("admin-all-agents GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
