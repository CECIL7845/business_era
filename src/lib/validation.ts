import { z } from "zod";
import { parseCedis } from "./money";
import { normalizeGhanaPhone } from "./phone";
import { parseDay } from "./dates";

// Shared input schemas. Services parse their own input with these, so validation
// is enforced server-side no matter how the service is called.

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const text = (max: number, label = "This field") =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`);

export const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, `Too long (max ${max} characters)`).optional());

export const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

/** Cedi amount entered as text → integer pesewas. */
export const money = (label = "Amount") =>
  z.preprocess(
    (v) => (typeof v === "number" ? String(v) : v),
    z.string({ error: `${label} is required` }).transform((v, ctx) => {
      const p = parseCedis(v);
      if (p == null) {
        ctx.addIssue({ code: "custom", message: `${label}: enter an amount like 1,250.00` });
        return z.NEVER;
      }
      return p;
    }),
  );

export const optionalMoney = (label = "Amount") => z.preprocess(emptyToUndefined, money(label).optional());

export const phone = z.string().transform((v, ctx) => {
  const r = normalizeGhanaPhone(v);
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: r.error });
    return z.NEVER;
  }
  return r.e164;
});

export const optionalPhone = z.preprocess(emptyToUndefined, phone.optional());

export const day = (label = "Date") =>
  z.string({ error: `${label} is required` }).transform((v, ctx) => {
    const d = parseDay(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: `${label} is not a valid date` });
      return z.NEVER;
    }
    return d;
  });

export const optionalDay = (label = "Date") => z.preprocess(emptyToUndefined, day(label).optional());

export const int = (label: string, min: number, max: number) =>
  z.coerce.number({ error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} must be at most ${max}`);

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const id = z.string().trim().min(1).max(64);
