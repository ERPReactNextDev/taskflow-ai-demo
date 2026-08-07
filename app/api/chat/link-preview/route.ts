/**
 * GET /api/chat/link-preview?url=...
 * Fetches OG/meta tags for link preview cards.
 * Lightweight server-side scraper (no Edge Function needed for basic OG).
 */

import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS = 5000;

function extractMeta(html: string) {
  const get = (property: string): string => {
    // og: tags
    const ogMatch = html.match(
      new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    if (ogMatch) return ogMatch[1];

    // name= tags
    const nameMatch = html.match(
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    if (nameMatch) return nameMatch[1];

    // content= first variant
    const altOgMatch = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, "i")
    );
    if (altOgMatch) return altOgMatch[1];

    return "";
  };

  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleTag = titleTagMatch ? titleTagMatch[1].trim() : "";

  const title = get("title") || titleTag || "";
  const description = get("description") || "";
  const image = get("image") || "";
  const siteName = get("site_name") || "";

  // Favicon
  const faviconMatch = html.match(
    /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i
  );
  const favicon = faviconMatch ? faviconMatch[1] : "";

  return { title, description, image, siteName, favicon };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return NextResponse.json({ error: "Only HTTP/HTTPS URLs allowed" }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let html = "";
    try {
      const res = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TaskflowBot/1.0)",
          Accept: "text/html",
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        return NextResponse.json({ error: "Could not fetch URL" }, { status: 422 });
      }

      // Only parse first 100KB to limit memory usage
      const text = await res.text();
      html = text.slice(0, 100_000);
    } catch {
      clearTimeout(timer);
      return NextResponse.json({ error: "Fetch timeout or network error" }, { status: 422 });
    }

    const meta = extractMeta(html);

    // Resolve relative favicon URL
    let faviconUrl = meta.favicon;
    if (faviconUrl && !faviconUrl.startsWith("http")) {
      faviconUrl = new URL(faviconUrl, targetUrl.origin).toString();
    }
    if (!faviconUrl) {
      faviconUrl = `${targetUrl.origin}/favicon.ico`;
    }

    return NextResponse.json({
      url: rawUrl,
      title: meta.title || null,
      description: meta.description || null,
      image: meta.image || null,
      favicon: faviconUrl || null,
      site_name: meta.siteName || null,
    });
  } catch (err) {
    console.error("[chat/link-preview]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
