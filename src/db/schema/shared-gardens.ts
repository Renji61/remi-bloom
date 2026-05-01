import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const sharedGardens = pgTable("shared_gardens", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gardenName: text("garden_name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  members: jsonb("members").notNull().default([]),
  sharedPlantIds: text("shared_plant_ids").array().notNull().default([]),
  pendingInvites: jsonb("pending_invites").notNull().default([]),
});
