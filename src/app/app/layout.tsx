import Link from "next/link";
import { requireBusiness } from "@/lib/auth/context";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/dates";
import { BottomNav, SideNav, type NavItem } from "@/components/nav";
import { ActionForm, SubmitButton } from "@/components/form";
import { logoutAction, resendVerificationAction } from "@/app/(auth)/actions";
import { switchBusinessAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business, membership, memberships, entitlements: ent } = await requireBusiness();
  const role = membership.role;
  const items: NavItem[] = [
    { href: "/app", label: "Home", icon: "home", mobile: true },
    { href: "/app/customers", label: "Customers", icon: "users", mobile: true },
    { href: "/app/invoices", label: "Invoices", icon: "file", mobile: true },
    { href: "/app/payments", label: "Payments", icon: "cash", mobile: true },
    { href: "/app/products", label: "Products & stock", icon: "box" },
    ...(can(role, "reports.view") ? [{ href: "/app/reports", label: "Reports", icon: "chart" }] : []),
    { href: "/app/team", label: "Team", icon: "team" },
    ...(can(role, "settings.manage") ? [{ href: "/app/settings", label: "Settings", icon: "cog" }] : []),
    ...(can(role, "billing.manage") ? [{ href: "/app/billing", label: "Billing", icon: "card" }] : []),
    ...(can(role, "audit.view") ? [{ href: "/app/activity", label: "Activity log", icon: "shield" }] : []),
    { href: "/app/help", label: "Help & feedback", icon: "help" },
  ];

  return (
    <div className="lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex print:hidden">
        <Link href="/app" className="flex items-center gap-2 px-5 py-4 font-bold text-brand-800">
          <img src="/icon.svg" alt="" className="size-7" /> Businestra
        </Link>
        <div className="flex-1 overflow-y-auto px-3">
          <SideNav items={items} />
        </div>
        <div className="border-t border-slate-200 p-4 text-sm">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{ROLE_LABELS[role]}</p>
          <div className="mt-2 flex gap-3 text-xs">
            <Link href="/app/account" className="text-brand-700 hover:underline">My account</Link>
            {user.isPlatformAdmin && <Link href="/admin" className="text-brand-700 hover:underline">Admin</Link>}
            <form action={logoutAction}><button className="text-slate-500 hover:text-slate-900">Sign out</button></form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur print:hidden">
        <Link href="/app" className="lg:hidden"><img src="/icon.svg" alt="Businestra home" className="size-7" /></Link>
        {memberships.length > 1 ? (
          <form action={switchBusinessAction} className="min-w-0 flex-1">
            <label htmlFor="businessId" className="sr-only">Switch business</label>
            <select id="businessId" name="businessId" defaultValue={business.id} className="w-full max-w-xs truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold">
              {memberships.map((m) => <option key={m.businessId} value={m.businessId}>{m.business.name}</option>)}
            </select>
            <button className="ml-2 text-xs text-brand-700 underline">Switch</button>
          </form>
        ) : (
          <p className="min-w-0 flex-1 truncate font-semibold">{business.name}</p>
        )}
        <Link href="/onboarding" className="hidden text-xs text-slate-500 hover:text-slate-800 sm:block">+ New business</Link>
        <Link href="/app/account" className="text-xs text-slate-500 hover:text-slate-800 lg:hidden">Account</Link>
      </header>

      <div className="space-y-2 px-4 pt-3 empty:hidden print:hidden">
        {business.isDemo && <Banner tone="blue">This is a <strong>demo business with fictional sample data</strong>. Nothing here is real. <Link href="/onboarding" className="underline">Create your real business</Link>.</Banner>}
        {ent.status === "TRIALING" && ent.daysLeft !== null && ent.daysLeft <= 5 && can(role, "billing.manage") && (
          <Banner tone="amber">Your free trial ends in {ent.daysLeft} day{ent.daysLeft === 1 ? "" : "s"} ({formatDate(ent.accessEndsAt!)}). <Link href="/app/billing" className="font-semibold underline">Choose a plan</Link> to keep recording sales.</Banner>
        )}
        {ent.status === "PAST_DUE" && <Banner tone="amber">Your subscription payment is overdue. You have a short grace period — {can(role, "billing.manage") ? <Link href="/app/billing" className="font-semibold underline">renew now</Link> : "ask the owner to renew"} to avoid interruption.</Banner>}
        {ent.status === "EXPIRED" && <Banner tone="red">Your {business.subscription?.status === "TRIALING" ? "trial" : "subscription"} has ended — the account is <strong>read-only</strong>. Your data is safe. {can(role, "billing.manage") ? <Link href="/app/billing" className="font-semibold underline">Renew to continue</Link> : "Ask the owner to renew."}</Banner>}
        {!user.emailVerifiedAt && (
          <Banner tone="gray">
            <span>Please confirm your email ({user.email}) so you can invite staff and recover your account.</span>
            <ActionForm action={resendVerificationAction} className="mt-1 space-y-1">
              <SubmitButton variant="ghost" pendingText="Sending…" className="!px-0 !py-0 text-xs underline">Resend confirmation email</SubmitButton>
            </ActionForm>
          </Banner>
        )}
      </div>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 lg:pb-10">{children}</main>
      <BottomNav items={items} />
    </div>
  );
}

function Banner({ tone, children }: { tone: "amber" | "red" | "blue" | "gray"; children: React.ReactNode }) {
  const t = { amber: "bg-amber-50 text-amber-900 ring-amber-200", red: "bg-red-50 text-red-900 ring-red-200", blue: "bg-sky-50 text-sky-900 ring-sky-200", gray: "bg-slate-100 text-slate-700 ring-slate-200" }[tone];
  return <div role="status" className={`rounded-lg px-4 py-2.5 text-sm ring-1 ${t}`}>{children}</div>;
}
