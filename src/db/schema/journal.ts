import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { plants } from "./plants";

export const journalEntries = pgTable("journal_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plantId: text("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  plantName: text("plant_name").notNull(),
  note: text("note").notNull(),
  date: timestamp("date", { mode: "string" }).notNull(),
  photoUrl: text("photo_url"),
});
