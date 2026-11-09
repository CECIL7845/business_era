"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action";
import { buttonClass, cx, type Variant } from "./ui";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;
const FormStateCtx = createContext<ActionState>({});
const FormPendingCtx = createContext(false);

/**
 * Form bound to a server action. With JavaScript, it submits inside a transition so
 * React does NOT auto-reset the form — after a validation error every field (including
 * controlled ones) keeps what the user typed. Without JavaScript, the native `action`
 * still works (progressive enhancement).
 */
export function ActionForm({ action, children, className, resetOnSuccess, onSuccessMessage }: { action: Action; children: ReactNode; className?: string; resetOnSuccess?: boolean; onSuccessMessage?: boolean }) {
  const [state, formAction] = useActionState(action, {});
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <FormStateCtx.Provider value={state}>
     <FormPendingCtx.Provider value={pending}>
      <form
        ref={ref}
        action={formAction}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return; // no double submits
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const fd = new FormData(e.currentTarget, submitter);
          startTransition(() => formAction(fd));
        }}
        className={cx("space-y-4", className)}
        noValidate
      >
        {state.error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
            {state.error}
          </div>
        )}
        {onSuccessMessage !== false && state.ok && state.message && (
          <div role="status" className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
            {state.message}
          </div>
        )}
        {children}
      </form>
     </FormPendingCtx.Provider>
    </FormStateCtx.Provider>
  );
}

export const useFormState = () => useContext(FormStateCtx);

const inputClass = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 disabled:bg-slate-100";

function FieldShell({ name, label, hint, children, error }: { name: string; label: ReactNode; hint?: ReactNode; children: ReactNode; error?: string }) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Field({ name, label, hint, defaultValue, ...props }: ComponentProps<"input"> & { name: string; label: ReactNode; hint?: ReactNode }) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      <input
        id={name}
        name={name}
        defaultValue={state.values?.[name] ?? defaultValue}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cx(inputClass, error && "border-red-400")}
        {...props}
      />
    </FieldShell>
  );
}

export function TextArea({ name, label, hint, defaultValue, ...props }: ComponentProps<"textarea"> & { name: string; label: ReactNode; hint?: ReactNode }) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      <textarea id={name} name={name} rows={3} defaultValue={state.values?.[name] ?? defaultValue} aria-invalid={!!error} className={cx(inputClass, error && "border-red-400")} {...props} />
    </FieldShell>
  );
}

export function Select({ name, label, hint, defaultValue, options, ...props }: ComponentProps<"select"> & { name: string; label: ReactNode; hint?: ReactNode; options: { value: string; label: string }[] }) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  return (
    <FieldShell name={name} label={label} hint={hint} error={error}>
      <select id={name} name={name} defaultValue={state.values?.[name] ?? (defaultValue as string)} aria-invalid={!!error} className={cx(inputClass, error && "border-red-400")} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ name, label, hint, defaultChecked }: { name: string; label: ReactNode; hint?: ReactNode; defaultChecked?: boolean }) {
  const state = useFormState();
  const checked = state.values ? state.values[name] === "on" : defaultChecked;
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-4 rounded border-slate-300 accent-brand-700" />
      <span>
        <span className="font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function SubmitButton({ children, variant = "primary", pendingText = "Saving…", className }: { children: ReactNode; variant?: Variant; pendingText?: string; className?: string }) {
  const status = useFormStatus();
  const pending = useContext(FormPendingCtx) || status.pending;
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cx(buttonClass(variant), className)}>
      {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * A button that opens a confirmation dialog before running a destructive action.
 * Optionally requires a written reason (stored in the audit log).
 */
export function ConfirmAction({
  action,
  label,
  title,
  body,
  confirmLabel = "Confirm",
  hidden,
  requireReason,
  variant = "danger",
  size = "sm",
}: {
  action: Action;
  label: string;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  hidden?: Record<string, string>;
  requireReason?: boolean;
  variant?: Variant;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok) setOpen(false);
    return result;
  }, {});
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);
  return (
    <>
      <button type="button" className={buttonClass(variant, size)} onClick={() => setOpen(true)}>
        {label}
      </button>
      <dialog ref={dialogRef} onClose={() => setOpen(false)} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40">
        <form action={formAction} className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="text-sm text-slate-600">{body}</div>
          {Object.entries(hidden ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {requireReason && (
            <div>
              <label htmlFor="reason" className="mb-1 block text-sm font-medium">
                Reason (kept in the audit log)
              </label>
              <input id="reason" name="reason" required minLength={3} maxLength={300} className={inputClass} />
            </div>
          )}
          {state.error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass("secondary")} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <SubmitButton variant={variant === "danger" ? "danger" : "primary"} pendingText="Working…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
