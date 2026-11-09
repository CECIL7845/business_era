import type { Role } from "@/generated/prisma/enums";

// Single source of truth for what each role may do. Enforced server-side in every
// service function; the UI only uses it to hide controls.
const MATRIX = {
  "customers.view": ["OWNER", "MANAGER", "SALES", "VIEWER"],
  "customers.manage": ["OWNER", "MANAGER", "SALES"],
  "customers.setCreditLimit": ["OWNER", "MANAGER"],
  "invoices.create": ["OWNER", "MANAGER", "SALES"],
  "invoices.overrideCreditLimit": ["OWNER", "MANAGER"],
  "invoices.void": ["OWNER", "MANAGER"],
  "payments.record": ["OWNER", "MANAGER", "SALES"],
  "payments.void": ["OWNER", "MANAGER"],
  "products.manage": ["OWNER", "MANAGER"],
  "stock.adjust": ["OWNER", "MANAGER"],
  "reports.view": ["OWNER", "MANAGER", "VIEWER"],
  "data.export": ["OWNER", "MANAGER", "VIEWER"],
  "team.manage": ["OWNER", "MANAGER"],
  "settings.manage": ["OWNER", "MANAGER"],
  "billing.manage": ["OWNER"],
  "audit.view": ["OWNER", "MANAGER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;

export function can(role: Role, permission: Permission): boolean {
  return (MATRIX[permission] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  SALES: "Sales rep / collector",
  VIEWER: "Viewer / accountant",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access including billing and ownership.",
  MANAGER: "Everything except billing. Approves credit limits and voids.",
  SALES: "Adds customers, issues invoices within credit limits, records payments.",
  VIEWER: "Read-only access to records and reports; can export.",
};
