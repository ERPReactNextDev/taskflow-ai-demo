/**
 * Supabase Edge Function: chat-link-preview
 * Fetches OG/meta tags for a URL and returns a link preview card payload.
 * Called from the client when a message contains a URL.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractMeta(html: string) {
  const get = (prop: string): string => {
    const ogMatch = html.match(
      new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    if (ogMatch) return ogMatch[1];
    const nameMatch = html.match(
      new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    if (nameMatch) return nameMatch[1];
    return "";
  };

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
  const faviconMatch = html.match(
    /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i
  );

  return {
    title: get("title") || titleTag || "",
    description: get("description") || "",
    image: get("image") || "",
    siteName: get("site_name") || "",
    favicon: faviconMatch?.[1] || "",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return new Response(JSON.stringify({ error: "Only HTTP/HTTPS" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    let html = "";
    try {
      const res = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "TaskflowBot/1.0", Accept: "text/html" },
      });
      clearTimeout(timer);
      const text = await res.text();
      html = text.slice(0, 100_000);
    } catch {
      clearTimeout(timer);
      return new Response(JSON.stringify({ error: "Fetch failed" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = extractMeta(html);
    let faviconUrl = meta.favicon;
    if (faviconUrl && !faviconUrl.startsWith("http")) {
      faviconUrl = new URL(faviconUrl, targetUrl.origin).toString();
    }
    if (!faviconUrl) faviconUrl = `${targetUrl.origin}/favicon.ico`;

    return new Response(
      JSON.stringify({
        url,
        title: meta.title || null,
        description: meta.description || null,
        image: meta.image || null,
        favicon: faviconUrl || null,
        site_name: meta.siteName || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
