import { LegalPage } from "@/components/public-shell";

export const metadata = { title: "Terms of service (draft)" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="14 October 2026">
      <h2>1. The service</h2>
      <p>Businestra is software for recording credit sales, payments, stock and customer balances. It is a record-keeping tool; it does not lend money, hold funds or collect debts on your behalf.</p>
      <h2>2. Accounts</h2>
      <p>You must provide accurate information and keep your password secret. You are responsible for the actions of staff you invite.</p>
      <h2>3. Free trial and subscriptions</h2>
      <ul>
        <li>New businesses receive a 14-day free trial. No payment details are required to start.</li>
        <li>Subscriptions are prepaid monthly or annually in Ghana cedis via Paystack (Mobile Money or card). We do not charge automatically.</li>
        <li>If a subscription is not renewed, a {7}-day grace period applies, after which the account becomes read-only. Your data is kept and can be exported by the owner.</li>
        <li>Fees are non-refundable except where required by law or at our discretion. Prices may change with 30 days&apos; notice; prepaid periods are honoured.</li>
      </ul>
      <h2>4. Your data</h2>
      <p>You own the records you enter. You may export them at any time. See the Privacy Policy for how we process them.</p>
      <h2>5. Acceptable use</h2>
      <p>Do not use Businestra for unlawful purposes, to harass customers, to send unsolicited bulk messages, or to attempt to access other businesses&apos; data.</p>
      <h2>6. Tax documents</h2>
      <p>Invoices produced by Businestra are commercial invoices. They are <strong>not</strong> GRA E-VAT invoices. VAT-registered businesses remain responsible for issuing tax-compliant invoices through GRA-approved systems.</p>
      <h2>7. Availability and liability</h2>
      <p>We work hard to keep the service available and your data safe, but the service is provided &ldquo;as is&rdquo;. To the extent permitted by Ghanaian law, our total liability is limited to the fees you paid in the 3 months before the claim.</p>
      <h2>8. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of Ghana.</p>
    </LegalPage>
  );
}
