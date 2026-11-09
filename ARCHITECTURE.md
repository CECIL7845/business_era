# Architecture

## Overview
A single Next.js 16 application (App Router) serves:
- **Pages** (React Server Components): render data on each request. Cache Components are intentionally **disabled**, so tenant data is never cached or shared.
- **Server Actions**: handle all mutations from forms. Next checks the Origin header against the Host (CSRF protection).
- **Route handlers**: `/api/health`, `/api/webhooks/paystack`, `/api/cron/daily`, `/api/export/[kind]`.

The application sits on PostgreSQL through Prisma 7 with the `@prisma/adapter-pg` driver. There are no microservices, no Redis and no queue. Background work is one idempotent daily job, triggered by an external scheduler.

```
Browser (phone) ─HTTPS─> Next.js (Node) ──> PostgreSQL
                              │  ├─> Paystack API (initialize / verify)
                              │  └─> SMTP provider (emails)
Paystack ──webhook──> /api/webhooks/paystack
Scheduler ──daily──> /api/cron/daily
```

## Code layout

| Path | Purpose |
|---|---|
| `src/lib/services/*` | **All business logic.** Plain async functions that take a `Ctx` `{userId, businessId, membershipId, role}`. They validate input (Zod), check permissions, check the subscription, and run DB transactions. Unit and integration tests call these directly. |
| `src/lib/auth/*` | Sessions (DB-backed, hashed tokens), request context (`requireBusiness`), the permission matrix. |
| `src/lib/billing/*` | Plan catalogue, subscription state machine (pure functions), Paystack client. |
| `src/app/**/actions.ts` | Thin Server Actions: resolve context, call a service, map errors to `ActionState`. |
| `src/app/**/page.tsx` | Server-rendered pages. Every page calls `requireBusiness()` itself and does not rely on the layout alone. |
| `src/components/*` | UI kit (Tailwind), form components with field-level errors. |
| `prisma/` | Schema, migrations (including CHECK constraints), seed. |

## Multi-tenancy
- Shared database and shared schema. Every tenant-owned table has a `businessId` column.
- The active business comes **only from the server session**, checked against a `Membership` row on every request (`requireBusiness`). The client never sends a business ID.
- Every query filters by `businessId`, including lookups of referenced IDs (customer, product, assignee, invoice), so foreign IDs return "not found".
- Raw SQL is used only through Prisma tagged templates (parameterised).
- Tests: `tests/integration/tenancy-permissions.test.ts` and the e2e cross-tenant check.
- *Future hardening:* Postgres Row-Level Security as a second layer.

## Ledger design
- `Invoice.total`, `Payment.amount` and `PaymentAllocation.amount` are integer pesewas.
- **Balance = sum of issued invoices − sum of recorded payments.** It is computed, never stored, so it cannot drift.
- `reallocateCustomer()` recomputes all allocations for one customer, oldest-due first (pure `allocateFifo`), after every invoice or payment create or void. It runs inside the same transaction, holding a `SELECT … FOR UPDATE` lock on the customer row. This serialises concurrent operations per customer. It is deterministic and self-healing.
- `Invoice.amountPaid` is a cache maintained by that function, guarded by `CHECK (amountPaid BETWEEN 0 AND total)`.
- Nothing financial is deleted: corrections are **voids** with a reason and an audit entry.
- Document numbers come from an atomic `UPDATE … increment` on `Business`, unique per business.
- Stock is decremented with conditional `updateMany(stockQty >= qty)`, so concurrent sales can't oversell.

## Subscription billing

```
TRIALING ──(trialEndsAt passes)──────────────────────────> EXPIRED (read-only)
ACTIVE ──(period end)──> PAST_DUE (7-day grace) ──────────> EXPIRED
ACTIVE ──(owner cancels)──> CANCELED (access until period end) ──> EXPIRED
any ──(verified payment)──> ACTIVE (period extended)
```

- Status is **computed from dates on every request** (`effectiveStatus`). The cron job only persists it for reporting, so access is correct even if cron fails.
- **No auto-debit.** MoMo can't be charged on a recurring basis without the customer approving each charge, so each period is a one-off Paystack transaction. Renewal reminders go out 3 days and 1 day before expiry.

Payment flow:
1. `startCheckout` writes a `BillingTransaction` (PENDING) with the expected amount, then calls Paystack `transaction/initialize`.
2. The browser returns to `/app/billing/callback`. The server calls `transaction/verify`; the redirect alone is never trusted.
3. The webhook `charge.success` is processed in this order: HMAC-SHA512 signature check, event de-duplication (`WebhookEvent`), then `transaction/verify` again.
4. `applyVerifiedTransaction` checks the amount and currency, then flips `appliedAt` from NULL with a conditional update. Only one caller can win, so a subscription is extended exactly once, even with concurrent callback, webhook and cron.

Entitlements (`canWrite`, `maxUsers`, `maxCustomers`, `canExport`) are enforced in services. When a subscription expires, the owner can still export (no lock-in).

## Data model (main tables)
- `User`, `Session` (sha256 of the token), `AuthToken` (verification and reset; hashed).
- `Business`, `Membership` (role), `Invitation` (hashed token).
- `Customer`, `Product`, `StockMovement`, `Invoice`, `InvoiceItem`, `Payment`, `PaymentAllocation`.
- `Plan`, `Subscription`, `BillingTransaction`, `WebhookEvent`.
- `AuditLog`, `RateLimit`, `Feedback`.

See `prisma/schema.prisma`.

## Ghana-specific choices
- `Intl` with `en-GH` for GH₵ formatting, and an explicit `Africa/Accra` timezone (UTC+0, no daylight saving time).
- Phone numbers normalised to E.164 (+233). Number portability means the prefix doesn't identify the network, so no network is shown.
- WhatsApp `wa.me` and `sms:` links are opened by the user from their own phone. There is no bulk messaging, so no messaging-provider licence or consent workflow is needed for the MVP.
- Data-light: no web fonts, images or third-party JS; PWA manifest.
