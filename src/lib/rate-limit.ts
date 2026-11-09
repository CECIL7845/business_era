import "server-only";
import { db } from "./db";
import { AppError } from "./errors";

/**
 * Fixed-window rate limiter stored in Postgres, so it works across multiple app
 * instances without Redis. Returns the current count after incrementing.
 */
export async function hit(key: string, windowSeconds: number): Promise<number> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::int) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::int) THEN now() ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  return rows[0].count;
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number, message = "Too many attempts. Please wait a few minutes and try again.") {
  const count = await hit(key, windowSeconds);
  if (count > limit) throw new AppError("RATE_LIMITED", message);
}

export async function resetRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}
