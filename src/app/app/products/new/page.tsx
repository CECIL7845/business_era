import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import { createProductAction } from "../actions";

export const metadata = { title: "Add product" };

export default async function NewProductPage({ searchParams }: PageProps<"/app/products/new">) {
  const sp = await searchParams;
  const { membership } = await requireBusiness();
  if (!can(membership.role, "products.manage")) redirect("/app/products");
  return (
    <>
      <PageHeader title="Add product" back={{ href: "/app/products", label: "Products" }} />
      {sp.added && <div className="mb-4 max-w-2xl"><Alert tone="green">Product saved. Add the next one.</Alert></div>}
      <Card className="max-w-2xl p-5"><ProductForm action={createProductAction} isNew /></Card>
    </>
  );
}
