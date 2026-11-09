// Default plan catalogue, seeded into the Plan table. Prices are HYPOTHESES to be
// validated with pilot customers (see BUSINESS_MODEL.md). Platform admins can edit
// prices in /admin without a deploy; the database is the source of truth at runtime.
export const TRIAL_DAYS = 14;
export const TRIAL_PLAN = "GROWTH";
export const GRACE_DAYS = 7;

export const DEFAULT_PLANS = [
  { code: "STARTER", name: "Starter", priceMonthly: 9_900, priceAnnual: 99_000, maxUsers: 2, maxCustomers: 150, canExport: false, sortOrder: 1 },
  { code: "GROWTH", name: "Growth", priceMonthly: 24_900, priceAnnual: 249_000, maxUsers: 6, maxCustomers: 1_000, canExport: true, sortOrder: 2 },
  { code: "PRO", name: "Distributor", priceMonthly: 54_900, priceAnnual: 549_000, maxUsers: 20, maxCustomers: -1, canExport: true, sortOrder: 3 },
] as const;
