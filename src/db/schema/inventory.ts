import { pgTable, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const inventoryItems = pgTable("inventory_items", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["supply", "seed", "tool", "other"],
  }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  unit: text("unit").default(""),
  price: numeric("price").default("0"),
  notes: text("notes").default(""),
  imageUrl: text("image_url").default(""),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});
