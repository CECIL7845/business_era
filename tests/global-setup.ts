import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must be set");
  if (!/test/.test(new URL(url).pathname)) throw new Error("Refusing to run: TEST_DATABASE_URL database name must contain 'test'");
  // Apply migrations (non-destructive). Tests create uniquely-named tenants, so they
  // don't depend on an empty database and can run repeatedly against the same DB.
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
