# Implementation Plan

Updated 14 Oct 2026.

## Milestone 1: MVP for a controlled pilot ✅ (this session)
- [x] Market research and opportunity scoring → distributor credit control (BUSINESS_MODEL.md)
- [x] Validation plan and tools (CUSTOMER_VALIDATION.md)
- [x] Next.js 16, Prisma 7 and Postgres scaffold; schema, migrations and CHECK constraints
- [x] Auth: register, login, verification, reset, sessions, lockout, rate limits
- [x] Tenancy, roles, invitations, team management
- [x] Customers, products and stock, invoices, payments, FIFO ledger, voids, statements, receipts
- [x] Dashboard, aging, reports, CSV exports, activity log
- [x] Subscription billing with Paystack (sandbox-ready, mocked in tests), plan limits, grace and read-only, admin console
- [x] Landing page, help guide, feedback, privacy and terms drafts, demo business
- [x] 46 unit and integration tests + 3 Playwright e2e tests; lint, typecheck and build clean
- [x] Dockerfile, deployment runbook, security doc

## Milestone 2: go-live readiness (needs the owner's accounts and decisions)
- [ ] Create hosting, DB, domain, SMTP and Paystack accounts; deploy staging (DEPLOYMENT.md)
- [ ] Run the Paystack sandbox checklist on staging
- [ ] Legal review of terms and privacy; Data Protection Commission registration
- [ ] Set the support WhatsApp number and email
- [ ] Test a backup restore

## Milestone 3: validation (weeks 1–8, founder-led)
- [ ] 20–25 interviews, then 5 paid-setup pilots (CUSTOMER_VALIDATION.md)
- [ ] Record metrics weekly; go/no-go at week 8

## Backlog: build only if pilots ask for it
1. Bulk import of customers and opening balances from CSV/Excel. Likely the first request; currently done by hand during setup.
2. Opening balance entry per customer (today: create an "Opening balance" invoice with a custom line).
3. Weekly email or WhatsApp digest for owners ("GH₵X overdue, top 5 to chase").
4. Restrict sales reps to assigned customers (per-business setting).
5. Promise-to-pay notes and follow-up dates per customer.
6. Supplier purchases and payables; expenses.
7. Automated SMS reminders via a licensed provider, with a consent record.
8. Nonce-based CSP, TOTP 2FA for admins and owners, Postgres RLS.
9. Offline-first PWA (queue invoices and payments when there is no network).
10. Paystack payment links that retailers can use to pay the distributor (requires the distributor's own Paystack account; split settlement).

## Decisions log
- **Cache Components disabled:** per-request financial data, no shared caching risk.
- **No auto-debit:** MoMo recurring debits need per-charge approval, so billing uses prepaid periods with reminders.
- **Balances computed, not stored;** allocations recomputed per customer under a row lock. Simple, correct and self-healing; fine up to thousands of invoices per customer.
- **Rate limits in Postgres** rather than Redis: one less service to run and pay for.
- **Tests use `migrate deploy` and unique data**, not `migrate reset`. Prisma blocks AI agents from running reset, and unique data makes the suite repeatable anyway.
