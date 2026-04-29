import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const speciesCache = pgTable("species_cache", {
  scientificName: text("scientific_name").primaryKey(),
  speciesData: jsonb("species_data").notNull(),
  careGuideData: jsonb("care_guide_data"),
  cachedAt: timestamp("cached_at", { mode: "string" }).notNull().defaultNow(),
});
