"use client";

import { useMemo } from "react";
import { useAppStore } from "@/stores/app-store";

export interface GardenPermissions {
  role: "owner" | "caretaker" | "observer" | null;
  visiblePlantIds: Set<string>;
  canEdit: boolean;
  canManage: boolean;
  canAddPlants: boolean;
  canDeletePlants: boolean;
  canLogCare: boolean;
}

/**
 * Returns the highest role the current user has across all gardens
 * and the set of visible plant IDs.
 */
export function useGardenRole(): GardenPermissions {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const sharedGardens = useAppStore((s) => s.sharedGardens);

  return useMemo(() => {
    if (!currentUserId) {
      return {
        role: null,
        visiblePlantIds: new Set(),
        canEdit: true,
        canManage: true,
        canAddPlants: true,
        canDeletePlants: true,
        canLogCare: true,
      };
    }

    // Check if the user is an owner of any garden
    const ownedGarden = sharedGardens.find((g) => g.ownerId === currentUserId);
    if (ownedGarden) {
      return {
        role: "owner",
        visiblePlantIds: new Set(), // empty means "all plants" — no filtering needed
        canEdit: true,
        canManage: true,
        canAddPlants: true,
        canDeletePlants: true,
        canLogCare: true,
      };
    }

    // Find all gardens where the user is a member
    const memberGardens = sharedGardens.filter((g) =>
      g.members.some((m) => m.id === currentUserId)
    );

    if (memberGardens.length === 0) {
      return {
        role: null,
        visiblePlantIds: new Set(),
        canEdit: true,
        canManage: true,
        canAddPlants: true,
        canDeletePlants: true,
        canLogCare: true,
      };
    }

    // Determine the highest role across all gardens
    let highestRole: "observer" | "caretaker" = "observer";
    const visiblePlantIds = new Set<string>();

    for (const garden of memberGardens) {
      const member = garden.members.find((m) => m.id === currentUserId);
      if (!member) continue;

      if (member.role === "caretaker") {
        highestRole = "caretaker";
      }

      // Build visible plant IDs from this garden
      const sharedSet = new Set(garden.sharedPlantIds || []);
      switch (member.scope.type) {
        case "full":
          for (const pid of sharedSet) visiblePlantIds.add(pid);
          break;
        case "location": {
          const locationIds = new Set(member.scope.locationIds || []);
          // We can't filter by location here without knowing the plants,
          // so we add all sharedPlantIds and let useScopedPlants handle it
          for (const pid of sharedSet) visiblePlantIds.add(pid);
          break;
        }
        case "collection": {
          const scopePlantIds = new Set(member.scope.plantIds || []);
          for (const pid of sharedSet) {
            if (scopePlantIds.has(pid)) visiblePlantIds.add(pid);
          }
          break;
        }
      }
    }

    const isCaretaker = highestRole === "caretaker";

    return {
      role: highestRole,
      visiblePlantIds,
      // Members can always edit/log care for their own plants.
      // Observers can view shared plants but should not log care on shared plants;
      // however, they can still log entries for their own personal plants.
      canEdit: true,
      canManage: false, // only owner can manage garden settings
      canAddPlants: true, // members can still add their own plants
      canDeletePlants: true, // members can delete their own plants
      canLogCare: true, // all members can log care/entries for their own plants
    };
  }, [currentUserId, sharedGardens]);
}
