# Businestra

Credit sales and collections software for **wholesalers and distributors in Ghana**. It tracks what every retailer owes, enforces credit limits, records cash, MoMo, bank and cheque collections, produces statements and receipts, and shows who to chase today. It is multi-tenant SaaS with GHS subscription billing through Paystack.

> **Status: MVP, ready for a *controlled pilot* once the items in [DEPLOYMENT.md § Go-live checklist](DEPLOYMENT.md#go-live-checklist) are done.** The business case is **not yet validated**. See [CUSTOMER_VALIDATION.md](CUSTOMER_VALIDATION.md).

## Documentation

| Doc | What's in it |
|---|---|
| [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Research, opportunity scorecard, pricing hypotheses, unit economics, 90-day plan |
| [CUSTOMER_VALIDATION.md](CUSTOMER_VALIDATION.md) | Interview script, demo, pilot terms, go/no-go criteria, outreach messages |
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | MVP scope, user roles, workflows, out-of-scope items |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, data model, tenancy, ledger design, billing flow |
| [SECURITY.md](SECURITY.md) | Controls implemented, known gaps, compliance notes |
| [TESTING.md](TESTING.md) | How to run tests and what they cover |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Hosting, environment, backups and restore, rollback, runbook, go-live checklist |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | What's done, what's next |

## Quick start (local)

Requirements: Node 20.9+ (tested on 24) and PostgreSQL 14+ (tested on 18).

```bash
npm install                        # also generates the Prisma client
cp .env.example .env               # then fill in DATABASE_URL and TEST_DATABASE_URL
npx prisma migrate dev             # create tables
SEED_DEMO=1 npm run db:seed        # plans + a dev demo login (demo@businestra.local / demo-password-1)
npm run dev                        # http://localhost:3000
```

In development, emails such as verification, password reset and invitations are printed to the server console when `SMTP_URL` is empty.

To make yourself a platform admin (for `/admin`):

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a-long-password' npm run db:seed
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` · `npm run typecheck` | Static checks |
| `npm test` | Unit and integration tests (Vitest, real Postgres test DB) |
| `npm run test:e2e` | Browser end-to-end tests (Playwright; run `npm run build` first) |
| `npm run db:migrate` · `npm run db:deploy` | Create migration (dev) / apply migrations (prod) |
| `npm run db:seed` | Seed plans and optional admin or demo |
| `npm run cron:daily` | Run daily jobs: subscription status, renewal reminders, payment reconciliation, cleanup |

## Tech

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Prisma 7 + PostgreSQL, Tailwind CSS 4, Zod, Vitest, Playwright. Payments go through Paystack.
