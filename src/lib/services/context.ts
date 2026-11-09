import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";

/** The authenticated tenant context every business-data service requires. */
export type Ctx = {
  userId: string;
  businessId: string;
  membershipId: string;
  role: Role;
  ip?: string | null;
};

export function assertCan(ctx: Ctx, permission: Permission) {
  if (!can(ctx.role, permission)) throw new AppError("FORBIDDEN", "Your role does not allow this action. Ask the business owner or a manager.");
}
