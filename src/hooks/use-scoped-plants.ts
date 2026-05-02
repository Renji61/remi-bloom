"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import type { Plant } from "@/lib/db";

/**
 * Returns the subset of plants the current user is allowed to see
 * based on their scope in each shared garden.
 *
 * - OWNER: always sees ALL their plants (unfiltered)
 * - Non-owner member: filtered by scope:
 *   - "full" scope → all plants in sharedPlantIds
 *   - "location" scope → plants whose locationId is in the scope's locationIds
 *   - "collection" scope → plants whose id is in the scope's plantIds
 *
 * Edge cases:
 * - A user may be a member of multiple gardens. Union all visible plants.
 * - A plant may be shared in multiple gardens with different scopes.
 */
export function useScopedPlants(plants: Plant[]): Plant[] {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const sharedGardens = useAppStore((s) => s.sharedGardens);

  return useMemo(() => {
    if (!currentUserId) return plants;

    // Check if the user is an owner of any garden
    const ownedGarden = sharedGardens.find((g) => g.ownerId === currentUserId);
    if (ownedGarden) {
      // Owner sees ALL their plants
      return plants;
    }

    // Find all gardens where the user is a non-owner member
    const memberGardens = sharedGardens.filter((g) =>
      g.members.some((m) => m.id === currentUserId && m.role !== "owner")
    );

    if (memberGardens.length === 0) return plants;

    // Build union of visible plant IDs
    const visiblePlantIds = new Set<string>();

    for (const garden of memberGardens) {
      const member = garden.members.find((m) => m.id === currentUserId);
      if (!member) continue;

      const ownerPlants = plants.filter((p) => p.userId === garden.ownerId);
      const sharedSet = new Set(garden.sharedPlantIds || []);

      switch (member.scope.type) {
        case "full": {
          // Full scope: show ALL the owner's plants.
          // If sharedPlantIds is also populated (whitelist), intersect with it;
          // otherwise (empty = no whitelist) show all owner plants.
          if (sharedSet.size > 0) {
            for (const pid of sharedSet) {
              visiblePlantIds.add(pid);
            }
          } else {
            for (const plant of ownerPlants) {
              visiblePlantIds.add(plant.id);
            }
          }
          break;
        }
        case "location": {
          // Plants whose locationId is in the scope's locationIds.
          // If sharedPlantIds is populated, intersect with it; otherwise show
          // all owner plants matching by location.
          const locationIds = new Set(member.scope.locationIds || []);
          for (const plant of ownerPlants) {
            if (plant.locationId && locationIds.has(plant.locationId)) {
              if (sharedSet.size === 0 || sharedSet.has(plant.id)) {
                visiblePlantIds.add(plant.id);
              }
            }
          }
          break;
        }
        case "collection": {
          // Plants whose id is in the scope's plantIds.
          // If sharedPlantIds is populated, intersect with it.
          const scopePlantIds = new Set(member.scope.plantIds || []);
          for (const plant of ownerPlants) {
            if (scopePlantIds.has(plant.id)) {
              if (sharedSet.size === 0 || sharedSet.has(plant.id)) {
                visiblePlantIds.add(plant.id);
              }
            }
          }
          break;
        }
      }
    }

    if (visiblePlantIds.size === 0) return [];

    return plants.filter((p) => visiblePlantIds.has(p.id));
  }, [plants, currentUserId, sharedGardens]);
}
