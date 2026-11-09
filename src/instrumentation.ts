import type { Instrumentation } from "next";

// Central server error reporting. Logs structured JSON (picked up by the host's log
// drain). To add Sentry or similar, forward from here — see DEPLOYMENT.md.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      msg: "request_error",
      digest: e.digest,
      error: e.message,
      stack: e.stack,
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );
};
