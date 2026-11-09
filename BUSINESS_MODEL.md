# Businestra — Business Model

> **Status: hypotheses, not results.** No customer has been interviewed or has paid yet. Every price, cost, churn and CAC figure below is an assumption to be tested through [CUSTOMER_VALIDATION.md](CUSTOMER_VALIDATION.md). Nothing here is a revenue forecast or a promise.

## 1. Research summary (October 2026)

Sources are listed in §9. **V** = verified from a primary or official source. **R** = reported by a secondary source and not independently verified. **A** = our assumption.

| Finding | Type |
|---|---|
| Ghana had about 1.87–1.9M business establishments in 2024, and about 92% are micro (1–5 people) and informal (GSS IBES 2024, via Graphic/Ghanaian Times). | R |
| GSS defines micro as 1–5 persons engaged and small as 6–29. | V (GSS presentation) |
| Generic SME tools are crowded and cheap. Hubtel POS was launched free for merchants (2018). SikaBooks lists GHS 49–149/month. OceanCyber POS starts at GHS 99/month. Chopmoney, nStore, Odwadini and Pocketi target micro-shop bookkeeping and debt tracking. | R (vendor pages) |
| Paystack Ghana charges 1.95% on local transactions (cards, MoMo, bank transfer). | V (Paystack support page) |
| Trade credit in Ghana is largely informal. Recovery firms report rising trade-debt defaults and SMEs hit hardest (B&FT/GNBCC, July 2026). Pharma suppliers moved defaulting clients to cash-and-carry. | R |
| GRA is rolling out E-VAT certified invoicing for VAT-registered taxpayers and offers a free invoicing system. | R (vendor blogs; GRA notice not found) |
| Data Protection Act 2012 (Act 843) requires controllers to register with the Data Protection Commission. Fees vary by entity. | V (DPC site) / fee amount not found |
| School management software in Ghana is listed at roughly GHS 600–1,200/month flat, or GHS 15–45 per student per year. | R (vendor estimates) |

**What the research does *not* show:** how many FMCG, pharma or building-materials distributors there are in Ghana, their bad-debt rates, or what they pay for software today. These are the most important unknowns, and §6 of the validation plan targets them directly.

## 2. Opportunity scorecard

Each option is scored 1–5 per criterion and weighted as below, giving a total out of 100. **The scores are our judgment, not measured data.** The author of this document also recommends option E, so treat its score as biased until interviews confirm it.

| Criterion | Weight |
|---|---|
| Problem severity | 15 |
| Willingness / ability to pay | 15 |
| Reachable customers / acquisition ease | 12 |
| Competition & differentiation | 12 |
| Recurring revenue & retention | 12 |
| Regulatory / operational risk (5 = low risk) | 8 |
| Development complexity (5 = simple) | 8 |
| Problem frequency | 6 |
| Initial capital (5 = low) | 6 |
| Expansion beyond Ghana | 6 |

| Option | Sev | Freq | WTP | Reach | Comp | Ret | Dev | Cap | Reg | Exp | **Score** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A. Generic SME bookkeeping / POS | 3 | 5 | 2 | 4 | 1 | 3 | 4 | 4 | 4 | 4 | 62.6 |
| B. AI WhatsApp sales / support automation | 3 | 4 | 3 | 3 | 3 | 3 | 2 | 3 | 2 | 4 | 59.2 |
| C. B2B wholesale ordering marketplace | 4 | 5 | 2 | 2 | 3 | 3 | 2 | 1 | 3 | 4 | 57.2 |
| D. Invoicing/expenses + E-VAT for formal SMEs | 4 | 4 | 3 | 3 | 2 | 4 | 2 | 3 | 2 | 2 | 59.8 |
| **E. Distributor credit sales & collections** | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | **81.2** |
| F. Private school fee management | 3 | 3 | 3 | 4 | 2 | 4 | 3 | 4 | 4 | 3 | 65.2 |

Why the others lost:

- **A.** Free and cheap tools (Hubtel POS, SikaBooks at GHS 49) anchor micro-shop prices near zero, and micro shops churn.
- **B.** Dependence on WhatsApp Business API policy and pricing, unclear willingness to pay, and fast commoditisation.
- **C.** Needs logistics, inventory and working capital. Several funded African B2B e-commerce players have retrenched.
- **D.** Gated by GRA certification. GRA offers a free alternative, and enforcement timing is uncertain.
- **F.** A viable runner-up with crowded vendors and termly (not monthly) pain. Revisit it if E fails validation.

## 3. The selected business

**Product:** Businestra, credit sales and collections for Ghanaian wholesalers and distributors.

**Initial segment (ICP):** owner-managed FMCG / provisions wholesalers and sub-distributors in Accra (Makola, Kaneshie, Madina, Kasoa) and Kumasi (Adum, Kejetia) that:

- supply 30–400 retailers;
- sell on credit with 7–30 day terms;
- have 1–10 staff, including at least one sales rep or van driver collecting money;
- currently track debts in exercise books, receipt booklets or Excel.

**Problem:** these businesses can't reliably answer "who owes me what, since when, and who collected what." Credit grows without approval. Reps and retailers dispute payments, and MoMo payments are double-counted or missed. Cash is trapped in receivables.

**Why they would switch:**

- Credit limits are enforced at the point of sale, not reviewed after the fact.
- Every payment is attributed to a staff member, and duplicate MoMo references are blocked.
- One tap produces a WhatsApp reminder or statement for a retailer.
- It works on a cheap Android phone.
- Generic bookkeeping apps are built for micro shops recording their own sales. They are not built to control a network of customers who owe money.

**Advantage:** focus. Credit control features such as limits, overrides with an audit trail, aging, statements and rep accountability, priced in cedis and paid by MoMo. We also deliberately avoid the regulated parts (lending, holding funds, E-VAT).

## 4. Revenue streams and pricing hypotheses

| Plan | Monthly | Annual (2 months free) | Users | Active customers | Exports |
|---|---|---|---|---|---|
| Starter | GHS 99 | GHS 990 | 2 | 150 | No |
| Growth | GHS 249 | GHS 2,490 | 6 | 1,000 | Yes |
| Distributor | GHS 549 | GHS 5,490 | 20 | Unlimited | Yes |

- Trial: 14 days on Growth, no payment details needed.
- **Paid setup and training (A):** GHS 300–800 one-off to load customers, products and opening balances and train staff. This is likely the first real revenue and the best willingness-to-pay signal.
- **Later (not built):** SMS reminder bundles via a licensed SMS provider (cost plus margin), and a multi-branch add-on.
- **Price rationale (A):** a distributor owed GHS 50,000 who collects even 5% faster frees about GHS 2,500 of cash. GHS 249 needs to recover only a small fraction of that. Prices sit above micro-shop tools (GHS 49–149) because the buyer is larger and the pain is bigger. All three prices must be tested; see the validation plan.

Prices are editable at runtime in `/admin` (stored in the `Plan` table).

## 5. Operating costs (monthly, assumptions)

The exchange rate is assumed at USD 1 ≈ GHS 12. **Verify the current rate before relying on any USD-denominated cost.**

| Item | GHS / month | Notes |
|---|---|---|
| Hosting (app + managed Postgres + backups) | ~480 | e.g. Render or Railway at USD ~40 |
| Transactional email | ~0–240 | free tiers cover early volume |
| Domain, misc. SaaS | ~330 | |
| **Infrastructure subtotal** | **~1,050** | |
| Founder draw (modest) | 8,000 | A |
| Part-time support / onboarding | 3,000 | A |
| Marketing (transport, printing, events) | 2,000 | A |
| **Full fixed costs** | **~14,050** | |

**Variable cost per paying customer (A):**

- Paystack 1.95% of revenue: about GHS 4.6 at GHS 234 ARPU.
- Infrastructure marginal: about GHS 5.
- Support time: about GHS 30.

That gives a gross margin of about 83% in the base case.

## 6. Unit economics (three scenarios, all hypothetical)

Base ARPU assumes a plan mix of 40% Starter, 45% Growth and 15% Distributor, which gives GHS 234/month.

| | Conservative | Base | Optimistic |
|---|---|---|---|
| ARPU (GHS/month) | 180 | 234 | 280 |
| Gross margin | 75% | 83% | 87% |
| Monthly logo churn | 6% | 4% | 2.5% |
| CAC (GHS; field visits, demos, referral fees) | 900 | 600 | 350 |
| **LTV** = ARPU × GM ÷ churn | 2,250 | 4,856 | 9,744 |
| LTV : CAC | 2.5 | 8.1 | 27.8 |
| CAC payback (months) | 6.7 | 3.1 | 1.4 |
| Break-even: infrastructure only | 8 customers | 6 customers | 5 customers |
| Break-even: full fixed costs (GHS 14,050) | 105 customers | 73 customers | 58 customers |
| Paying customers at month 12 (A) | 40 | 100 | 200 |
| MRR at month 12 | GHS 7,200 | GHS 23,400 | GHS 56,000 |
| ARR run-rate at month 12 | GHS 86,400 | GHS 280,800 | GHS 672,000 |

**How to read this:**

- The conservative case does not cover a founder salary within 12 months.
- The model depends on churn and CAC far more than on price. Measure both from the first pilots.
- The month-12 customer counts are illustrative targets, not forecasts.

## 7. Acquisition and retention

**Acquisition (one market first: Accra wholesale clusters):**

1. **Direct field visits** to wholesale shops in Kaneshie, Makola and Madina, with a 5-minute phone demo on the shop's own data.
2. **Accountant and bookkeeper partners** who serve distributors. Offer a 15% recurring referral share, as a hypothesis.
3. **Manufacturer and importer distributor networks:** pitch credit discipline across their sub-distributors.
4. **Customer referrals:** one free month per referred paying customer.
5. **Opt-in WhatsApp Status and groups**, plus market associations. **No unsolicited bulk messages.**

Paid ads come only after the funnel converts.

**Retention levers:**

- The ledger becomes the system of record, which creates switching cost.
- A weekly "money owed" email digest (future work).
- Onboarding calls on day 1, 3 and 10 of the trial.
- Fast WhatsApp support.
- An annual plan discount.

## 8. 90-day launch plan

| Weeks | Goal | Exit criterion |
|---|---|---|
| 1–2 | Deploy staging and production on a domain. Register with the Data Protection Commission. Get Paystack live approval. Have a lawyer review terms and privacy. | Production health check green. Paystack sandbox payment end-to-end. |
| 1–4 | 25 structured interviews (see validation). Recruit 5 pilot distributors. | Go/no-go criteria in CUSTOMER_VALIDATION.md met. |
| 3–8 | Pilots run with paid setup (GHS 300 suggested). Weekly check-ins. Fix top issues. | ≥3 pilots active weekly for 4 consecutive weeks. |
| 6–10 | Convert pilots to paid plans. Ask for referrals and recordable (real) testimonials. | ≥3 paying, ≥1 referral. |
| 9–13 | Repeatable outreach in one cluster. Set up an accountant partnership. | 10–15 paying customers, churn and CAC measured. |

## 9. Sources

- Graphic Online, 2024 IBES report: https://www.graphic.com.gh/business/business-news/ghanas-business-landscape-expands-but-growth-remains-uneven-2024-ibes-report.html
- Ghanaian Times, informal economy: https://ghanaiantimes.com.gh/ghanas-economy-remains-largely-informal-government-statistician
- GSS IBES presentation (size definitions): https://statsghana.gov.gh/IBES_FES/Slides%20and%20Manual%20for%20FES/Presentation_1_Introduction%20to%20IBES.pdf
- Paystack transaction pricing: https://support.paystack.com/hc/en-us/articles/360009881920-What-are-Paystack-s-transaction-charges
- Paystack Ghana: https://paystack.com/gh/why-choose-paystack
- SikaBooks pricing: https://smartqix.com/products/sikabooks
- OceanCyber POS: https://oceancyber.net/products/pos
- Hubtel POS launch: https://news.hubtel.com/?p=2161 · Hubtel retail features: https://citibusinessnews.com/?p=509364
- nStore (Moolre): https://startup.moolre.com/leaderboard/185 · Chopmoney: https://www.myjoyonline.com/chopmoney-bookkeeping-seeks-to-simplify-bookkeeping-for-ghanas-small-businesses/
- Trade debt defaults (GNBCC/B&FT): https://gnbcc.net/debt-defaults-squeeze-businesses/ · Pharma credit withdrawal: https://www.graphic.com.gh/news/general-news/pharma-manufacturers-withdraw-credit-deals.html · Trade credit paper: https://mpra.ub.uni-muenchen.de/80014/1/MPRA_paper_80014.pdf
- Shopa (B2B retail ordering): https://bfaglobal.com/?p=256018 · Boost Ghana: https://www.cbinsights.com/company/boost-ghana
- E-VAT: https://www.fonoa.com/resources/blog/ghana-e-vat-e-invoicing-2026 · https://www.vatcalc.com/ghana/ghana-e-vat-electronic-invoicing-rollout/
- Data Protection Commission: https://dataprotection.org.gh · FAQ: https://dataprotection.org.gh/?p=5766
- School software pricing (vendor estimate): https://kolonell.com/en/blog/school-management-software-ghana-kenya-2026
