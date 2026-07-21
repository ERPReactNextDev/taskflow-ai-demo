import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// GET /api/manager-account-development-plans-list?manager=<referenceid>&search=<term>
export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");
    const search  = url.searchParams.get("search") ?? "";

    if (!manager) {
      return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
    }

    let query = supabase
      .from("account_development_plans")
      .select(
        "id, customer_name, account_manager, status, created_at, referenceid, tsm, " +
        "key_contacts, business_objectives, growth_opportunities, action_items, " +
        "project_pipeline, competitors, risks, kpis, projects, product_offering, account_summary"
      )
      .eq("manager", manager)
      .order("created_at", { ascending: false });

    if (search.trim()) {
      query = query.or(
        `customer_name.ilike.%${search.trim()}%,account_manager.ilike.%${search.trim()}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<{
      id: any;
      customer_name: string | null;
      account_manager: string | null;
      status: string | null;
      created_at: string | null;
      referenceid: string | null;
      tsm: string | null;
      [key: string]: any;
    }>;

    // Enrich with TSA name and TSM name from users table
    const referenceIds = [...new Set(rows.map((p) => p.referenceid).filter(Boolean))] as string[];
    const tsmIds       = [...new Set(rows.map((p) => p.tsm).filter(Boolean))] as string[];
    const allIds       = [...new Set([...referenceIds, ...tsmIds])];

    let userMap: Record<string, string> = {};
    if (allIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("ReferenceID, Firstname, Lastname")
        .in("ReferenceID", allIds);

      for (const u of users ?? []) {
        userMap[u.ReferenceID] = `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim();
      }
    }

    const plans = rows.map((p) => ({
      ...p,
      agent_name: userMap[p.referenceid ?? ""] ?? p.referenceid ?? "-",
      tsm_name:   userMap[p.tsm ?? ""]         ?? p.tsm         ?? "-",
    }));

    return NextResponse.json({ success: true, plans }, { status: 200 });
  } catch (err: any) {
    console.error("manager-account-development-plans-list GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
