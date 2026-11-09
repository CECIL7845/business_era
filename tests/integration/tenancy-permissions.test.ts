import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCustomer, getCustomer, updateCustomer } from "@/lib/services/customers";
import { createProduct, adjustStock, updateProduct } from "@/lib/services/products";
import { createInvoice, getInvoice, voidInvoice, listInvoices } from "@/lib/services/invoices";
import { getPayment, recordPayment, voidPayment } from "@/lib/services/payments";
import { changeMemberRole, removeMember, inviteMember, acceptInvitation } from "@/lib/services/team";
import { getStatement, exportCsv, getPeriodSummary } from "@/lib/services/reports";
import { listCustomersWithBalances } from "@/lib/services/ledger";
import { addMember, makeBusiness, makeUser, today, uniq } from "../helpers";

async function populated() {
  const b = await makeBusiness("Tenant");
  const product = (await createProduct(b.ctx, { name: "Oil", unitPrice: "100", openingStock: "100", trackStock: "on" }))!;
  const customer = await createCustomer(b.ctx, { name: `Secret ${uniq()}`, creditLimit: "100000" });
  const invoice = await createInvoice(b.ctx, { customerId: customer.id, issueDate: today(), items: JSON.stringify([{ productId: product.id, quantity: 1, unitPrice: "100" }]) });
  const { payment } = await recordPayment(b.ctx, { customerId: customer.id, amount: "50", method: "CASH", receivedAt: today() });
  return { ...b, product, customer, invoice, payment };
}

describe("tenant isolation", () => {
  it("a business can never read or change another business's records", async () => {
    const victim = await populated();
    const attacker = await populated();
    const a = attacker.ctx;
    await expect(getCustomer(a, victim.customer.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateCustomer(a, victim.customer.id, { name: "pwned" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getInvoice(a, victim.invoice.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(voidInvoice(a, victim.invoice.id, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPayment(a, victim.payment.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(voidPayment(a, victim.payment.id, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateProduct(a, victim.product.id, { name: "x", unitPrice: "1" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(adjustStock(a, victim.product.id, { kind: "RESTOCK", quantity: "5" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getStatement(a, victim.customer.id, new Date(0), new Date())).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Cannot invoice a foreign customer, or use a foreign product on own customer.
    await expect(createInvoice(a, { customerId: victim.customer.id, issueDate: today(), items: JSON.stringify([{ productId: attacker.product.id, quantity: 1, unitPrice: "1" }]) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createInvoice(a, { customerId: attacker.customer.id, issueDate: today(), items: JSON.stringify([{ productId: victim.product.id, quantity: 1, unitPrice: "1" }]) })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordPayment(a, { customerId: victim.customer.id, amount: "1", method: "CASH", receivedAt: today() })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Cannot assign a foreign staff member.
    await expect(createCustomer(a, { name: "X", assignedToId: victim.ctx.membershipId })).rejects.toMatchObject({ code: "VALIDATION" });
    // Cannot change roles in another business.
    await expect(changeMemberRole(a, victim.ctx.membershipId, "VIEWER")).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Lists and exports only contain own data.
    const lists = await listInvoices(a, {});
    expect(lists.rows.every((r) => r.businessId === a.businessId)).toBe(true);
    const custs = await listCustomersWithBalances(a.businessId, {});
    expect(custs.rows.map((r) => r.id)).not.toContain(victim.customer.id);
    const { csv } = await exportCsv(a, "customers");
    expect(csv).not.toContain(victim.customer.name);
    expect(csv).toContain(attacker.customer.name);
    expect((await db.customer.findUniqueOrThrow({ where: { id: victim.customer.id } })).name).toBe(victim.customer.name);
  });
});

describe("role permissions (server-side)", () => {
  it("SALES cannot void, set credit limits, manage products, view reports or export", async () => {
    const b = await populated();
    const sales = await addMember(b.business.id, "SALES");
    await expect(voidInvoice(sales, b.invoice.id, "reason")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(voidPayment(sales, b.payment.id, "reason")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createProduct(sales, { name: "x", unitPrice: "1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getPeriodSummary(sales, new Date(0), new Date())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(exportCsv(sales, "customers")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const c = await createCustomer(sales, { name: "Rep's shop", creditLimit: "99999" });
    expect(c.creditLimit).toBe(0);
    expect(c.assignedToId).toBe(sales.membershipId);
  });

  it("VIEWER is read-only", async () => {
    const b = await populated();
    const viewer = await addMember(b.business.id, "VIEWER");
    await expect(createCustomer(viewer, { name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createInvoice(viewer, { customerId: b.customer.id, issueDate: today(), items: "[]" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordPayment(viewer, { customerId: b.customer.id, amount: "1", method: "CASH", receivedAt: today() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await getCustomer(viewer, b.customer.id)).id).toBe(b.customer.id);
  });

  it("MANAGER cannot touch owners; the last owner cannot be removed", async () => {
    const b = await makeBusiness();
    const manager = await addMember(b.business.id, "MANAGER");
    await expect(changeMemberRole(manager, b.ctx.membershipId, "VIEWER")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(changeMemberRole(manager, manager.membershipId, "OWNER")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeMember(b.ctx, b.ctx.membershipId)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(changeMemberRole(b.ctx, b.ctx.membershipId, "MANAGER")).rejects.toMatchObject({ code: "CONFLICT" });
    await removeMember(b.ctx, manager.membershipId);
    expect(await db.membership.count({ where: { businessId: b.business.id } })).toBe(1);
  });

  it("invitations must be accepted by the invited email, once, within plan limits", async () => {
    const b = await makeBusiness();
    const invitee = await makeUser();
    const other = await makeUser();
    const { token } = await inviteMember(b.ctx, { email: invitee.email, role: "SALES" }, { name: "Owner", emailVerified: true });
    await expect(acceptInvitation(other, token)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const m = await acceptInvitation(invitee, token);
    expect(m.role).toBe("SALES");
    await expect(acceptInvitation(invitee, token)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(inviteMember(b.ctx, { email: "x@example.com", role: "SALES" }, { name: "Owner", emailVerified: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Growth trial allows 6 users: 2 used, 4 more invitations allowed.
    for (let i = 0; i < 4; i++) await inviteMember(b.ctx, { email: `extra${i}${b.business.id}@example.com`, role: "VIEWER" }, { name: "Owner", emailVerified: true });
    await expect(inviteMember(b.ctx, { email: `toomany${b.business.id}@example.com`, role: "VIEWER" }, { name: "Owner", emailVerified: true })).rejects.toMatchObject({ code: "PLAN_LIMIT" });
  });
});
