import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const plantLocations = pgTable("plant_locations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  emoji: text("emoji").default(""),
  imageUrl: text("image_url").default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
