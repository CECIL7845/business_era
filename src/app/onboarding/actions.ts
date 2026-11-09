"use server";

import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/lib/action";
import { requireUser } from "@/lib/auth/context";
import { requestMeta, setActiveBusiness } from "@/lib/auth/session";
import { createBusiness } from "@/lib/services/business";
import { createDemoBusiness } from "@/lib/services/demo";
import { enforceRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";

export async function createBusinessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { user, session } = await requireUser();
    const { ip } = await requestMeta();
    await enforceRateLimit(`create-business:${user.id}`, 5, 86_400, "You've created several businesses today. Contact support if you need more.");
    const b = await createBusiness(user.id, Object.fromEntries(fd), { ip });
    await setActiveBusiness(session.id, b.id);
  } catch (e) {
    return toActionError(e, fd);
  }
  redirect("/app?welcome=1");
}

export async function createDemoAction(): Promise<ActionState> {
  try {
    const { user, session } = await requireUser();
    const { ip } = await requestMeta();
    const existing = await db.membership.findFirst({ where: { userId: user.id, role: "OWNER", business: { isDemo: true } } });
    if (existing) {
      await setActiveBusiness(session.id, existing.businessId);
    } else {
      await enforceRateLimit(`create-demo:${user.id}`, 2, 86_400);
      const b = await createDemoBusiness(user.id, ip);
      await setActiveBusiness(session.id, b.id);
    }
  } catch (e) {
    return toActionError(e);
  }
  redirect("/app");
}
