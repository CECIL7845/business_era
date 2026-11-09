# Customer Validation Plan

> **No validation has been done yet.** This plan must be carried out in person by the founder. The software cannot interview customers. Record raw notes, never summaries only, and never invent or "round up" results.

## 1. Hypotheses to test

| # | Hypothesis | Evidence that would disprove it |
|---|---|---|
| H1 | Distributors that sell on credit lose meaningful money or time to late or disputed payments. | Most say debts are "not a problem", or are under GHS 5,000 in total. |
| H2 | They track debts in notebooks or Excel and know it is unreliable. | They already use software they are happy with. |
| H3 | Rep collections and MoMo reconciliation cause disputes or suspected leakage. | No staff handle money, or no disputes in the last 3 months. |
| H4 | They will pay GHS 99–549/month for enforced credit control. | Nobody accepts paid setup or a paid month after a working pilot. |
| H5 | They will use it at least weekly. | Pilot usage drops below weekly after week 2. |

## 2. Who to interview (target 25)

- 15 FMCG / provisions wholesalers and sub-distributors (Accra: Kaneshie, Makola, Madina, Kasoa. Kumasi: Adum).
- 4 pharmaceutical wholesalers (Pharmacy Council licensed).
- 3 building-materials or cement depots.
- 3 accountants or bookkeepers who serve distributors (as a channel test).

**Qualify:** sells to at least 30 retail customers, at least some on credit, and is owner or manager.

## 3. Interview script (30 minutes, problem first, no pitch until the end)

1. Tell me about your business. Who are your customers, and how many do you supply regularly?
2. What share of your sales is on credit? What terms do you give?
3. Walk me through the last time a customer bought on credit, from the order to when they paid.
4. How do you know today how much each customer owes? Can you show me? *(Ask to see the book or sheet.)*
5. In the last 3 months, has a customer disputed what they owe? What happened?
6. Who collects payments? How do you check that what they collected is what they handed in?
7. How do MoMo payments reach you? How do you match them to customers?
8. Roughly how much is owed to you right now? How much of it is more than 30 days late?
9. Have you ever written off a debt? About how much in the last year?
10. What have you tried to fix this, such as apps, Excel or a bookkeeper? Why did you stop?
11. If this problem disappeared, what would it be worth to you each month?
12. *(Only now)* Show the 5-minute demo. Then ask: "Would you want to try this with your real customers for a month?"

## 4. Demonstration workflow (5 minutes, on a phone)

1. Open the demo business (`Explore with sample data`) and go to **Who to chase today**.
2. Open an overdue customer: balance, overdue amount and days late. Tap **WhatsApp reminder**.
3. Create an invoice that exceeds the credit limit. Show the block, then the manager override and its activity-log entry.
4. Record a MoMo payment, then try the same transaction ID again to show the duplicate block.
5. Show the statement and the debt-by-age chart.

## 5. Pilot terms (proposed)

- Duration: 4 weeks.
- **Paid setup of GHS 300.** This is the willingness-to-pay test. Refund it if we fail to load their data within 3 days.
- We load customers, products and opening balances.
- Weekly 15-minute check-in. They can export their data at any time.
- At the end: continue on a paid plan, or leave with their exported data.
- Written consent covers storing their customers' details. We are the data processor and they are the controller (see Privacy).

## 6. Metrics to record per pilot

- Invoices and payments recorded per week.
- Active days per week.
- Number of staff using the app.
- Reminders sent.
- Owner's self-reported time saved and disputes resolved.
- Overdue amount at the start and at week 4 (from the app).
- Conversion: did they pay for setup, and did they pay for month 2?

## 7. Go / no-go criteria (decide at week 8)

**GO (scale outreach)** when all of these hold:

- At least 20 qualified interviews completed.
- At least 12 of 20 confirm the problem is frequent and costly (they can name an amount or a dispute in the last 3 months).
- At least 5 pilots started, with at least 3 paying the setup fee.
- At least 3 pilots active weekly in each of weeks 2–4.
- At least 2 convert to a paid monthly plan at listed price (no discount beyond the first month).

**PIVOT the segment** (for example to pharma wholesalers or building materials) if the problem is confirmed but FMCG willingness to pay fails.

**NO-GO** (revisit option F or others in BUSINESS_MODEL.md) if fewer than 8 of 20 confirm the problem, or nobody pays for setup.

## 8. Results log (fill in, do not fabricate)

| Date | Business (code name) | Segment | Customers on credit | Owed now (GHS) | Key quote | Pilot? | Paid? |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## 9. Outreach messages (use only with people you have a relationship with or have met; no bulk sends)

**In-person opener:**
> "Good morning. I'm building a simple phone tool for wholesalers to track which shops owe them, and to stop credit getting out of hand. I'm not selling anything today. Can I ask you 10 minutes of questions about how you manage credit?"

**WhatsApp follow-up (after meeting, with permission):**
> "Hello [Name], thank you for your time at [shop] today. As promised, this is the tool I showed you: [link]. If you'd like, I can load your customers and current balances for you this week. It's GHS 300 for setup, refunded if I can't get you running in 3 days."

**Accountant partner:**
> "Hello [Name], several of your distributor clients probably keep debtors in notebooks. Businestra gives them live balances, aging and statements, and you get clean CSV exports. I'd like to offer your clients setup at a partner rate and share 15% of the subscription with you. Can we talk for 15 minutes?"

## 10. Converting a prospect to a paying customer

1. Qualify (§2).
2. Problem interview (§3).
3. Demo on the demo business (§4).
4. Offer the paid-setup pilot (§5).
5. Load their data. They record their first real invoice together with you.
6. Week 1 check-in: send the first reminders and statements.
7. Week 4 review against §6 metrics.
8. Ask them to choose a plan and pay with MoMo via the Billing page (or arrange offline payment, then activate in /admin).
9. Ask for a referral.
