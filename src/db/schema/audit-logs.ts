import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  action: text("action").notNull(),
  details: text("details").default(""),
  timestamp: timestamp("timestamp", { mode: "string" })
    .notNull()
    .defaultNow(),
});
