/**
 * Server-side IMAP/SMTP helpers using imapflow + nodemailer.
 * These run in Next.js API routes — NOT in Supabase Edge Functions.
 * All connections are opened, used, and closed per request (stateless).
 */

// This file must only be imported from server-side code (API routes).
// imapflow and nodemailer require Node.js built-ins: net, tls, dns, child_process.

import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

// ─── Error classifier ─────────────────────────────────────────────────────────
export function classifyEmailError(err: unknown): string {
  const msg = String(err).toLowerCase();
  if (msg.includes("auth") || msg.includes("535") || msg.includes("invalid login") || msg.includes("credentials")) return "auth_failed";
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout")) return "connection_timeout";
  if (msg.includes("ssl") || msg.includes("certificate") || msg.includes("self-signed")) return "ssl_invalid";
  if (msg.includes("econnrefused") || msg.includes("connect econnrefused")) return "port_blocked";
  if (msg.includes("imap") && msg.includes("disabled")) return "imap_disabled";
  if (msg.includes("rate") || msg.includes("limit") || msg.includes("550") || msg.includes("quota")) return "send_limit_reached";
  return "network_error";
}

// ─── Create IMAP client ───────────────────────────────────────────────────────
export function createImapClient(opts: {
  host: string; port: number; encryption: string;
  user: string; pass: string; timeout?: number;
}) {
  return new ImapFlow({
    host: opts.host,
    port: opts.port,
    secure: opts.encryption === "SSL",
    auth: { user: opts.user, pass: opts.pass },
    tls: { rejectUnauthorized: false },
    logger: false,
    connectionTimeout: opts.timeout ?? 12000,
    greetingTimeout: opts.timeout ?? 12000,
  });
}

// ─── Test IMAP ────────────────────────────────────────────────────────────────
export async function testImap(host: string, port: number, encryption: string, user: string, pass: string): Promise<boolean> {
  const client = createImapClient({ host, port, encryption, user, pass, timeout: 8000 });
  try {
    await client.connect();
    await client.logout();
    return true;
  } catch {
    return false;
  }
}

// ─── Test SMTP ────────────────────────────────────────────────────────────────
export async function testSmtp(host: string, port: number, encryption: string, user: string, pass: string): Promise<boolean> {
  const transporter = nodemailer.createTransport({
    host, port,
    secure: encryption === "SSL",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
  });
  try {
    await transporter.verify();
    transporter.close();
    return true;
  } catch {
    return false;
  }
}

// ─── Autodiscover XML ─────────────────────────────────────────────────────────
export async function tryAutodiscoverXml(email: string, password: string): Promise<Record<string, unknown> | null> {
  const [, domain] = email.split("@");
  const body = `<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Request><EMailAddress>${email}</EMailAddress></Request>
</Autodiscover>`;

  const urls = [
    `https://${domain}/autodiscover/autodiscover.xml`,
    `https://autodiscover.${domain}/autodiscover/autodiscover.xml`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`,
        },
        body,
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const extractTag = (str: string, tag: string) =>
        str.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, "i"))?.[1]?.trim() ?? "";

      const imapMatch = xml.match(/<Protocol>[\s\S]*?<Type>IMAP<\/Type>([\s\S]*?)<\/Protocol>/i);
      const smtpMatch = xml.match(/<Protocol>[\s\S]*?<Type>SMTP<\/Type>([\s\S]*?)<\/Protocol>/i);
      if (!imapMatch || !smtpMatch) continue;

      const imapHost = extractTag(imapMatch[1], "Server");
      const imapPort = parseInt(extractTag(imapMatch[1], "Port")) || 993;
      const imapSsl = extractTag(imapMatch[1], "SSL").toUpperCase() === "ON";
      const smtpHost = extractTag(smtpMatch[1], "Server");
      const smtpPort = parseInt(extractTag(smtpMatch[1], "Port")) || 587;
      const smtpSsl = smtpPort === 465;

      if (!imapHost || !smtpHost) continue;

      const [imapOk, smtpOk] = await Promise.all([
        testImap(imapHost, imapPort, imapSsl ? "SSL" : "STARTTLS", email, password),
        testSmtp(smtpHost, smtpPort, smtpSsl ? "SSL" : "STARTTLS", email, password),
      ]);
      if (imapOk && smtpOk) {
        return {
          imap_host: imapHost, imap_port: imapPort, imap_encryption: imapSsl ? "SSL" : "STARTTLS", imap_username: email,
          smtp_host: smtpHost, smtp_port: smtpPort, smtp_encryption: smtpSsl ? "SSL" : "STARTTLS", smtp_username: email,
          provider: "autodiscover",
        };
      }
    } catch { /* try next */ }
  }
  return null;
}

// ─── cPanel candidate list ────────────────────────────────────────────────────
export async function trycPanelCandidates(email: string, password: string): Promise<Record<string, unknown> | null> {
  const [, domain] = email.split("@");
  const candidates = [
    { smtp_host: `mail.${domain}`, smtp_port: 587, smtp_enc: "STARTTLS", imap_host: `mail.${domain}`, imap_port: 993, imap_enc: "SSL" },
    { smtp_host: `mail.${domain}`, smtp_port: 465, smtp_enc: "SSL",      imap_host: `mail.${domain}`, imap_port: 993, imap_enc: "SSL" },
    { smtp_host: `smtp.${domain}`, smtp_port: 587, smtp_enc: "STARTTLS", imap_host: `imap.${domain}`, imap_port: 993, imap_enc: "SSL" },
    { smtp_host: domain,           smtp_port: 587, smtp_enc: "STARTTLS", imap_host: domain,           imap_port: 993, imap_enc: "SSL" },
    { smtp_host: `webmail.${domain}`, smtp_port: 587, smtp_enc: "STARTTLS", imap_host: `webmail.${domain}`, imap_port: 993, imap_enc: "SSL" },
  ];

  for (const c of candidates) {
    const [imapOk, smtpOk] = await Promise.all([
      testImap(c.imap_host, c.imap_port, c.imap_enc, email, password),
      testSmtp(c.smtp_host, c.smtp_port, c.smtp_enc, email, password),
    ]);
    if (imapOk && smtpOk) {
      return {
        imap_host: c.imap_host, imap_port: c.imap_port, imap_encryption: c.imap_enc, imap_username: email,
        smtp_host: c.smtp_host, smtp_port: c.smtp_port, smtp_encryption: c.smtp_enc, smtp_username: email,
        provider: "cpanel",
      };
    }
  }
  return null;
}
