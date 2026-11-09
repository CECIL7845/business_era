import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatCedis } from "@/lib/money";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const variants = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-700/60",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/60",
  ghost: "text-slate-700 hover:bg-slate-100",
};
export type Variant = keyof typeof variants;
export const buttonClass = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap",
    size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-4 py-2.5 text-sm",
    variants[variant],
  );

export function LinkButton({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: "sm" | "md" }) {
  return <Link {...props} className={cx(buttonClass(variant, size), className)} />;
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-xl bg-white shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 print:hidden">
      {back && (
        <Link href={back.href} className="mb-1 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const badgeTones = {
  gray: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", badgeTones[tone])}>{children}</span>;
}

export function Money({ value, className, colorNegative }: { value: number; className?: string; colorNegative?: boolean }) {
  return <span className={cx("tabular-nums", colorNegative && value < 0 && "text-emerald-700", className)}>{formatCedis(value)}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "green" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx("mt-1 text-xl font-bold tabular-nums sm:text-2xl", tone === "red" && "text-red-700", tone === "green" && "text-emerald-700")}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "amber", children, title }: { tone?: "amber" | "red" | "green" | "blue"; children: ReactNode; title?: string }) {
  const tones = { amber: "bg-amber-50 text-amber-900 ring-amber-200", red: "bg-red-50 text-red-900 ring-red-200", green: "bg-emerald-50 text-emerald-900 ring-emerald-200", blue: "bg-sky-50 text-sky-900 ring-sky-200" };
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cx("rounded-lg px-4 py-3 text-sm ring-1", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

/** Builds links that keep existing query params (search, filters) while changing some. */
export function withParams(base: string, params: Record<string, string | number | undefined | null>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") usp.set(k, String(v));
  const s = usp.toString();
  return s ? `${base}?${s}` : base;
}

export function Pagination({ page, pageCount, total, href }: { page: number; pageCount: number; total: number; href: (page: number) => string }) {
  if (pageCount <= 1) return <p className="px-4 py-3 text-xs text-slate-500">{total} record{total === 1 ? "" : "s"}</p>;
  return (
    <nav className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm" aria-label="Pagination">
      <span className="text-xs text-slate-500">
        Page {page} of {pageCount} · {total} records
      </span>
      <div className="flex gap-2">
        {page > 1 ? <LinkButton variant="secondary" size="sm" href={href(page - 1)}>Previous</LinkButton> : <span className={cx(buttonClass("secondary", "sm"), "opacity-40")}>Previous</span>}
        {page < pageCount ? <LinkButton variant="secondary" size="sm" href={href(page + 1)}>Next</LinkButton> : <span className={cx(buttonClass("secondary", "sm"), "opacity-40")}>Next</span>}
      </div>
    </nav>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50";
export const td = "px-4 py-3 align-top";

export function SearchBar({ action, q, children, placeholder = "Search…" }: { action: string; q?: string; children?: ReactNode; placeholder?: string }) {
  return (
    <form action={action} method="get" className="flex flex-wrap gap-2 border-b border-slate-100 p-3" role="search">
      <input name="q" defaultValue={q} placeholder={placeholder} aria-label="Search" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      {children}
      <button className={buttonClass("secondary", "sm")}>Search</button>
    </form>
  );
}
