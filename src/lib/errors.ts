// Errors that are safe to show to the user. Anything else is logged and replaced
// with a generic message so internals never leak to the browser.
export type AppErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PLAN_LIMIT"
  | "SUBSCRIPTION_INACTIVE"
  | "CREDIT_LIMIT"
  | "INSUFFICIENT_STOCK"
  | "PAYMENT_PROVIDER";

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
