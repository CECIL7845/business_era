import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "./db";

export type AuditInput = {
  businessId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
};

export async function audit(input: AuditInput, tx?: Tx) {
  await (tx ?? db).auditLog.create({ data: { ...input, metadata: input.metadata ?? undefined } });
}
