// Ghana phone number handling. Stored as E.164: +233XXXXXXXXX (9 digits after 233).

// Mobile network prefixes (after the leading 0). Number portability means the prefix
// identifies the original network only, so we do not show a network name.
const MOBILE_PREFIXES = new Set(["20", "23", "24", "25", "26", "27", "28", "50", "53", "54", "55", "56", "57", "59"]);

export type PhoneResult = { ok: true; e164: string; isMobile: boolean } | { ok: false; error: string };

export function normalizeGhanaPhone(input: string): PhoneResult {
  const digits = input.replace(/[\s\-().]/g, "");
  let national: string | null = null;
  if (/^\+233\d{9}$/.test(digits)) national = digits.slice(4);
  else if (/^233\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{9}$/.test(digits)) national = digits;
  if (!national) return { ok: false, error: "Enter a valid Ghana number, e.g. 024 123 4567" };

  const prefix = national.slice(0, 2);
  const isMobile = MOBILE_PREFIXES.has(prefix);
  const isLandline = /^3[0-9]$/.test(prefix);
  if (!isMobile && !isLandline) return { ok: false, error: "That doesn't look like a Ghana mobile or landline number" };
  return { ok: true, e164: `+233${national}`, isMobile };
}

/** +233241234567 → "024 123 4567" */
export function formatGhanaPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Click-to-chat link (user-initiated; no bulk messaging). */
export function whatsappLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace("+", "")}?text=${encodeURIComponent(text)}`;
}
