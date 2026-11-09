import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { customerOptions } from "@/lib/services/customers";
import { productOptions } from "@/lib/services/products";
import { toAccraDay } from "@/lib/dates";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";
import { InvoiceBuilder } from "../invoice-builder";
import { createInvoiceAction } from "../actions";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/app/invoices/new">) {
  const sp = await searchParams;
  const { ctx, membership, entitlements } = await requireBusiness();
  if (!can(membership.role, "invoices.create")) redirect("/app/invoices");
  const [customers, products] = await Promise.all([customerOptions(ctx), productOptions(ctx)]);
  return (
    <>
      <PageHeader title="New invoice" subtitle="Record a sale on credit (or a cash sale)." back={{ href: "/app/invoices", label: "Invoices" }} />
      {!entitlements.canWrite && <div className="mb-4"><Alert tone="red">Your account is read-only until the subscription is renewed.</Alert></div>}
      {customers.length === 0 ? (
        <Card className="p-6"><p className="mb-3">Add a customer first.</p><LinkButton href="/app/customers/new">Add customer</LinkButton></Card>
      ) : (
        <Card className="p-4 sm:p-5">
          {products.length === 0 && <div className="mb-4"><Alert tone="blue">Tip: <Link href="/app/products/new" className="underline">add your products</Link> so prices and stock fill in automatically.</Alert></div>}
          <InvoiceBuilder
            action={createInvoiceAction}
            customers={customers}
            products={products}
            canSetPrice={can(membership.role, "invoices.overrideCreditLimit")}
            canOverride={can(membership.role, "invoices.overrideCreditLimit")}
            defaultCustomerId={typeof sp.customerId === "string" ? sp.customerId : undefined}
            today={toAccraDay(new Date())}
          />
        </Card>
      )}
    </>
  );
}
