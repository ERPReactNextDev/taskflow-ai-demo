import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!
);

// ─── GET — fetch edit requests ───────────────────────────────────────────────
// ?tsm_reference_id=X   → latest active request for one TSM
// ?manager_reference_id=X → all pending/approved requests under this manager's TSMs
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tsm_reference_id     = searchParams.get("tsm_reference_id");
  const manager_reference_id = searchParams.get("manager_reference_id");

  // ── Manager view: all pending requests across all TSMs under this manager ──
  if (manager_reference_id) {
    try {
      const { data, error } = await supabase
        .from("quotation_edit_requests")
        .select("*")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      const now = new Date();
      const results = [];

      for (const row of data ?? []) {
        const expiresAt = new Date(new Date(row.created_at).getTime() + 24 * 60 * 60 * 1000);
        const isExpired = now > expiresAt;

        if (isExpired) {
          // Auto-expire silently
          await supabase
            .from("quotation_edit_requests")
            .update({ status: "expired" })
            .eq("id", row.id);
          continue;
        }

        results.push({ ...row, expires_at: expiresAt.toISOString() });
      }

      return NextResponse.json({ success: true, requests: results });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // ── TSM view: latest active request for one TSM ───────────────────────────
  if (!tsm_reference_id) {
    return NextResponse.json({ success: false, error: "Missing tsm_reference_id or manager_reference_id" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("quotation_edit_requests")
      .select("*")
      .eq("tsm_reference_id", tsm_reference_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ success: true, request: null });
    }

    // Check if expired (more than 1 day old)
    const createdAt = new Date(data.created_at);
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const isExpired = now > expiresAt;

    // If expired and not already marked, auto-expire it
    if (isExpired && data.status !== "expired") {
      await supabase
        .from("quotation_edit_requests")
        .update({ status: "expired" })
        .eq("id", data.id);

      return NextResponse.json({
        success: true,
        request: { ...data, status: "expired", expires_at: expiresAt.toISOString() },
      });
    }

    return NextResponse.json({
      success: true,
      request: { ...data, expires_at: expiresAt.toISOString() },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── POST — submit a new edit request ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tsm_reference_id, requester_name, remarks } = body;

    if (!tsm_reference_id || !requester_name || !remarks?.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: tsm_reference_id, requester_name, remarks" },
        { status: 400 }
      );
    }

    // Check if there's already an active (pending/approved) non-expired request
    const { data: existing } = await supabase
      .from("quotation_edit_requests")
      .select("id, created_at, status")
      .eq("tsm_reference_id", tsm_reference_id)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const expiresAt = new Date(new Date(existing.created_at).getTime() + 24 * 60 * 60 * 1000);
      if (new Date() < expiresAt) {
        return NextResponse.json(
          { success: false, error: "An active edit request already exists." },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from("quotation_edit_requests")
      .insert({
        tsm_reference_id,
        requester_name,
        remarks: remarks.trim(),
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, request: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── PATCH — approve or reject a request (for manager/admin use) ─────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, approved_by } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: "Missing id or status" }, { status: 400 });
    }

    const { error } = await supabase
      .from("quotation_edit_requests")
      .update({ status, approved_by: approved_by ?? null, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
