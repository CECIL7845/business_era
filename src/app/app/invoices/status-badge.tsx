import { Badge } from "@/components/ui";

export function InvoiceStatusBadge({ status, total, paid, late }: { status: string; total: number; paid: number; late: number }) {
  if (status === "VOID") return <Badge tone="gray">Void</Badge>;
  if (paid >= total) return <Badge tone="green">Paid</Badge>;
  if (late > 0) return <Badge tone="red">{late}d overdue</Badge>;
  if (paid > 0) return <Badge tone="blue">Part paid</Badge>;
  return <Badge tone="amber">Unpaid</Badge>;
}
