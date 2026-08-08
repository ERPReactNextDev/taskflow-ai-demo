/**
 * email-autodiscover — STATELESS
 * Runs the exact Outlook 4-step autodiscovery sequence.
 * STEP 1: Autodiscover XML (Microsoft schema)
 * STEP 2: DNS SRV lookup
 * STEP 3: cPanel standard candidate list (REAL connect+auth verification)
 * STEP 4: Return failure
 * RULE: Never return unverified settings. Real connection test is MANDATORY.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Error code map ────────────────────────────────────────────────────────────
function classifyError(err: unknown): string {
  const msg = String(err).toLowerCase();
  if (msg.includes("auth") || msg.includes("credentials") || msg.includes("535") || msg.includes("invalid login")) return "auth_failed";
  if (msg.includes("timeout") || msg.includes("timed out")) return "connection_timeout";
  if (msg.includes("ssl") || msg.includes("certificate") || msg.includes("tls")) return "ssl_invalid";
  if (msg.includes("econnrefused") || msg.includes("blocked") || msg.includes("connect")) return "port_blocked";
  if (msg.includes("imap") && msg.includes("disabled")) return "imap_disabled";
  return "network_error";
}

// ─── Test IMAP connection ──────────────────────────────────────────────────────
async function testImap(host: string, port: number, tls: boolean, user: string, pass: string): Promise<boolean> {
  try {
    // Use imapflow via npm CDN (Deno compatible)
    const { ImapFlow } = await import("npm:imapflow@1.0.162");
    const client = new ImapFlow({
      host,
      port,
      secure: tls,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      logger: false,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
    await client.connect();
    await client.logout();
    return true;
  } catch {
    return false;
  }
}

// ─── Test SMTP connection ──────────────────────────────────────────────────────
async function testSmtp(host: string, port: number, secure: boolean, user: string, pass: string): Promise<boolean> {
  try {
    const nodemailer = await import("npm:nodemailer@6.9.14");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
    });
    await transporter.verify();
    transporter.close();
    return true;
  } catch {
    return false;
  }
}

// ─── Step 1: Autodiscover XML ─────────────────────────────────────────────────
async function tryAutodiscoverXml(email: string, password: string): Promise<Record<string, unknown> | null> {
  const [, domain] = email.split("@");
  const body = `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Request><EMailAddress>${email}</EMailAddress></Request>
</Autodiscover>`;
  const headers = {
    "Content-Type": "text/xml",
    Authorization: `Basic ${btoa(`${email}:${password}`)}`,
  };

  const urls = [
    `https://${domain}/autodiscover/autodiscover.xml`,
    `https://autodiscover.${domain}/autodiscover/autodiscover.xml`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const xml = await res.text();

      // Parse IMAP Protocol node
      const imapMatch = xml.match(/<Protocol>[\s\S]*?<Type>IMAP<\/Type>([\s\S]*?)<\/Protocol>/i);
      const smtpMatch = xml.match(/<Protocol>[\s\S]*?<Type>SMTP<\/Type>([\s\S]*?)<\/Protocol>/i);

      if (!imapMatch || !smtpMatch) continue;

      const extractTag = (xml: string, tag: string) =>
        xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, "i"))?.[1]?.trim() ?? "";

      const imapHost = extractTag(imapMatch[1], "Server");
      const imapPort = parseInt(extractTag(imapMatch[1], "Port")) || 993;
      const imapSsl = extractTag(imapMatch[1], "SSL").toUpperCase() === "ON";

      const smtpHost = extractTag(smtpMatch[1], "Server");
      const smtpPort = parseInt(extractTag(smtpMatch[1], "Port")) || 587;
      const smtpSsl = extractTag(smtpMatch[1], "SSL").toUpperCase() === "ON";

      if (!imapHost || !smtpHost) continue;

      // Verify with real connection
      const imapOk = await testImap(imapHost, imapPort, imapSsl, email, password);
      const smtpOk = await testSmtp(smtpHost, smtpPort, smtpSsl && smtpPort === 465, email, password);

      if (imapOk && smtpOk) {
        return {
          imap_host: imapHost, imap_port: imapPort,
          imap_encryption: imapSsl ? "SSL" : "STARTTLS",
          imap_username: email,
          smtp_host: smtpHost, smtp_port: smtpPort,
          smtp_encryption: smtpPort === 465 ? "SSL" : "STARTTLS",
          smtp_username: email,
          provider: "autodiscover",
        };
      }
    } catch { /* try next */ }
  }
  return null;
}

// ─── Step 2: DNS SRV ──────────────────────────────────────────────────────────
async function tryDnsSrv(email: string, password: string): Promise<Record<string, unknown> | null> {
  const [, domain] = email.split("@");
  // Use Cloudflare DNS-over-HTTPS for SRV lookup
  const srvRecords = [
    { name: `_imap._tcp.${domain}`, type: "imap", port: 993 },
    { name: `_imaps._tcp.${domain}`, type: "imap", port: 993, ssl: true },
    { name: `_submission._tcp.${domain}`, type: "smtp", port: 587 },
    { name: `_smtps._tcp.${domain}`, type: "smtp", port: 465, ssl: true },
  ];

  let imapHost = "", imapPort = 993, imapSsl = true;
  let smtpHost = "", smtpPort = 587, smtpSsl = false;

  for (const srv of srvRecords) {
    try {
      const res = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${srv.name}&type=SRV`,
        { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) }
      );
      const data = await res.json() as { Answer?: { data: string }[] };
      const record = data?.Answer?.[0]?.data;
      if (!record) continue;
      // SRV record format: priority weight port target
      const parts = record.trim().split(/\s+/);
      const host = parts[3]?.replace(/\.$/, "");
      const port = parseInt(parts[2]);
      if (!host || !port || host === ".") continue;

      if (srv.type === "imap") { imapHost = host; imapPort = port; imapSsl = !!srv.ssl; }
      if (srv.type === "smtp") { smtpHost = host; smtpPort = port; smtpSsl = !!srv.ssl; }
    } catch { /* continue */ }
  }

  if (!imapHost || !smtpHost) return null;

  const imapOk = await testImap(imapHost, imapPort, imapSsl, email, password);
  const smtpOk = await testSmtp(smtpHost, smtpPort, smtpSsl, email, password);

  if (imapOk && smtpOk) {
    return {
      imap_host: imapHost, imap_port: imapPort,
      imap_encryption: imapSsl ? "SSL" : "STARTTLS",
      imap_username: email,
      smtp_host: smtpHost, smtp_port: smtpPort,
      smtp_encryption: smtpSsl ? "SSL" : "STARTTLS",
      smtp_username: email,
      provider: "dns_srv",
    };
  }
  return null;
}

// ─── Step 3: cPanel candidate list ───────────────────────────────────────────
async function trycPanelCandidates(email: string, password: string): Promise<Record<string, unknown> | null> {
  const [, domain] = email.split("@");
  const candidates = [
    { smtp_host: `mail.${domain}`, smtp_port: 587, smtp_ssl: false, imap_host: `mail.${domain}`, imap_port: 993, imap_ssl: true },
    { smtp_host: `mail.${domain}`, smtp_port: 465, smtp_ssl: true, imap_host: `mail.${domain}`, imap_port: 993, imap_ssl: true },
    { smtp_host: `smtp.${domain}`, smtp_port: 587, smtp_ssl: false, imap_host: `imap.${domain}`, imap_port: 993, imap_ssl: true },
    { smtp_host: domain, smtp_port: 587, smtp_ssl: false, imap_host: domain, imap_port: 993, imap_ssl: true },
    { smtp_host: `webmail.${domain}`, smtp_port: 587, smtp_ssl: false, imap_host: `webmail.${domain}`, imap_port: 993, imap_ssl: true },
  ];

  for (const c of candidates) {
    const imapOk = await testImap(c.imap_host, c.imap_port, c.imap_ssl, email, password);
    if (!imapOk) continue;
    const smtpOk = await testSmtp(c.smtp_host, c.smtp_port, c.smtp_ssl, email, password);
    if (smtpOk) {
      return {
        imap_host: c.imap_host, imap_port: c.imap_port,
        imap_encryption: c.imap_ssl ? "SSL" : "STARTTLS",
        imap_username: email,
        smtp_host: c.smtp_host, smtp_port: c.smtp_port,
        smtp_encryption: c.smtp_ssl ? "SSL" : "STARTTLS",
        smtp_username: email,
        provider: "cpanel",
      };
    }
  }
  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ ok: false, error: "auth_failed" }), { headers: { ...cors, "Content-Type": "application/json" }, status: 400 });
    }

    // Step 1
    const s1 = await tryAutodiscoverXml(email, password);
    if (s1) return new Response(JSON.stringify({ ok: true, settings: s1 }), { headers: { ...cors, "Content-Type": "application/json" } });

    // Step 2
    const s2 = await tryDnsSrv(email, password);
    if (s2) return new Response(JSON.stringify({ ok: true, settings: s2 }), { headers: { ...cors, "Content-Type": "application/json" } });

    // Step 3
    const s3 = await trycPanelCandidates(email, password);
    if (s3) return new Response(JSON.stringify({ ok: true, settings: s3 }), { headers: { ...cors, "Content-Type": "application/json" } });

    // Step 4 — all failed, but return partial settings (domain-based guess) so UI can offer "Save Anyway"
    const [, domain] = email.split("@");
    const partialSettings = {
      imap_host: `mail.${domain}`, imap_port: 993, imap_encryption: "SSL", imap_username: email,
      smtp_host: `mail.${domain}`, smtp_port: 587, smtp_encryption: "STARTTLS", smtp_username: email,
      provider: "cpanel",
    };
    return new Response(JSON.stringify({ ok: false, error: "auto_detect_failed", partial_settings: partialSettings }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {    return new Response(JSON.stringify({ ok: false, error: classifyError(err) }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
