import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const plants = pgTable("plants", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scientificName: text("scientific_name").default(""),
  description: text("description").default(""),
  emoji: text("emoji").default(""),
  imageUrl: text("image_url").default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  plantedDate: timestamp("planted_date", { mode: "string" }),
  locationId: text("location_id"),
  tags: text("tags").array(),
  gardenX: integer("garden_x"),
  gardenY: integer("garden_y"),
  gardenPlaced: boolean("garden_placed").default(false),
});
