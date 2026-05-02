import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const actionItems = pgTable("action_items", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  source: text("source", { enum: ["system", "manual"] }).notNull(),
  type: text("type", {
    enum: [
      "water", "fertilize", "repot", "prune", "mist", "clean",
      "seed", "transplant", "harvesting", "planting", "maintenance", "general",
    ],
  }).notNull(),
  date: timestamp("date", { mode: "string" }).notNull(),
  time: text("time").default(""),
  completed: boolean("completed").notNull().default(false),
  notificationSent: boolean("notification_sent").notNull().default(false),
  plantIds: text("plant_ids").array().default([]),
  plantNames: text("plant_names").array().default([]),
  note: text("note").default(""),
  repeat: text("repeat", {
    enum: [
      "none", "daily", "weekly", "biweekly", "monthly",
      "everyXdays", "specificWeekday", "specificMonthday", "ordinalWeekday",
      "yearly", "dynamic",
    ],
  })
    .notNull()
    .default("none"),
  repeatConfig: jsonb("repeat_config").default({}),
  snoozedUntil: timestamp("snoozed_until", { mode: "string" }),
  category: text("category", {
    enum: [
      "water", "fertilize", "repot", "prune", "mist", "clean",
      "seed", "transplant", "harvesting", "planting", "maintenance", "general",
    ],
  }).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
