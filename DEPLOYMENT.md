# Deployment and Operations

Nothing has been deployed yet. This is the plan and runbook. External accounts (hosting, domain, Paystack, SMTP) must be created by the business owner.

## Recommended setup (low cost)

| Component | Recommendation | Why |
|---|---|---|
| App | **Render** (Web Service, Docker) or Railway/Fly.io. Choose an EU region (Frankfurt or London) for latency to Ghana. | Managed TLS, zero-downtime deploys, health checks, log streaming |
| Database | Managed PostgreSQL 16+ (Render, Neon, Supabase, or Railway) with daily backups and point-in-time recovery | Backups handled by the provider |
| Email | Resend, Brevo, or Mailgun over SMTP | Reliable delivery; free tiers to start |
| Scheduler | Render Cron Job, GitHub Actions schedule, or cron-job.org calling `/api/cron/daily` | One daily call |
| Monitoring | Uptime monitor (e.g. Better Stack or UptimeRobot) on `/api/health`; provider log search on JSON logs | Alerts on downtime and errors |

Check current pricing and data-residency terms for each provider before signing up.

Use **three environments**:
- `development`: local.
- `staging`: its own DB, Paystack **test** keys, never real customer data.
- `production`: Paystack **live** keys after approval.

## Environment variables
See `.env.example`.

Required in production: `DATABASE_URL` (with `sslmode=require`), `APP_URL` (https), `SMTP_URL`, `EMAIL_FROM`, `PAYSTACK_SECRET_KEY`, `CRON_SECRET` (32+ random chars), `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`.

Store them in the host's secret manager, never in the repo or image.

## Deploy steps
1. Create the Postgres database and app service. Set the environment variables.
2. Build: `docker build -t businestra .`, or let the platform build the Dockerfile.
3. **Release step (before switching traffic):** `npx prisma migrate deploy`. Migrations are additive. Never run `migrate dev` or `migrate reset` against staging or production.
4. Seed reference data once: `SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run db:seed`. **Never** use `SEED_DEMO` in production.
5. Start: `node server.js` (Docker) or `npm start`. Health check path: `/api/health`.
6. Scheduler: daily at 06:00 Africa/Accra (06:00 UTC):
   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://APP/api/cron/daily`
7. HTTPS is terminated by the platform. HSTS is sent automatically in production.

## Domain
1. Register a domain (e.g. a `.com`, or a `.com.gh` from an NCA-accredited registrar).
2. Add the custom domain in the host dashboard, then create the CNAME or A records it gives you. Wait for TLS issuance.
3. Set `APP_URL=https://yourdomain`, set up SPF, DKIM and DMARC for the email provider, and redeploy.

## Paystack: sandbox, then live
1. Create a Paystack account and select Ghana. Copy the **test** secret key into staging `PAYSTACK_SECRET_KEY`.
2. In Settings → API Keys & Webhooks, set the webhook URL to `https://STAGING/api/webhooks/paystack` and the callback URL to `https://STAGING/app/billing/callback`.
3. On staging, test each case and confirm it in the database (`BillingTransaction`, `Subscription`, `AuditLog`):
   - a successful test MoMo payment;
   - a successful test card payment;
   - a declined payment;
   - an abandoned checkout;
   - a re-sent webhook from the Paystack dashboard, which must be shown as a duplicate and must not extend the subscription twice.
4. Complete Paystack business verification (business registration documents and settlement account). Check current requirements and fees on Paystack's site.
5. Once approved, set the **live** key in production and the live webhook URL. Make one small real payment and refund it, to confirm settlement.
6. Webhook source IPs may also be allow-listed at the proxy (check Paystack docs for the current list); the signature check is the primary control.

## Backups and restore
- Enable the provider's **daily automated backups plus point-in-time recovery** (7+ days of retention).
- Weekly logical backup to separate storage:
  `pg_dump --format=custom --no-owner "$DATABASE_URL" > businestra-$(date +%F).dump`
  Encrypt it and store it in a different account or region.
- **Restore** (into a new database first, never over production):
  ```bash
  createdb businestra_restore
  pg_restore --no-owner --dbname=businestra_restore businestra-YYYY-MM-DD.dump
  # verify: row counts, a known customer's balance, latest invoice number
  ```
  Then point `DATABASE_URL` at the restored DB (or promote the provider's PITR copy) and restart.
- **Test a restore before the pilot and monthly after.** Record the date and duration in the ops log.

## Rollback
- **App:** redeploy the previous image or commit from the host dashboard. This is instant, because migrations are additive.
- **Migrations:** write forward-fix migrations; avoid destructive changes in the same release that stops using a column. For a bad data migration, restore with PITR to just before the release (see above).

## Monitoring and logs
- Logs are JSON lines on stdout (`level`, `msg`, context). Request errors come from `src/instrumentation.ts`. Secrets are redacted by key name.
- Alerts:
  - `/api/health` non-200 for 2 minutes;
  - any `level=error` with `msg` of `paystack_webhook_failed`, `billing_amount_mismatch`, `email_not_configured` or `cron_daily_failed`;
  - the daily cron not having run in 26 hours.
- Optional: add Sentry by forwarding from `onRequestError` in `src/instrumentation.ts`.

## Operational runbook

| Situation | Action |
|---|---|
| Customer paid but plan not active | Check `/admin`. Then `BillingTransaction` by reference: if PENDING, run `npm run cron:daily` (it reconciles with Paystack). If the payment was offline (bank or MoMo to the company), use **/admin → Manage → Grant access** with the payment reference in the note. |
| Customer locked out (failed logins) | They can wait 15 minutes or use "Forgot password". |
| Need to extend a pilot | /admin → Manage → Extend trial. |
| Wrong invoice or payment | The business's manager voids it with a reason. Never edit the DB by hand. |
| Suspected data leak or breach | Rotate `PAYSTACK_SECRET_KEY`, DB password and `CRON_SECRET`. Revoke all sessions (`DELETE FROM "Session"`). Review `AuditLog`. Notify affected businesses and the Data Protection Commission as the law requires. Get legal advice. |
| Price change | /admin → Plans. This affects new checkouts only. Give customers 30 days' notice (Terms). |

## Go-live checklist
- [ ] Production DB with backups and PITR enabled; restore tested.
- [ ] All production env vars set; `APP_URL` is https; SMTP sends (test a password reset).
- [ ] `prisma migrate deploy` run; plans seeded; admin account created; demo not seeded.
- [ ] Paystack sandbox checklist passed on staging; live keys approved and configured.
- [ ] Daily cron configured and verified; uptime alerting on `/api/health`.
- [ ] Privacy policy and terms reviewed by a Ghanaian lawyer; "Draft" banner removed.
- [ ] Registered with the Data Protection Commission.
- [ ] Support WhatsApp and email staffed; feedback triaged in /admin.
- [ ] Platform admin uses a strong unique password (2FA is a known gap).
