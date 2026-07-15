import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

export async function GET(req: Request) {
  try {
    const url     = new URL(req.url);
    const manager = url.searchParams.get("manager");

    if (!manager) {
      return NextResponse.json(
        { success: false, error: "Missing manager parameter." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("users")
      .select("ReferenceID, Firstname, Lastname")
      .eq("Manager", manager)
      .eq("Role", "Territory Sales Manager")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Lastname", { ascending: true });

    if (error) throw error;

    const tsms = (data ?? []).map((t) => ({
      referenceid: t.ReferenceID,
      name: `${t.Firstname ?? ""} ${t.Lastname ?? ""}`.trim(),
    }));

    return NextResponse.json({ success: true, tsms }, { status: 200 });
  } catch (err: any) {
    console.error("manager-fetch-tsms GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch TSMs." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
