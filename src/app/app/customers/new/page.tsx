import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form";
import { createCustomerAction } from "../actions";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  const { ctx, business, membership } = await requireBusiness();
  if (!can(membership.role, "customers.manage")) redirect("/app/customers");
  const members = await db.membership.findMany({ where: { businessId: ctx.businessId }, include: { user: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="Add customer" back={{ href: "/app/customers", label: "Customers" }} />
      <Card className="max-w-2xl p-5">
        <CustomerForm action={createCustomerAction} canSetLimit={can(membership.role, "customers.setCreditLimit")} members={members.map((m) => ({ id: m.id, name: m.user.name }))} submitLabel="Save customer" defaultTerms={business.defaultCreditDays} values={{ assignedToId: membership.role === "SALES" ? membership.id : "" }} />
      </Card>
    </>
  );
}
