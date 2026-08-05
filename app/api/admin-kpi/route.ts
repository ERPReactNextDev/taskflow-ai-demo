import { NextResponse } from "next/server";

// GET /api/admin-kpi?manager=<id>&from=<date>&to=<date>
// Delegates to manager-kpi with the given manager param.
// The admin selects a manager in the UI, then this proxies to manager-kpi.
export async function GET(req: Request) {
  const url     = new URL(req.url);
  const manager = url.searchParams.get("manager");
  const from    = url.searchParams.get("from");
  const to      = url.searchParams.get("to");

  if (!manager) {
    return NextResponse.json({ success: false, error: "Missing manager." }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ manager });
    if (from) params.append("from", from);
    if (to)   params.append("to",   to);

    // Forward to manager-kpi
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      new URL(req.url).origin;
    const res    = await fetch(`${baseUrl}/api/manager-kpi?${params.toString()}`);
    const data   = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
