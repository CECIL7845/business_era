// Seeds reference data (plans) and, optionally, a platform admin account.
// Safe to re-run. Never creates demo data in production unless explicitly asked.
//   npm run db:seed
//   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='...' npm run db:seed
//   SEED_DEMO=1 npm run db:seed   (creates a demo user + demo business, development only)
import "dotenv/config";
import { db } from "../src/lib/db";
import { ensurePlans } from "../src/lib/services/business";
import { hashPassword } from "../src/lib/auth/password";
import { createDemoBusiness } from "../src/lib/services/demo";

async function main() {
  await ensurePlans();
  console.log("✓ plans");

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
    await db.user.upsert({
      where: { email },
      create: { email, name: "Platform admin", passwordHash: await hashPassword(password), isPlatformAdmin: true, emailVerifiedAt: new Date() },
      update: { isPlatformAdmin: true },
    });
    console.log(`✓ platform admin ${email}`);
  }

  if (process.env.SEED_DEMO === "1") {
    if (process.env.NODE_ENV === "production") throw new Error("Refusing to create demo data with NODE_ENV=production");
    const demoEmail = "demo@businestra.local";
    let user = await db.user.findUnique({ where: { email: demoEmail } });
    if (!user) {
      user = await db.user.create({ data: { email: demoEmail, name: "Demo Owner", passwordHash: await hashPassword("demo-password-1"), emailVerifiedAt: new Date() } });
      await createDemoBusiness(user.id);
      console.log(`✓ demo login: ${demoEmail} / demo-password-1 (development only)`);
    } else console.log("• demo user already exists");
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
