import { pgTable, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const gardenCells = pgTable(
  "garden_cells",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    plantId: text("plant_id"),
    plantName: text("plant_name"),
    plantEmoji: text("plant_emoji"),
    placedAt: timestamp("placed_at", { mode: "string" }),
  },
  (t) => ({
    uniqueCoord: unique().on(t.userId, t.x, t.y),
  })
);
