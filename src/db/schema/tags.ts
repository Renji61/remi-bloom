import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
