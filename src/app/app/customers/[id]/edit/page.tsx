import { notFound, redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { toDecimalString } from "@/lib/money";
import { formatGhanaPhone } from "@/lib/phone";
import { getCustomer } from "@/lib/services/customers";
import { isAppError } from "@/lib/errors";
import { Card, PageHeader } from "@/components/ui";
import { CustomerForm } from "../../customer-form";
import { updateCustomerAction } from "../../actions";

export const metadata = { title: "Edit customer" };

export default async function EditCustomerPage({ params }: PageProps<"/app/customers/[id]/edit">) {
  const { id } = await params;
  const { ctx, business, membership } = await requireBusiness();
  if (!can(membership.role, "customers.manage")) redirect(`/app/customers/${id}`);
  const c = await getCustomer(ctx, id).catch((e) => (isAppError(e) ? null : Promise.reject(e)));
  if (!c) notFound();
  const members = await db.membership.findMany({ where: { businessId: ctx.businessId }, include: { user: { select: { name: true } } } });
  return (
    <>
      <PageHeader title={`Edit ${c.name}`} back={{ href: `/app/customers/${c.id}`, label: c.name }} />
      <Card className="max-w-2xl p-5">
        <CustomerForm
          action={updateCustomerAction}
          canSetLimit={can(membership.role, "customers.setCreditLimit")}
          members={members.map((m) => ({ id: m.id, name: m.user.name }))}
          submitLabel="Save changes"
          defaultTerms={business.defaultCreditDays}
          values={{ id: c.id, name: c.name, contactName: c.contactName ?? "", phone: formatGhanaPhone(c.phone), location: c.location ?? "", creditLimit: toDecimalString(c.creditLimit), paymentTermsDays: String(c.paymentTermsDays), notes: c.notes ?? "", assignedToId: c.assignedToId ?? "", isActive: c.isActive }}
        />
      </Card>
    </>
  );
}
