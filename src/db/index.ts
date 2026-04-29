import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

let client: postgres.Sql | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    client = postgres(connectionString, { max: 10, prepare: false });
    _db = drizzle(client, { schema });
  }
  return _db;
}

export async function runMigrations() {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const db = getDb();
  await migrate(db, { migrationsFolder: "src/db/migrations" });
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
