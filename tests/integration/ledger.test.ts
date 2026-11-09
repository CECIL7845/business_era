import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCustomer } from "@/lib/services/customers";
import { createProduct, adjustStock } from "@/lib/services/products";
import { createInvoice, voidInvoice } from "@/lib/services/invoices";
import { recordPayment, voidPayment } from "@/lib/services/payments";
import { getCustomerBalance, listCustomersWithBalances } from "@/lib/services/ledger";
import { getStatement, getDashboard } from "@/lib/services/reports";
import { addMember, daysAgo, makeBusiness, today } from "../helpers";

async function setup(creditLimit = "10000") {
  const b = await makeBusiness();
  const product = await createProduct(b.ctx, { name: "Rice 25kg", unit: "bag", unitPrice: "500", openingStock: "50", trackStock: "on" });
  const customer = await createCustomer(b.ctx, { name: "Ama Provisions", phone: "0241234567", creditLimit, paymentTermsDays: "14" });
  return { ...b, product: product!, customer };
}
const items = (productId: string, quantity: number, unitPrice = "500") => JSON.stringify([{ productId, quantity, unitPrice }]);

describe("invoices, payments and balances", () => {
  it("creates numbered invoices, decrements stock and tracks balance", async () => {
    const { ctx, product, customer } = await setup();
    const i1 = await createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 2) });
    const i2 = await createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 1), discount: "50" });
    expect(i1.number).toBe("INV-00001");
    expect(i2.number).toBe("INV-00002");
    expect(i1.total).toBe(100_000);
    expect(i2.total).toBe(45_000);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stockQty).toBe(47);
    expect((await getCustomerBalance(ctx.businessId, customer.id)).balance).toBe(145_000);
    expect(i1.dueDate.getTime() - i1.issueDate.getTime()).toBe(14 * 86_400_000);
  });

  it("allocates payments FIFO, keeps overpayment as credit, and re-allocates on void", async () => {
    const { ctx, product, customer } = await setup();
    const old = await createInvoice(ctx, { customerId: customer.id, issueDate: daysAgo(30), items: items(product.id, 2) }); // 1000
    const recent = await createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 1) }); // 500
    const { payment: p1 } = await recordPayment(ctx, { customerId: customer.id, amount: "1200", method: "CASH", receivedAt: today() });
    let [a, b] = await Promise.all([db.invoice.findUniqueOrThrow({ where: { id: old.id } }), db.invoice.findUniqueOrThrow({ where: { id: recent.id } })]);
    expect(a.amountPaid).toBe(100_000);
    expect(b.amountPaid).toBe(20_000);

    const { unallocated } = await recordPayment(ctx, { customerId: customer.id, amount: "500", method: "MOMO", reference: "MP123", receivedAt: today() });
    expect(unallocated).toBe(20_000); // 200 credit
    const bal = await getCustomerBalance(ctx.businessId, customer.id);
    expect(bal.balance).toBe(-20_000);
    expect(bal.credit).toBe(20_000);

    await voidPayment(ctx, p1.id, "Cash was counterfeit");
    [a, b] = await Promise.all([db.invoice.findUniqueOrThrow({ where: { id: old.id } }), db.invoice.findUniqueOrThrow({ where: { id: recent.id } })]);
    expect(a.amountPaid).toBe(50_000);
    expect(b.amountPaid).toBe(0);

    await voidInvoice(ctx, old.id, "Wrong customer");
    b = await db.invoice.findUniqueOrThrow({ where: { id: recent.id } });
    expect(b.amountPaid).toBe(50_000);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stockQty).toBe(49); // 2 returned
    await expect(voidInvoice(ctx, old.id, "again")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enforces credit limits, with audited manager override", async () => {
    const { ctx, product, customer, business } = await setup("800");
    await expect(createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 2) })).rejects.toMatchObject({ code: "CREDIT_LIMIT" });
    const sales = await addMember(business.id, "SALES");
    await expect(createInvoice(sales, { customerId: customer.id, issueDate: today(), items: items(product.id, 2), overrideCreditLimit: "on" })).rejects.toMatchObject({ code: "CREDIT_LIMIT" });
    const inv = await createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 2), overrideCreditLimit: "on" });
    const log = await db.auditLog.findFirst({ where: { entityId: inv.id } });
    expect(log?.action).toBe("invoice.create_credit_override");
  });

  it("supports cash sales on a zero-limit customer when paid in full", async () => {
    const { ctx, product, customer } = await setup("0");
    const inv = await createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 1), paidNowAmount: "500", paidNowMethod: "CASH" });
    expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.id } })).amountPaid).toBe(50_000);
    await expect(createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 1), paidNowAmount: "600", paidNowMethod: "CASH" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses to oversell stock and to reduce stock below zero", async () => {
    const { ctx, product, customer } = await setup("1000000");
    await expect(createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 51) })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stockQty).toBe(50); // transaction rolled back
    await expect(adjustStock(ctx, product.id, { kind: "ADJUSTMENT", quantity: "-60", note: "count" })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await adjustStock(ctx, product.id, { kind: "RESTOCK", quantity: "10" });
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stockQty).toBe(60);
  });

  it("sales reps must use list prices; managers may negotiate", async () => {
    const { ctx, product, customer, business } = await setup("1000000");
    const sales = await addMember(business.id, "SALES");
    const cheap = await createInvoice(sales, { customerId: customer.id, issueDate: today(), items: items(product.id, 1, "1.00") });
    expect(cheap.total).toBe(50_000);
    const deal = await createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 1, "450") });
    expect(deal.total).toBe(45_000);
  });

  it("rejects duplicate MoMo references and future dates", async () => {
    const { ctx, customer } = await setup();
    await recordPayment(ctx, { customerId: customer.id, amount: "10", method: "MOMO", reference: "ABC123", receivedAt: today() });
    await expect(recordPayment(ctx, { customerId: customer.id, amount: "10", method: "MOMO", reference: "abc123", receivedAt: today() })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(recordPayment(ctx, { customerId: customer.id, amount: "10", method: "MOMO", receivedAt: today() })).rejects.toMatchObject({ code: "VALIDATION" });
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await expect(recordPayment(ctx, { customerId: customer.id, amount: "10", method: "CASH", receivedAt: future })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordPayment(ctx, { customerId: customer.id, amount: "0", method: "CASH", receivedAt: today() })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("stays consistent under concurrent invoices and payments", async () => {
    const { ctx, product, customer } = await setup("1000000");
    const invs = await Promise.all(Array.from({ length: 8 }, () => createInvoice(ctx, { customerId: customer.id, issueDate: today(), items: items(product.id, 1) })));
    expect(new Set(invs.map((i) => i.number)).size).toBe(8);
    await Promise.all(Array.from({ length: 6 }, () => recordPayment(ctx, { customerId: customer.id, amount: "250", method: "CASH", receivedAt: today() })));
    const all = await db.invoice.findMany({ where: { customerId: customer.id } });
    const paidSum = all.reduce((s, i) => s + i.amountPaid, 0);
    expect(paidSum).toBe(150_000);
    const allocSum = await db.paymentAllocation.aggregate({ where: { invoice: { customerId: customer.id } }, _sum: { amount: true } });
    expect(allocSum._sum.amount).toBe(150_000);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stockQty).toBe(42);
  });

  it("builds statements, aging, dashboard and filtered customer lists from real data", async () => {
    const { ctx, product, customer } = await setup("1000000");
    await createInvoice(ctx, { customerId: customer.id, issueDate: daysAgo(60), items: items(product.id, 2) });
    await createInvoice(ctx, { customerId: customer.id, issueDate: daysAgo(1), items: items(product.id, 1) });
    await recordPayment(ctx, { customerId: customer.id, amount: "300", method: "CASH", receivedAt: daysAgo(10) });
    const st = await getStatement(ctx, customer.id, new Date(Date.now() - 365 * 86_400_000), new Date());
    expect(st.opening).toBe(0);
    expect(st.closing).toBe(120_000);
    expect(st.lines.map((l) => l.kind)).toEqual(["invoice", "payment", "invoice"]);
    const dash = await getDashboard(ctx);
    expect(dash.outstanding).toBe(120_000);
    expect(dash.overdue).toBe(70_000);
    expect(dash.buckets.d31_60).toBe(70_000);
    const overdue = await listCustomersWithBalances(ctx.businessId, { filter: "overdue" });
    expect(overdue.rows.map((r) => r.id)).toEqual([customer.id]);
    expect(overdue.rows[0].balance).toBe(120_000);
    const search = await listCustomersWithBalances(ctx.businessId, { q: "0241234" });
    expect(search.total).toBe(1);
    const injection = await listCustomersWithBalances(ctx.businessId, { q: "'; DROP TABLE \"Customer\"; --" });
    expect(injection.total).toBe(0);
  });
});
