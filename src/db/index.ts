import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: postgres.Sql | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getConnectionString(): string {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
      "Set it to your PostgreSQL connection string, e.g.: " +
      "postgres://remi_bloom:password@localhost:5432/remi_bloom"
    );
  }
  return cs;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    client = postgres(getConnectionString(), {
      max: 10,
      prepare: false,
      max_lifetime: 60 * 30, // 30 minutes
      idle_timeout: 30, // 30 seconds
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export async function runMigrations() {
  try {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const db = getDb();
    await migrate(db, { migrationsFolder: "src/db/migrations" });
  } catch (error) {
    console.error("Database migration failed:", error);
    throw error;
  }
}

// Lazily-initialized singleton for direct import
export const db = new Proxy<ReturnType<typeof drizzle<typeof schema>>>(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_target, prop) {
      return (getDb() as any)[prop];
    },
  }
);
