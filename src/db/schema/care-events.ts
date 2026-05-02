import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { plants } from "./plants";

export const careEvents = pgTable("care_events", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plantId: text("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  plantName: text("plant_name").notNull(),
  type: text("type", {
    enum: ["water", "fertilize", "repot", "prune", "other"],
  }).notNull(),
  date: timestamp("date", { mode: "string" }).notNull(),
  note: text("note").default(""),
  performedBy: text("performed_by").default(""),
});
