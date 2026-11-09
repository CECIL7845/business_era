# Testing

## Commands

```bash
npm run lint        # ESLint (Next.js rules)
npm run typecheck   # tsc --noEmit
npm test            # Vitest: unit + integration against TEST_DATABASE_URL
npm run build && npm run test:e2e   # Playwright: real browser against the production build
```

- **Integration tests** use a real PostgreSQL test database (`TEST_DATABASE_URL`; the name must contain `test`). Global setup runs `prisma migrate deploy`, which is non-destructive. Each test creates its own uniquely named businesses and users, so tests are isolated without truncating the database and can be re-run against the same DB. To start fresh, drop and recreate the test database manually.
- **E2E tests** start `next start` on port 3100 against the test database.

## Last observed results (14 Oct 2026, local macOS, Node 24, Postgres 18)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | pass |
| `npm test` | 46/46 passed (6 files) |
| `npm run build` | success |
| `npm run test:e2e` | 3/3 passed (desktop + Pixel 7 mobile) |

## What is covered

**Unit** (`tests/unit`)
- Cedi parsing and formatting (float traps such as 0.29).
- Ghana phone normalisation and validation.
- Accra dates.
- CSV escaping and formula injection.
- Safe redirects.
- FIFO allocation, including a property-based invariant check.
- Subscription state machine: trial, grace, expiry, cancellation, month arithmetic, plan-change conversion.

**Integration** (`tests/integration`, real DB)
- *Ledger:* numbering, stock decrement, FIFO allocation, overpayment credit, payment and invoice voids with re-allocation, credit-limit block and audited override, cash sale on a zero-limit customer, oversell refusal with rollback, rep list-price enforcement, duplicate MoMo references, future dates, **concurrent invoices and payments** (unique numbers, consistent balances and stock), statements, aging, dashboard, search, and SQL-injection strings.
- *Tenancy and permissions:* cross-tenant read, update, void, invoice, payment and assignment attempts; SALES and VIEWER restrictions; manager vs owner rules; last-owner protection; invitation email binding, single use and plan seat limits.
- *Billing:* trial start, webhook signature, **concurrent duplicate payment application** (applied exactly once), amount mismatch, failed and pending statuses, unknown reference, callback scoped to the right business (Paystack HTTP mocked), expiry making the account read-only, owner export after expiry, customer limits, Starter export gating, cancel/resume permissions, daily job status sync.
- *Auth:* registration normalisation and hashing, wrong password, lockout, IP rate limit, single-use reset tokens with session revocation, no enumeration on reset, email verification.

**E2E** (`e2e/`)
- Full journey: register, onboard, add product, add customer (with a validation error and kept input), credit sale, credit-limit block and override, MoMo payment, duplicate reference rejected, invoice marked paid, dashboard figures, statement, stock count, void with reason, activity log, logout and login (wrong password), and a second tenant blocked from the first tenant's invoice and export.
- Security headers, cron and webhook auth, export auth.
- Mobile: demo business, no horizontal overflow, bottom navigation, WhatsApp link format.

## Not yet covered
- Real Paystack sandbox calls. They need test keys; the client is mocked in tests. See the DEPLOYMENT.md sandbox checklist.
- Real SMTP delivery.
- Load and performance testing (e.g. 5,000 customers per business).
- Accessibility audit with a screen reader. Forms have labels, `aria-invalid` and error descriptions, but no formal audit has been done.
