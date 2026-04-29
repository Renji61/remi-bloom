import { pgTable, text, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { plants } from "./plants";

export const progressEntries = pgTable("progress_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plantId: text("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  plantName: text("plant_name").notNull(),
  date: timestamp("date", { mode: "string" }).notNull(),
  height: numeric("height").default("0"),
  heightUnit: text("height_unit", { enum: ["cm", "in"] }).default("cm"),
  leafCount: integer("leaf_count").default(0),
  notes: text("notes").default(""),
  photoUrl: text("photo_url").default(""),
  harvestYield: text("harvest_yield").default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
