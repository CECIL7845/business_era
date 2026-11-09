import "server-only";
import { db } from "@/lib/db";
import { addDays, startOfToday, toAccraDay } from "@/lib/dates";
import type { Ctx } from "./context";
import { createBusiness } from "./business";
import { createProduct } from "./products";
import { createCustomer } from "./customers";
import { createInvoice } from "./invoices";
import { recordPayment } from "./payments";

// Fictional sample data for a clearly-labelled demo business (isDemo = true). Names
// and phone numbers are invented; demo businesses are excluded from platform metrics.
const PRODUCTS = [
  { name: "Vegetable oil 1L (carton of 12)", unit: "carton", unitPrice: "310.00", costPrice: "285.00", stock: 120, reorder: 30 },
  { name: "Perfumed rice 25kg", unit: "bag", unitPrice: "495.00", costPrice: "455.00", stock: 80, reorder: 20 },
  { name: "Granulated sugar 1kg (bale of 20)", unit: "bale", unitPrice: "390.00", costPrice: "362.00", stock: 45, reorder: 15 },
  { name: "Tomato paste 70g (carton of 50)", unit: "carton", unitPrice: "205.00", costPrice: "188.00", stock: 12, reorder: 20 },
  { name: "Evaporated milk 160g (carton of 48)", unit: "carton", unitPrice: "460.00", costPrice: "428.00", stock: 60, reorder: 15 },
  { name: "Sachet water (bag of 30)", unit: "bag", unitPrice: "7.50", costPrice: "5.80", stock: 400, reorder: 100 },
  { name: "Spaghetti 500g (carton of 20)", unit: "carton", unitPrice: "198.00", costPrice: "181.00", stock: 70, reorder: 20 },
  { name: "Bar soap (carton of 36)", unit: "carton", unitPrice: "265.00", costPrice: "240.00", stock: 8, reorder: 10 },
];

const CUSTOMERS = [
  { name: "Auntie Ama Provisions", contactName: "Ama Owusu", phone: "0240000101", location: "Madina Market", creditLimit: "8000", terms: 14 },
  { name: "Kofi & Sons Enterprise", contactName: "Kofi Mensah", phone: "0550000102", location: "Kaneshie", creditLimit: "15000", terms: 21 },
  { name: "God Is Able Store", contactName: "Esi Badu", phone: "0200000103", location: "Kasoa Old Market", creditLimit: "5000", terms: 7 },
  { name: "Blessed Hands Mini Mart", contactName: "Yaw Boateng", phone: "0270000104", location: "Adenta Housing Down", creditLimit: "6000", terms: 14 },
  { name: "Nana Yaa Wholesale", contactName: "Nana Yaa Asante", phone: "0540000105", location: "Kumasi, Adum", creditLimit: "20000", terms: 30 },
  { name: "Unity Chop Bar", contactName: "Abena Darko", phone: "0500000106", location: "Teshie", creditLimit: "2500", terms: 7 },
  { name: "Divine Grace Supermarket", contactName: "Kwame Adjei", phone: "0570000107", location: "Spintex Road", creditLimit: "12000", terms: 14 },
  { name: "Mama Efua Kiosk", contactName: "Efua Quansah", phone: "0590000108", location: "Cape Coast, Kotokuraba", creditLimit: "0", terms: 0 },
];

export async function createDemoBusiness(userId: string, ip?: string | null) {
  const business = await createBusiness(userId, { name: "Demo Distributors Ltd (sample data)", city: "Accra", defaultCreditDays: "14" }, { isDemo: true, ip });
  const membership = await db.membership.findFirstOrThrow({ where: { businessId: business.id, userId } });
  const ctx: Ctx = { userId, businessId: business.id, membershipId: membership.id, role: "OWNER", ip };

  const products: Awaited<ReturnType<typeof createProduct>>[] = [];
  for (const p of PRODUCTS) {
    products.push(await createProduct(ctx, { name: p.name, unit: p.unit, unitPrice: p.unitPrice, costPrice: p.costPrice, openingStock: String(p.stock + 200), reorderLevel: String(p.reorder), trackStock: "on" }));
  }
  const customers = [];
  for (const c of CUSTOMERS) {
    customers.push(await createCustomer(ctx, { name: c.name, contactName: c.contactName, phone: c.phone, location: c.location, creditLimit: c.creditLimit, paymentTermsDays: String(c.terms) }));
  }

  // Deterministic pseudo-random history over the last ~80 days.
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const today = startOfToday();
  for (let dayOffset = 80; dayOffset >= 0; dayOffset -= 3) {
    const date = addDays(today, -dayOffset);
    for (const [ci, c] of customers.entries()) {
      if (rand() > 0.35) continue;
      const lines = [0, 1].map(() => {
        const p = products[Math.floor(rand() * products.length)]!;
        return { productId: p.id, quantity: 1 + Math.floor(rand() * 4), unitPrice: (p.unitPrice / 100).toFixed(2) };
      });
      // Cash-only customers pay in full at the point of sale.
      const cashCustomer = CUSTOMERS[ci].creditLimit === "0";
      const total = lines.reduce((s, l) => s + l.quantity * Math.round(Number(l.unitPrice) * 100), 0);
      await createInvoice(ctx, {
        customerId: c.id,
        issueDate: toAccraDay(date),
        items: JSON.stringify(lines),
        overrideCreditLimit: "on",
        ...(cashCustomer ? { paidNowAmount: (total / 100).toFixed(2), paidNowMethod: "CASH" } : {}),
      });
    }
    // Payments: most customers pay part of what they owe a few days later.
    if (dayOffset % 6 === 0) {
      for (const [ci, c] of customers.entries()) {
        if (CUSTOMERS[ci].creditLimit === "0" || rand() > 0.6 || ci === 2) continue; // customer #3 is a slow payer
        const amount = (1500 + Math.floor(rand() * 4000)).toFixed(2);
        const method = rand() > 0.5 ? "MOMO" : "CASH";
        await recordPayment(ctx, { customerId: c.id, amount, method, reference: method === "MOMO" ? `DEMO${dayOffset}${ci}${Math.floor(rand() * 1e6)}` : "", receivedAt: toAccraDay(addDays(date, Math.min(2, dayOffset))) });
      }
    }
  }
  // Bring demo stock down to the intended levels so low-stock alerts show.
  for (const [i, p] of products.entries()) {
    const fresh = await db.product.findUniqueOrThrow({ where: { id: p!.id } });
    const target = PRODUCTS[i].stock;
    if (fresh.stockQty !== target) {
      await db.product.update({ where: { id: p!.id }, data: { stockQty: target } });
      await db.stockMovement.create({ data: { businessId: business.id, productId: p!.id, change: target - fresh.stockQty, reason: "ADJUSTMENT", note: "Demo data setup", createdById: userId } });
    }
  }
  return business;
}
