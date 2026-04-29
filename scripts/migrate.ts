/**
 * Run Drizzle migrations at startup.
 * Called from package.json scripts.
 *
 * Usage: npx tsx scripts/migrate.ts
 */
import "dotenv/config";
import { runMigrations } from "../src/db";

runMigrations()
  .then(() => {
    console.log("Migrations complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
