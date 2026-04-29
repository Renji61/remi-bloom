import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const todos = pgTable("todos", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").default(""),
  date: timestamp("date", { mode: "string" }).notNull(),
  time: text("time").default(""),
  reminderEnabled: boolean("reminder_enabled").default(false),
  completed: boolean("completed").notNull().default(false),
  category: text("category", {
    enum: ["general", "watering", "planting", "harvesting", "maintenance"],
  })
    .notNull()
    .default("general"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
