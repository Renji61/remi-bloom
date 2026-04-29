import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { pathToFileURL } from "node:url";

const migrationsDir = join(process.cwd(), "src", "db", "migrations");
const databaseUrl = process.env.DATABASE_URL;

function splitMigration(sqlText) {
  return sqlText
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function migrationChecksum(sqlText) {
  return createHash("sha256").update(sqlText).digest("hex");
}

async function runStartupMigrations() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before starting REMI Bloom.");
  }

  if (!existsSync(migrationsDir)) {
    console.warn("Migration directory not found; starting without migration check.");
    return;
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    console.warn("No SQL migration files found; starting without migration check.");
    return;
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "__remi_bloom_migrations" (
        "name" text PRIMARY KEY,
        "checksum" text NOT NULL,
        "applied_at" timestamp DEFAULT now() NOT NULL
      )
    `;

    const appliedRows = await sql`SELECT "name" FROM "__remi_bloom_migrations"`;
    const applied = new Set(appliedRows.map((row) => row.name));
    const userTable = await sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user'
      ) AS "exists"
    `;

    if (applied.size === 0 && userTable[0]?.exists) {
      console.log("Existing schema detected; marking bundled migrations as applied.");
      for (const file of migrationFiles) {
        const sqlText = readFileSync(join(migrationsDir, file), "utf8");
        await sql`
          INSERT INTO "__remi_bloom_migrations" ("name", "checksum")
          VALUES (${file}, ${migrationChecksum(sqlText)})
          ON CONFLICT ("name") DO NOTHING
        `;
      }
      return;
    }

    for (const file of migrationFiles) {
      if (applied.has(file)) {
        continue;
      }

      const sqlText = readFileSync(join(migrationsDir, file), "utf8");
      const statements = splitMigration(sqlText);

      console.log(`Applying database migration ${file}...`);
      await sql.begin(async (transaction) => {
        for (const statement of statements) {
          await transaction.unsafe(statement);
        }

        await transaction`
          INSERT INTO "__remi_bloom_migrations" ("name", "checksum")
          VALUES (${file}, ${migrationChecksum(sqlText)})
        `;
      });
    }

    console.log("Database migrations are up to date.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await runStartupMigrations();
await import(pathToFileURL(join(process.cwd(), "server.js")).href);
