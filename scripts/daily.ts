// Run the daily maintenance jobs directly (alternative to calling /api/cron/daily).
import "dotenv/config";
import { db } from "../src/lib/db";
import { runDailyJobs } from "../src/lib/services/cron";

runDailyJobs()
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
