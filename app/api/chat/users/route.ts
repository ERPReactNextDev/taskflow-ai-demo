import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch all active users. id is numeric but we expose it as string.
    // Chat tables store user_id as TEXT matching id.toString()
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, ReferenceID, Firstname, Lastname, Position, Email, profilePicture, Role, Status")
      .not("Status", "in", '("Resigned","Terminated","Inactive")')
      .order("Firstname", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalise: expose id as string so it can be stored in chat user_id text columns
    const users = (data || []).map((u) => ({
      ...u,
      id: u.id?.toString() ?? "",
    }));

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
