import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { checkbox, int, money, optionalMoney, optionalText, text } from "@/lib/validation";
import { assertCan, type Ctx } from "./context";
import { assertWritable } from "./entitlements";
import { Prisma } from "@/generated/prisma/client";

export const productSchema = z.object({
  name: text(150, "Product name"),
  sku: optionalText(50),
  unit: z.preprocess((v) => (v === "" || v == null ? "unit" : v), text(30, "Unit")),
  unitPrice: money("Selling price"),
  costPrice: optionalMoney("Cost price"),
  reorderLevel: z.preprocess((v) => (v === "" || v == null ? 0 : v), int("Reorder level", 0, 10_000_000)),
  trackStock: checkbox,
  isActive: checkbox.optional(),
});

const openingStock = z.preprocess((v) => (v === "" || v == null ? 0 : v), int("Opening stock", 0, 10_000_000));

function uniqueSkuError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError("CONFLICT", "Another product already uses this SKU.", { sku: "SKU already in use" });
  throw e;
}

export async function createProduct(ctx: Ctx, input: Record<string, unknown>) {
  assertCan(ctx, "products.manage");
  const data = productSchema.parse(input);
  const stock = openingStock.parse(input.openingStock);
  await assertWritable(ctx.businessId);
  try {
    return await db.$transaction(async (tx) => {
      const p = await tx.product.create({ data: { ...data, isActive: true, businessId: ctx.businessId, stockQty: data.trackStock ? stock : 0 } });
      if (data.trackStock && stock > 0) {
        await tx.stockMovement.create({ data: { businessId: ctx.businessId, productId: p.id, change: stock, reason: "RESTOCK", note: "Opening stock", createdById: ctx.userId } });
      }
      await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "product.create", entityType: "Product", entityId: p.id, ip: ctx.ip }, tx);
      return p;
    });
  } catch (e) {
    uniqueSkuError(e);
  }
}

export async function updateProduct(ctx: Ctx, productId: string, input: Record<string, unknown>) {
  assertCan(ctx, "products.manage");
  const data = productSchema.parse(input);
  await assertWritable(ctx.businessId);
  const existing = await db.product.findFirst({ where: { id: productId, businessId: ctx.businessId } });
  if (!existing) throw new AppError("NOT_FOUND", "Product not found.");
  try {
    await db.product.update({ where: { id: existing.id }, data: { ...data, sku: data.sku ?? null, costPrice: data.costPrice ?? null, isActive: data.isActive ?? existing.isActive } });
  } catch (e) {
    uniqueSkuError(e);
  }
  await audit({
    businessId: ctx.businessId,
    userId: ctx.userId,
    action: "product.update",
    entityType: "Product",
    entityId: existing.id,
    metadata: existing.unitPrice !== data.unitPrice ? { priceFrom: existing.unitPrice, priceTo: data.unitPrice } : undefined,
    ip: ctx.ip,
  });
}

export const stockAdjustSchema = z.object({
  kind: z.enum(["RESTOCK", "ADJUSTMENT"]),
  quantity: z.coerce.number({ error: "Quantity must be a number" }).int("Whole numbers only").refine((n) => n !== 0, "Quantity cannot be zero").refine((n) => Math.abs(n) <= 10_000_000, "Quantity too large"),
  note: optionalText(200),
});

export async function adjustStock(ctx: Ctx, productId: string, input: Record<string, unknown>) {
  assertCan(ctx, "stock.adjust");
  const data = stockAdjustSchema.parse(input);
  if (data.kind === "RESTOCK" && data.quantity < 0) throw new AppError("VALIDATION", "Restock quantity must be positive. Use an adjustment to reduce stock.", { quantity: "Must be positive" });
  if (data.kind === "ADJUSTMENT" && !data.note) throw new AppError("VALIDATION", "Explain why stock is being adjusted (e.g. damaged, count correction).", { note: "Reason required for adjustments" });
  await assertWritable(ctx.businessId);
  return db.$transaction(async (tx) => {
    const res = await tx.product.updateMany({
      where: { id: productId, businessId: ctx.businessId, trackStock: true, ...(data.quantity < 0 ? { stockQty: { gte: -data.quantity } } : {}) },
      data: { stockQty: { increment: data.quantity } },
    });
    if (res.count !== 1) {
      const exists = await tx.product.findFirst({ where: { id: productId, businessId: ctx.businessId } });
      if (!exists) throw new AppError("NOT_FOUND", "Product not found.");
      if (!exists.trackStock) throw new AppError("VALIDATION", "Stock tracking is off for this product.");
      throw new AppError("INSUFFICIENT_STOCK", `Cannot reduce by ${-data.quantity}; only ${exists.stockQty} in stock.`);
    }
    await tx.stockMovement.create({ data: { businessId: ctx.businessId, productId, change: data.quantity, reason: data.kind, note: data.note, createdById: ctx.userId } });
    await audit({ businessId: ctx.businessId, userId: ctx.userId, action: "stock.adjust", entityType: "Product", entityId: productId, metadata: { kind: data.kind, change: data.quantity, note: data.note ?? null }, ip: ctx.ip }, tx);
  });
}

export async function getProduct(ctx: Ctx, productId: string) {
  const p = await db.product.findFirst({ where: { id: productId, businessId: ctx.businessId } });
  if (!p) throw new AppError("NOT_FOUND", "Product not found.");
  return p;
}

export async function productOptions(ctx: Ctx) {
  return db.product.findMany({
    where: { businessId: ctx.businessId, isActive: true },
    select: { id: true, name: true, unit: true, unitPrice: true, stockQty: true, trackStock: true, sku: true },
    orderBy: { name: "asc" },
    take: 5000,
  });
}
