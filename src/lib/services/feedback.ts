import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { text } from "@/lib/validation";

export const feedbackSchema = z.object({
  category: z.enum(["bug", "idea", "question", "billing", "other"], { error: "Choose a category" }),
  message: text(3000, "Message"),
});

export async function submitFeedback(input: Record<string, unknown>, who: { userId: string; businessId: string | null }) {
  const data = feedbackSchema.parse(input);
  await enforceRateLimit(`feedback:${who.userId}`, 20, 86_400);
  return db.feedback.create({ data: { ...data, userId: who.userId, businessId: who.businessId } });
}
