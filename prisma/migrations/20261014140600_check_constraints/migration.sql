-- Integrity rules that Prisma's schema language cannot express.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_creditLimit_nonneg" CHECK ("creditLimit" >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_terms_range" CHECK ("paymentTermsDays" BETWEEN 0 AND 365);
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_nonneg" CHECK ("unitPrice" >= 0 AND ("costPrice" IS NULL OR "costPrice" >= 0));
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_valid" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "total" = "subtotal" - "discount");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paid_range" CHECK ("amountPaid" >= 0 AND "amountPaid" <= "total");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_valid" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "lineTotal" = "quantity" * "unitPrice");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_pos" CHECK ("amount" > 0);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_pos" CHECK ("amount" > 0);
ALTER TABLE "BillingTransaction" ADD CONSTRAINT "BillingTransaction_amount_pos" CHECK ("amount" > 0);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_prices_nonneg" CHECK ("priceMonthly" >= 0 AND "priceAnnual" >= 0);
