const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "";
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@businestra.example";

export function SupportContacts() {
  return (
    <ul className="space-y-1 text-sm">
      {SUPPORT_WHATSAPP && <li>WhatsApp: <a className="text-brand-700 underline" href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{SUPPORT_WHATSAPP}</a> (Mon–Sat, 8am–6pm)</li>}
      <li>Email: <a className="text-brand-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
    </ul>
  );
}

const STEPS: [string, string][] = [
  ["1. Set up your business", "Go to Settings. Add your business phone (the MoMo number customers pay to), address and TIN if you have one. These print on every invoice, receipt and statement."],
  ["2. Add your products", "Products & stock → Add product. Enter the selling unit (carton, bag, crate…), price and opening stock. Set a low-stock alert level. Turn off stock tracking for items you don't count."],
  ["3. Add your retailers and set credit limits", "Customers → Add customer. The credit limit is the most a retailer may owe at any time. 0 means cash only. Only owners and managers can set limits — sales reps can add customers but cannot give credit."],
  ["4. Record credit sales", "Invoices → New invoice. Pick the customer and products. Businestra checks the credit limit and stock before saving. If the customer pays something immediately, open “Customer paid something now?”."],
  ["5. Record collections", "Payments → Record payment. For MoMo and bank payments, enter the transaction ID — the same ID cannot be recorded twice. Payments automatically clear the oldest invoices first."],
  ["6. Chase overdue customers", "The dashboard shows “Who to chase today”. Open a customer and tap WhatsApp reminder — it opens your own WhatsApp with a polite, pre-filled message you can edit before sending."],
  ["7. Send statements", "On a customer page, tap Statement. Print it, save as PDF, or send a summary on WhatsApp."],
  ["8. Invite your team", "Team → Invite. Give sales reps the “Sales rep / collector” role and your accountant the “Viewer” role. Every sensitive action is recorded in the Activity log."],
];

export function HelpGuide() {
  return (
    <div className="space-y-4">
      {STEPS.map(([t, b]) => (
        <div key={t}>
          <h3 className="font-semibold">{t}</h3>
          <p className="text-sm text-slate-600">{b}</p>
        </div>
      ))}
      <div>
        <h3 className="font-semibold">Tips for slow or expensive data</h3>
        <p className="text-sm text-slate-600">Businestra loads no fonts, videos or trackers. Add it to your home screen (browser menu → “Add to Home screen”) for one-tap access. Pages are small and work on 3G.</p>
      </div>
      <div>
        <h3 className="font-semibold">If something goes wrong</h3>
        <p className="text-sm text-slate-600">Mistakes are corrected by voiding (with a reason) and re-entering — nothing is ever silently deleted, so your records stay trustworthy.</p>
      </div>
    </div>
  );
}
