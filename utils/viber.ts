/**
 * Viber Deep-Link Utilities
 * Uses ONLY official viber:// protocol — no API, no iframe, no external calls.
 */

/** Viber brand purple */
export const VIBER_COLOR = "#7360F2";

/**
 * Convert ANY PH number format to Viber standard: 63 + 10 digits.
 * Accepts: 09171234567 / +639171234567 / 9171234567 / (0917) 123-4567 / "0917 123 4567"
 * Returns: "639171234567" or null if invalid.
 */
export function formatViberNumber(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, "");
  if (digits.length === 10) return `63${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `63${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("63")) return digits;
  return null;
}

/**
 * Open official Viber app (desktop/mobile) directly to a specific contact.
 * Optional: pre-fill a message in Viber's input box (user still presses Send).
 */
export function openViberChat(rawPhone: string | null | undefined, prefilledText?: string | null): void {
  const viberNumber = formatViberNumber(rawPhone);
  if (!viberNumber) {
    alert("Invalid phone number. Please check the client record.");
    return;
  }

  let url = `viber://chat?number=${viberNumber}`;
  if (prefilledText) {
    url += `&text=${encodeURIComponent(prefilledText)}`;
  }

  window.location.href = url;

  // Fallback notice if Viber doesn't respond
  setTimeout(() => {
    window.confirm(
      "Opening Viber… If nothing happened, make sure Viber is installed on this device."
    );
  }, 1200);
}

/**
 * Viber sales message templates.
 * Variables: {{client}}, {{agent}}, {{agent_viber}}
 */
export const VIBER_TEMPLATES = [
  {
    id: 1,
    label: "📄 Quotation Follow-Up",
    text: "Hi {{client}}! Follow up ko lang po yung quotation na sinend ko kahapon. Available po ako anytime para sa questions niyo. Salamat! — {{agent}}",
  },
  {
    id: 2,
    label: "💰 Payment Reminder",
    text: "Good day {{client}}! Gentle reminder lang po tungkol sa invoice na due ngayong araw. Pakitignan na lang po. Maraming salamat!",
  },
  {
    id: 3,
    label: "📅 Meeting Confirmation",
    text: "Hi {{client}}! Confirm ko lang po ang meeting natin bukas 10AM sa inyong office. See you po! — {{agent}}",
  },
  {
    id: 4,
    label: "🚚 Delivery Update",
    text: "Hi {{client}}! Update lang po: ready na for delivery ang order niyo ngayong araw. Text lang po kayo kung may changes. Salamat!",
  },
  {
    id: 5,
    label: "✅ Thank You After Meeting",
    text: "Hi {{client}}! Thank you po sa oras niyo kanina. I-sesend ko po ang detailed proposal by EOD. Usap tayo ulit bukas! — {{agent}}",
  },
  {
    id: 6,
    label: "❓ Quick Check-In",
    text: "Hi {{client}}! Kumusta na po yung project natin? May kailangan po ba kayo sa amin this week?",
  },
  {
    id: 7,
    label: "🆕 Cold Outreach",
    text: "Good day {{client}}! Ako po si {{agent}}. Naghahanap po ba kayo ng mas mura at mabilis na supplier? Pwede ko po kayong bigyan ng free quote ngayong araw. Viber niyo lang po ako dito: {{agent_viber}}. Salamat!",
  },
] as const;

/**
 * Replace template variables with actual values.
 */
export function fillTemplate(
  template: string,
  vars: { client?: string; agent?: string; agentViber?: string }
): string {
  return template
    .replace(/{{client}}/g, vars.client || "")
    .replace(/{{agent}}/g, vars.agent || "")
    .replace(/{{agent_viber}}/g, vars.agentViber || "");
}

/**
 * Get first valid phone from a contact_number field
 * which may be a JSON array string or a comma-separated string.
 */
export function extractFirstPhone(contactNumber: string | string[] | null | undefined): string | null {
  if (!contactNumber) return null;
  let nums: string[] = [];
  if (Array.isArray(contactNumber)) {
    nums = contactNumber;
  } else {
    try {
      const parsed = JSON.parse(contactNumber);
      nums = Array.isArray(parsed) ? parsed : [contactNumber];
    } catch {
      nums = contactNumber.split(",").map((s) => s.trim());
    }
  }
  for (const n of nums) {
    const formatted = formatViberNumber(n);
    if (formatted) return n; // return raw phone — openViberChat will format it
  }
  return nums[0] || null;
}
