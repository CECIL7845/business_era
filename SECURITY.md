# Security

Status reflects the code as of 14 Oct 2026. Report vulnerabilities to the support email. Do not open public issues.

## Controls implemented

| Area | Implementation | Tested |
|---|---|---|
| Passwords | bcrypt, cost 12 in production. Minimum 10 characters with at least one letter and one number. Constant-time-ish login: a dummy hash comparison runs for unknown emails. | `auth.test.ts` |
| Brute force | Per-IP (30 per 15 min) and per-email (10 per 15 min) rate limits, stored in Postgres. Account locks for 15 min after 8 failures. Rate limits also on register, reset, invites, checkout, exports, feedback. | `auth.test.ts` |
| Sessions | 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`__Host-` prefix in production). Only the SHA-256 hash is stored. 30-day rolling expiry. Server-side revocation: logout, "sign out everywhere", and all sessions revoked on password reset. | e2e |
| Password reset / email verification | Single-use, hashed, expiring tokens (1 h / 48 h). Older tokens are invalidated. The reset response doesn't reveal whether the email exists. | `auth.test.ts` |
| Authorization | Central role matrix (`permissions.ts`), checked in every service function, never only in the UI. | `tenancy-permissions.test.ts` |
| Tenant isolation | Business ID taken from the server session plus membership check. Every query is scoped by `businessId`, including referenced IDs. | integration + e2e |
| CSRF | Server Actions: POST plus Next.js Origin/Host check. Cookies are `SameSite=Lax`. Export GET is read-only. Cron uses a bearer secret. Webhook uses HMAC. | e2e (cron/webhook) |
| XSS | React escaping everywhere; no `dangerouslySetInnerHTML`. CSP: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`. | header e2e |
| SQL injection | Prisma query builder. Raw SQL only through parameterised tagged templates; no `$queryRawUnsafe`. | injection-string test |
| Input validation | Zod schemas inside services. Money parsed to integer pesewas without floats. Strict date and phone parsing. Server Action body limit is 1 MB. | unit tests |
| Data integrity | DB transactions, row locks per customer, CHECK constraints on totals and amounts, unique document numbers, conditional updates for stock and idempotency. | concurrency tests |
| Payments | No card data or MoMo PINs touch our servers (Paystack hosted checkout). Access is granted only after server-side verification. Webhook signature check (HMAC-SHA512, constant-time). Amount and currency are matched against the stored expected value. Idempotent application. | `billing.test.ts` |
| Exports | Permission- and plan-gated, rate-limited, audit-logged. CSV formula-injection neutralised. | unit + integration |
| Audit trail | Credit-limit changes and overrides, voids, payments, invites, role changes, exports, billing events and admin actions are written to `AuditLog`. | integration |
| Open redirect | `next` parameter restricted to same-site relative paths. | unit |
| Headers | CSP, HSTS (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. `X-Powered-By` removed. | e2e |
| Errors | Users see generic messages. Details go to structured logs, with secrets redacted by key name. | — |
| Secrets | Only from environment variables. `.env*` is git-ignored. `.env.example` has no values. | — |

## Known gaps and accepted risks (fix before or soon after pilot)

1. **CSP allows `'unsafe-inline'` scripts.** Next.js needs inline bootstrap scripts unless nonces are wired in. Moving to nonce-based CSP via `proxy.ts` is a hardening task.
2. **Client IP comes from `X-Forwarded-For`.** Deploy behind a proxy that overwrites this header (Render, Fly, Railway and Cloudflare do). Otherwise per-IP rate limits can be bypassed. Per-email limits and lockout still apply.
3. **No 2FA**, including for platform admins. Add TOTP for `isPlatformAdmin` users before onboarding many customers.
4. **Registration reveals whether an email is already registered** (a usability trade-off). It is rate-limited.
5. **Sales reps can see all customers** of their business, not only assigned ones (this is a product decision; see the PRD).
6. **No Row-Level Security** in Postgres. Isolation relies on the application layer, which tests cover.
7. **Dependency audit:** `npm audit` reports high-severity advisories in `deepmerge-ts` and `mysql2`. Both are pulled in by the **Prisma CLI** (dev/migration tooling) and are not used at runtime. `mysql2` is only for MySQL; we use Postgres. Also, `eslint-config-next` pulls `braces`/`micromatch` (dev only). Re-check after each Prisma or Next upgrade.
8. **Email delivery** depends on SMTP configuration. In production, missing SMTP is logged as an error and users won't receive reset links.

## Compliance (requires qualified professional advice; not claimed)

- **Data Protection Act, 2012 (Act 843):** register with the Data Protection Commission before processing customer data commercially. Draft privacy policy at `/privacy`. Pilot customers are the data controllers for their retailers' data, and Businestra is the processor. Put a written data processing agreement in place.
- **Tax:** Businestra invoices are commercial documents, **not GRA E-VAT invoices**; this is stated on invoices and in the Terms. Our own subscription revenue may need VAT/levy registration depending on turnover. Consult a tax adviser.
- **Payments:** we use Paystack, a licensed processor, and hold no customer funds. Paystack live mode requires business verification.
- **Messaging:** reminders are user-initiated from their own WhatsApp/SMS. Any future automated SMS needs a licensed provider plus documented recipient consent.
- **Electronic Transactions Act, 2008 (Act 772)** and consumer protection: terms and receipts need legal review.

## Backups
See [DEPLOYMENT.md](DEPLOYMENT.md#backups-and-restore). Test a restore before the pilot and every month after.
