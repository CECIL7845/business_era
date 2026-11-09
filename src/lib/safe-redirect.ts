/** Only allow same-site relative redirect targets (prevents open-redirect phishing). */
export function safeNext(raw: unknown, fallback = "/app"): string {
  const v = typeof raw === "string" ? raw : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || /[\r\n\t]/.test(v)) return fallback;
  return v;
}
