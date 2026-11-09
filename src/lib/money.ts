// Money helpers. All amounts are integer pesewas (1 GHS = 100 pesewas).

const formatter = new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" });
const plain = new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123450 → "GH₵1,234.50" */
export function formatCedis(pesewas: number): string {
  return formatter.format(pesewas / 100);
}

/** 123450 → "1,234.50" (no currency symbol; for tables and CSV-friendly display) */
export function formatAmount(pesewas: number): string {
  return plain.format(pesewas / 100);
}

/** 123450 → "1234.50" (machine-readable, for CSV exports and input defaults) */
export function toDecimalString(pesewas: number): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Parse a user-entered cedi amount into pesewas without floating-point error.
 * Accepts "1234", "1,234.5", "GH₵ 1,234.50", "GHS 20". Returns null if invalid.
 */
export function parseCedis(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).replace(/GH₵|GHS|GHC|¢|₵|,|\s/gi, "");
  if (!/^\d{1,10}(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const value = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : null;
}
