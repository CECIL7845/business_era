# Product Requirements: Businestra MVP

## Problem
Ghanaian wholesalers and distributors sell to retailers on credit, but debts live in notebooks. Credit limits aren't enforced, collections by reps are hard to verify, and owners don't know who to chase. (See BUSINESS_MODEL.md. These are hypotheses until validated.)

## Users and roles

| Role | Who | Can |
|---|---|---|
| Owner | Business owner | Everything, including billing and managing owners |
| Manager | Trusted manager | Everything except billing; sets credit limits, overrides limits, voids, manages products and stock |
| Sales rep / collector | Field staff | Adds customers (limit 0), issues invoices at list price within limits, records payments |
| Viewer / accountant | Bookkeeper | Read-only, reports, exports |

All permissions are enforced on the server in `src/lib/auth/permissions.ts` and in every service function.

## MVP scope

Status per feature: ✅ built and tested, 🟡 built but partial, ⏳ not built.

**Accounts and onboarding**
- ✅ Register and log in with bcrypt-hashed passwords.
- ✅ Email verification. Invitations are blocked until the inviter's email is confirmed.
- ✅ Password reset: single-use 1-hour token, signs out all sessions.
- ✅ Business setup. Each new business gets a 14-day trial.
- ✅ Demo business with fictional data, clearly flagged.
- ✅ Staff invitations bound to the invited email, with role change and removal (last owner protected).
- ✅ Profile, password change, signed-in devices, sign out everywhere.

**Customers**
- ✅ Create and edit customers.
- ✅ Credit limit and terms (limits only set by owner or manager).
- ✅ Assigned rep, active/inactive.
- ✅ Search by name, phone or location; filters (owing, overdue, over limit, inactive, assigned to me); sort; pagination.
- ✅ Customer page with live balance, overdue amount, available credit, unpaid invoices and payments.
- ✅ WhatsApp and SMS reminder, sent from the user's own phone via a prefilled link.
- ✅ Printable statement for any date range, with opening and closing balance and unpaid invoice list; WhatsApp summary.

**Invoices (credit sales)**
- ✅ Multi-line invoices from the product catalogue (custom lines for owner and manager only); discount; due date from customer terms.
- ✅ Credit-limit enforcement, with manager override recorded as a distinct audit action.
- ✅ Stock decremented atomically; overselling is refused.
- ✅ "Paid now" for cash sales.
- ✅ Sequential numbering per business (configurable prefix).
- ✅ Printable invoice and WhatsApp share.
- ✅ Void with reason: restores stock and re-allocates payments.

**Payments**
- ✅ Cash, MoMo, bank and cheque.
- ✅ Reference required for MoMo and bank; duplicate references blocked.
- ✅ FIFO allocation to the oldest-due invoices; overpayment kept as customer credit.
- ✅ Printable receipt and WhatsApp receipt.
- ✅ Void with reason.

**Products and stock**
- ✅ Products with unit, price, cost and SKU.
- ✅ Opening stock, restock, and adjustments (reason required).
- ✅ Movement history and low-stock alerts.

**Dashboard and reports**
- ✅ Owed, overdue, collected (month and today), sales this month.
- ✅ Who to chase, debt by age, recent payments, low stock.
- ✅ Period report: sales, collections by method, sales and collections by staff member.
- ✅ CSV exports (customers, aging, invoices, payments) with formula-injection protection; plan-gated and audited.

**Billing**
- ✅ Starter, Growth and Distributor plans (editable in admin).
- ✅ Trial, then active, past due (7-day grace), then expired (read-only).
- ✅ Paystack checkout (MoMo, card, bank transfer).
- ✅ Webhook with signature check and server-side verification; idempotent.
- ✅ Renew early (time is added); plan change (remaining value converted); cancel and resume.
- ✅ Billing history and printable receipts.
- ✅ Plan limits on users and customers.
- ✅ Daily reconciliation and renewal reminder emails.

**Platform**
- ✅ Admin console: metrics (MRR, active businesses), business list, manual activation for offline payment, trial extension, plan price editing, feedback triage.
- ✅ Activity log for the owner and manager.
- ✅ Feedback form.
- ✅ Landing page with prices from the database, FAQ, help guide, and privacy and terms drafts.
- ✅ Health check, JSON logs, PWA manifest.

## Deliberately out of scope (MVP)
- Lending or financing, holding customer funds, collecting MoMo *from retailers* inside the app.
- GRA E-VAT invoices.
- Automated or bulk SMS and WhatsApp sending (would need a licensed provider and documented consent).
- Purchase orders and supplier payables, expenses, multi-branch or multi-warehouse, offline mode, native apps.
- Restricting sales reps to *only* their assigned customers. Today reps see all customers in the business; a "mine" filter exists.

## Non-functional requirements
- Mobile-first; no horizontal scroll on phones (e2e-tested).
- System fonts only and no third-party scripts, to keep data use low.
- GHS formatting (`GH₵1,234.50`), Ghana phone validation (+233), Africa/Accra dates.
- Money stored as integer pesewas; database CHECK constraints protect totals.
