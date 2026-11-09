// Pure FIFO allocation: payments settle the oldest-due invoices first. Kept free of
// database access so it can be unit tested exhaustively.

export type AllocInvoice = { id: string; total: number };
export type AllocPayment = { id: string; amount: number };
export type Allocation = { paymentId: string; invoiceId: string; amount: number };

/** invoices must be ordered oldest-due first; payments oldest-received first. */
export function allocateFifo(invoices: AllocInvoice[], payments: AllocPayment[]) {
  const allocations: Allocation[] = [];
  const paid = new Map<string, number>();
  let i = 0;
  let invoiceRemaining = invoices[0]?.total ?? 0;
  let unallocated = 0;

  for (const p of payments) {
    let left = p.amount;
    while (left > 0 && i < invoices.length) {
      if (invoiceRemaining === 0) {
        i++;
        invoiceRemaining = invoices[i]?.total ?? 0;
        continue;
      }
      const take = Math.min(left, invoiceRemaining);
      const inv = invoices[i];
      allocations.push({ paymentId: p.id, invoiceId: inv.id, amount: take });
      paid.set(inv.id, (paid.get(inv.id) ?? 0) + take);
      left -= take;
      invoiceRemaining -= take;
    }
    unallocated += left; // customer credit (overpayment / advance)
  }
  return { allocations, paid, unallocated };
}
