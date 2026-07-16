import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// GET /api/tsm-account-development-plans-list?tsm=<referenceid>&search=<term>
export async function GET(req: Request) {
  try {
    const url    = new URL(req.url);
    const tsm    = url.searchParams.get("tsm");
    const search = url.searchParams.get("search") ?? "";

    if (!tsm) {
      return NextResponse.json({ success: false, error: "Missing tsm." }, { status: 400 });
    }

    let query = supabase
      .from("account_development_plans")
      .select(
        "id, customer_name, account_manager, status, created_at, referenceid, " +
        "key_contacts, business_objectives, growth_opportunities, action_items, " +
        "project_pipeline, competitors, risks, kpis, projects, product_offering, account_summary"
      )
      .eq("tsm", tsm)
      .order("created_at", { ascending: false });

    if (search.trim()) {
      query = query.or(
        `customer_name.ilike.%${search.trim()}%,account_manager.ilike.%${search.trim()}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enrich each plan with the TSA's full name from the users table
    const referenceIds = [...new Set((data ?? []).map((p) => p.referenceid).filter(Boolean))];

    let agentMap: Record<string, string> = {};
    if (referenceIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("ReferenceID, Firstname, Lastname")
        .in("ReferenceID", referenceIds);

      for (const u of users ?? []) {
        agentMap[u.ReferenceID] = `${u.Firstname ?? ""} ${u.Lastname ?? ""}`.trim();
      }
    }

    const plans = (data ?? []).map((p) => ({
      ...p,
      agent_name: agentMap[p.referenceid] ?? p.referenceid ?? "-",
    }));

    return NextResponse.json({ success: true, plans }, { status: 200 });
  } catch (err: any) {
    console.error("tsm-account-development-plans-list GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
