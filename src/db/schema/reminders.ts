import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const reminders = pgTable("reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  plantId: text("plant_id"),
  plantName: text("plant_name").notNull().default(""),
  type: text("type", {
    enum: ["water", "fertilize", "mist", "repot", "clean", "seed", "transplant", "other"],
  }).notNull(),
  date: timestamp("date", { mode: "string" }).notNull(),
  time: text("time").default(""),
  repeat: text("repeat", {
    enum: ["none", "daily", "weekly", "biweekly", "monthly", "custom"],
  })
    .notNull()
    .default("none"),
  repeatInterval: integer("repeat_interval").default(1),
  note: text("note").default(""),
  completed: boolean("completed").notNull().default(false),
  notificationSent: boolean("notification_sent").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
