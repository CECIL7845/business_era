import "server-only";
import { z } from "zod";
import { isAppError } from "./errors";
import { logger } from "./logger";

export type ActionState = {
  ok?: boolean;
  error?: string;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** echo of submitted values so forms keep input after a failed submit */
  values?: Record<string, string>;
};

export function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && !/password|token/i.test(k) && !k.startsWith("$")) out[k] = v;
  }
  return out;
}

/** Convert any thrown error into a safe ActionState. Re-throws Next.js control-flow errors (redirect/notFound). */
export function toActionError(e: unknown, fd?: FormData): ActionState {
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string") {
    const digest = (e as { digest: string }).digest;
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND") throw e;
  }
  const values = fd ? formValues(fd) : undefined;
  if (e instanceof z.ZodError) return { error: "Please correct the highlighted fields.", fieldErrors: zodFieldErrors(e), values };
  if (isAppError(e)) return { error: e.message, code: e.code, fieldErrors: e.fieldErrors, values };
  logger.error("action_failed", { err: e });
  return { error: "Something went wrong. Please try again — if it keeps happening, contact support.", values };
}
