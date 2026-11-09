import { LegalPage } from "@/components/public-shell";

export const metadata = { title: "Privacy policy (draft)" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="14 October 2026">
      <p>This policy explains how Businestra (&ldquo;we&rdquo;) handles personal data. We intend to comply with Ghana&apos;s Data Protection Act, 2012 (Act 843), including registration with the Data Protection Commission as a data controller/processor before commercial launch.</p>
      <h2>Two kinds of data</h2>
      <ul>
        <li><strong>Account data</strong> — your name, email, phone and password (stored only as a one-way hash). We are the data controller for this.</li>
        <li><strong>Business records you enter</strong> — your customers&apos; names, phone numbers, locations, invoices and payments. Your business is the data controller for these records; we process them only to provide the service to you.</li>
      </ul>
      <h2>What we use data for</h2>
      <ul>
        <li>Providing the service, keeping it secure, and preventing fraud and abuse.</li>
        <li>Sending service emails (verification, password reset, invitations, billing reminders).</li>
        <li>Aggregate, non-identifying usage statistics (e.g. how many invoices are created per week) to improve the product. We do not use third-party advertising trackers.</li>
      </ul>
      <h2>Sharing</h2>
      <p>We do not sell personal data. We share data only with service providers needed to run Businestra (hosting, database, email delivery and Paystack for subscription payments), under contracts requiring them to protect it, or when required by Ghanaian law.</p>
      <h2>Messaging your customers</h2>
      <p>WhatsApp and SMS reminders are sent from <em>your own phone</em>; Businestra only prepares the message text. You are responsible for having a legitimate reason to contact your customers.</p>
      <h2>Payments</h2>
      <p>Subscription payments are processed by Paystack. We never see or store your card number, CVV or mobile money PIN.</p>
      <h2>Retention and your rights</h2>
      <p>We keep data while your account is active and for a limited period afterwards for legal and accounting purposes. You may request access to, correction of, or deletion of your personal data, and export your business records at any time.</p>
      <h2>Security</h2>
      <p>Data is encrypted in transit (HTTPS), access is restricted by role, sensitive actions are logged, and backups are taken daily.</p>
      <h2>Contact</h2>
      <p>Questions or requests: the support email shown on our Help page.</p>
    </LegalPage>
  );
}
