import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = process.env.NODE_ENV === "test" ? 4 : 12;

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Password is too long")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Include at least one letter and one number");

export const hashPassword = (password: string) => bcrypt.hash(password, COST);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// Used to keep login timing similar whether or not the account exists.
let dummyHash: string | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= await bcrypt.hash("not-a-real-password-1", COST);
  await bcrypt.compare(password, dummyHash);
}
