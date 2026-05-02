"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Share2,
  Plus,
  Copy,
  Check,
  UserPlus,
  UserMinus,
  Shield,
  LogIn,
  Sprout,
  Download,
  Upload,
  RefreshCw,
  X,
  ArrowLeft,
  DoorOpen,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import {
  addSharedGarden,
  updateSharedGarden,
  deleteSharedGarden,
  getSharedGardenByCode,
  getPlantsForUser,
  getLocationsForUser,
  getInventoryForUser,
  getRemindersForUser,
  getJournalEntriesForUser,
  getGardenCellsForUser,
  addPlant,
  addLocation,
  addInventoryItem,
  addJournalEntry,
  saveGardenCells,
} from "@/lib/db";
import { generateId, sanitizeString, sanitizeArray } from "@/lib/utils";
import type {
  SharedGarden,
  SharedMember,
  PendingInvite,
  GardenScopeConfig,
  GardenScope,
  Plant,
  PlantLocation,
  InventoryItem,
  JournalEntry,
  GardenCell,
} from "@/lib/db";

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function roleBadgeClass(role: SharedMember["role"]): string {
  switch (role) {
    case "owner":
      return "bg-amber-500/15 text-amber-400";
    case "caretaker":
      return "bg-[var(--theme-primary)]/15 text-[var(--theme-primary)]";
    case "observer":
      return "bg-surface-container-high text-on-surface-variant";
  }
}

function migrateMember(member: any): SharedMember {
  const base = {
    scope: member.scope ?? { type: "full" as GardenScope, locationIds: [], plantIds: [] },
    invitedBy: member.invitedBy ?? "",
  };
  if (member.role === "editor") {
    return { ...member, role: "caretaker" as const, ...base };
  }
  if (member.role === "viewer") {
    return { ...member, role: "observer" as const, ...base };
  }
  return { ...member, ...base };
}

const DEFAULT_SCOPE: GardenScopeConfig = { type: "full", locationIds: [], plantIds: [] };

export default function SharePage() {
  usePageTitle("Shared Garden");
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentUser = useAppStore((s) => s.currentUser);
  const sharedGardens = useAppStore((s) => s.sharedGardens);
  const setSharedGardens = useAppStore((s) => s.setSharedGardens);
  const addGardenToStore = useAppStore((s) => s.addSharedGarden);
  const removeGardenFromStore = useAppStore((s) => s.removeSharedGarden);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [gardenName, setGardenName] = useState("");

  const [managingGarden, setManagingGarden] = useState<SharedGarden | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<"caretaker" | "observer">("caretaker");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [joinStatus, setJoinStatus] = useState<{
    type: "idle" | "loading" | "found" | "error" | "joined";
    garden?: any;
    message?: string;
    role?: string;
    scope?: GardenScopeConfig;
    memberCount?: number;
    sharedCount?: number;
  }>({ type: "idle" });

  const [memberScope, setMemberScope] = useState<GardenScope>("full");
  const [memberScopeLocationIds, setMemberScopeLocationIds] = useState<string[]>([]);
  const [memberScopePlantIds, setMemberScopePlantIds] = useState<string[]>([]);

  const [createScope, setCreateScope] = useState<GardenScope>("full");
  const [createScopeLocationIds, setCreateScopeLocationIds] = useState<string[]>([]);
  const [createScopePlantIds, setCreateScopePlantIds] = useState<string[]>([]);

  const [transferTargetId, setTransferTargetId] = useState<string>("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string>("");

  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importGardenId, setImportGardenId] = useState<string | null>(null);

  // --- Derived gardens list ---
  const myGardens = useMemo(() => {
    return sharedGardens.filter((g) => {
      if (g.ownerId === currentUserId) return true;
      if (g.members?.some((m) => m.id === currentUserId)) return true;
      return false;
    });
  }, [sharedGardens, currentUserId]);

  // --- Migrate old member roles on read ---
  useEffect(() => {
    let changed = false;
    const updated = sharedGardens.map((g) => {
      const migratedMembers = g.members.map(migrateMember);
      const needsUpdate = migratedMembers.some((m, i) => m !== g.members[i]);
      if (needsUpdate) {
        changed = true;
        return { ...g, members: migratedMembers };
      }
      return g;
    });
    if (changed) {
      setSharedGardens(updated);
    }
  }, []);

  // --- Load locations/plants for scope selectors ---
  const [allLocations, setAllLocations] = useState<PlantLocation[]>([]);
  const [allPlants, setAllPlants] = useState<Plant[]>([]);

  useEffect(() => {
    if (currentUserId) {
      getLocationsForUser(currentUserId).then(setAllLocations);
      getPlantsForUser(currentUserId).then(setAllPlants);
    }
  }, [currentUserId]);

  // --- Create Garden ---
  const [creating, setCreating] = useState(false);
  const handleCreateGarden = useCallback(async () => {
    if (!gardenName.trim() || !currentUserId || !currentUser) return;

    setCreating(true);

    const code = generateInviteCode();
    const now = new Date().toISOString();

    const newGarden: SharedGarden = {
      id: generateId(),
      ownerId: currentUserId,
      gardenName: gardenName.trim(),
      code,
      createdAt: now,
      members: [
        {
          id: currentUserId,
          name: currentUser.displayName,
          role: "owner",
          scope: { type: "full", locationIds: [], plantIds: [] },
          addedAt: now,
          invitedBy: currentUserId,
        },
      ],
      sharedPlantIds: [],
      pendingInvites: [
        {
          code,
          role: "caretaker",
          scope: { type: createScope, locationIds: createScopeLocationIds, plantIds: createScopePlantIds },
          createdAt: now,
        },
      ],
    };

    // Write-through to the server so other users can look up the invite code immediately.
    // This MUST succeed before we show the garden to the user.
    let serverOk = false;
    try {
      const serverResponse = await fetch("/api/shared-gardens", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGarden),
      });
      if (serverResponse.ok) {
        serverOk = true;
      } else {
        const errBody = await serverResponse.json().catch(() => ({}));
        setCreateError(errBody.error || "Failed to reach the server. Garden will sync when online.");
        console.error("Server rejected garden creation:", serverResponse.status, errBody);
      }
    } catch (err) {
      setCreateError("Could not reach the server. Garden will sync when online.");
      console.error("Network error during garden creation:", err);
    }

    // Save locally regardless — the garden is always available offline.
    // If the server POST succeeded it's already on the server; otherwise the
    // sync queue will propagate it when connectivity returns.
    await addSharedGarden(newGarden);
    addGardenToStore(newGarden);
    setGardenName("");
    setShowCreateDialog(false);
    setCreateScope("full");
    setCreateScopeLocationIds([]);
    setCreateScopePlantIds([]);
    setCreating(false);
  }, [gardenName, currentUserId, currentUser, addGardenToStore, createScope, createScopeLocationIds, createScopePlantIds]);

  // --- Delete Garden ---
  const handleDeleteGarden = useCallback(
    async (id: string) => {
      await deleteSharedGarden(id);
      removeGardenFromStore(id);
      setConfirmDelete(null);
    },
    [removeGardenFromStore]
  );

  // --- Add Member ---
  const handleAddMember = useCallback(async () => {
    if (!managingGarden || !memberName.trim() || !currentUserId) return;

    const newMember: SharedMember = {
      id: generateId(),
      name: memberName.trim(),
      role: memberRole,
      scope: {
        type: memberScope,
        locationIds: memberScope === "location" ? memberScopeLocationIds : [],
        plantIds: memberScope === "collection" ? memberScopePlantIds : [],
      },
      addedAt: new Date().toISOString(),
      invitedBy: currentUserId,
    };

    const updated: SharedGarden = {
      ...managingGarden,
      members: [...managingGarden.members.map(migrateMember), newMember],
    };

    await updateSharedGarden(updated);

    setSharedGardens(
      sharedGardens.map((g) => (g.id === updated.id ? updated : g))
    );
    setManagingGarden(updated);
    setMemberName("");
    setMemberRole("caretaker");
    setMemberScope("full");
    setMemberScopeLocationIds([]);
    setMemberScopePlantIds([]);
    setShowAddMember(false);
  }, [managingGarden, memberName, memberRole, memberScope, memberScopeLocationIds, memberScopePlantIds, currentUserId, setSharedGardens, sharedGardens]);

  // --- Remove Member ---
  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (!managingGarden) return;

      const updated: SharedGarden = {
        ...managingGarden,
        members: managingGarden.members.map(migrateMember).filter((m) => m.id !== memberId),
      };

      await updateSharedGarden(updated);

      setSharedGardens(
        sharedGardens.map((g) => (g.id === updated.id ? updated : g))
      );
      setManagingGarden(updated);
    },
    [managingGarden, setSharedGardens, sharedGardens]
  );

  // --- Join Garden (Bug 1 fix: API first, fallback to IndexedDB) ---
  const handleLookupCode = useCallback(async () => {
    if (!inviteCode.trim()) return;

    const code = inviteCode.trim().toUpperCase();
    setJoinStatus({ type: "loading" });

    try {
      const response = await fetch(`/api/shared-gardens/lookup?code=${encodeURIComponent(code)}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isCurrentUserMember) {
          setJoinStatus({ type: "error", message: "You are already a member of this garden." });
          return;
        }
        setJoinStatus({
          type: "found",
          garden: data,
          role: data.pendingInvites?.[0]?.role ?? "caretaker",
          scope: data.pendingInvites?.[0]?.scope ?? DEFAULT_SCOPE,
          memberCount: data.memberCount ?? 0,
          sharedCount: data.sharedPlantIds?.length ?? 0,
        });
        return;
      }

      // API lookup failed — show a clear message
      const errBody = await response.json().catch(() => ({}));
      const status = response.status;
      let message: string;
      if (status === 404) {
        message = "No garden found with that invite code on the server. The garden may not have been created yet, or the code is incorrect.";
      } else if (status === 400) {
        message = errBody.error || "Invalid invite code format.";
      } else {
        message = errBody.error || `Server error (${status}). Please try again later.`;
      }
      setJoinStatus({
        type: "error",
        message,
      });
    } catch {
      // Network error during API lookup — the code is correct but we're offline
      // Try local IndexedDB (only works for same-device gardens)
      try {
        const garden = await getSharedGardenByCode(code);
        if (garden) {
          const migratedMembers = garden.members.map(migrateMember);
          const isMember = migratedMembers.some((m) => m.id === currentUserId);
          if (isMember) {
            setJoinStatus({ type: "error", message: "You are already a member of this garden." });
            return;
          }
          setJoinStatus({
            type: "found",
            garden,
            role: garden.pendingInvites?.[0]?.role ?? "caretaker",
            scope: garden.pendingInvites?.[0]?.scope ?? DEFAULT_SCOPE,
            memberCount: garden.members?.length ?? 0,
            sharedCount: garden.sharedPlantIds?.length ?? 0,
          });
        } else {
          setJoinStatus({
            type: "error",
            message: "No garden found with that invite code. The garden may not yet be synced to the server, or the code is incorrect.",
          });
        }
      } catch (err: any) {
        setJoinStatus({
          type: "error",
          message: err.error || err.message || "An error occurred while looking up the code.",
        });
      }
    }
  }, [inviteCode, currentUserId]);

  // --- Join Garden (Bug 2 fix: POST /api/shared-gardens/join) ---
  const handleJoinGarden = useCallback(async () => {
    if (!inviteCode.trim()) return;

    const code = inviteCode.trim().toUpperCase();
    setJoinStatus({ type: "loading" });

    try {
      const response = await fetch("/api/shared-gardens/join", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.garden) {
          addGardenToStore(data.garden);
          setJoinStatus({
            type: "joined",
            garden: data.garden,
            memberCount: data.garden.members?.length ?? 0,
            sharedCount: data.garden.sharedPlantIds?.length ?? 0,
          });
        } else {
          setJoinStatus({ type: "error", message: "Failed to join garden. The invite code may be invalid." });
        }
      } else {
        const err = await response.json().catch(() => ({}));
        setJoinStatus({
          type: "error",
          message: err.error || err.message || "Failed to join garden. The invite code may be invalid.",
        });
      }
    } catch {
      // Network error during join — try local IndexedDB (only works for same-device gardens)
      try {
        const garden = await getSharedGardenByCode(code);
        if (garden && currentUserId && currentUser) {
          const migratedMembers = garden.members.map(migrateMember);
          const isMember = migratedMembers.some((m) => m.id === currentUserId);
          if (isMember) {
            setJoinStatus({ type: "error", message: "You are already a member of this garden." });
            return;
          }

          const pendingInvites = garden.pendingInvites ?? [];
          const matchingInvite = pendingInvites.find((inv) => inv.code === code);
          if (!matchingInvite) {
            setJoinStatus({ type: "error", message: "This invite code is no longer valid." });
            return;
          }

          const newMember: SharedMember = {
            id: currentUserId,
            name: currentUser.displayName,
            role: matchingInvite.role,
            scope: matchingInvite.scope,
            addedAt: new Date().toISOString(),
            invitedBy: garden.ownerId,
          };

          const updated: SharedGarden = {
            ...garden,
            members: [...migratedMembers, newMember],
            pendingInvites: garden.pendingInvites?.filter((inv) => inv.code !== code) ?? [],
          };

          await updateSharedGarden(updated);
          addGardenToStore(updated);
          setJoinStatus({
            type: "joined",
            garden: updated,
            memberCount: updated.members.length,
            sharedCount: updated.sharedPlantIds.length,
          });
        } else {
          setJoinStatus({ type: "error", message: "No garden found with that invite code." });
        }
      } catch {
        setJoinStatus({ type: "error", message: "An error occurred while joining the garden." });
      }
    }
  }, [inviteCode, currentUserId, currentUser, addGardenToStore]);

  // --- Leave Garden ---
  const handleLeaveGarden = useCallback(async (gardenId: string) => {
    if (!currentUserId) return;

    try {
      await fetch("/api/shared-gardens/leave", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gardenId }),
      });
    } catch {
      // Offline: just remove from local store
    }

    removeGardenFromStore(gardenId);
    if (managingGarden?.id === gardenId) {
      setManagingGarden(null);
    }
    setJoinStatus({ type: "idle" });
  }, [currentUserId, removeGardenFromStore, managingGarden]);

  // --- Transfer Ownership ---
  const handleTransferOwnership = useCallback(async () => {
    if (!managingGarden || !transferTargetId) return;

    try {
      await fetch("/api/shared-gardens/transfer-ownership", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gardenId: managingGarden.id, newOwnerId: transferTargetId }),
      });
    } catch {
      // Offline fallback: update local
    }

    const updated: SharedGarden = {
      ...managingGarden,
      ownerId: transferTargetId,
      members: managingGarden.members.map(migrateMember).map((m) =>
        m.id === transferTargetId
          ? { ...m, role: "owner" as const }
          : m.id === managingGarden.ownerId
            ? { ...m, role: "caretaker" as const }
            : m
      ),
    };

    await updateSharedGarden(updated);
    setSharedGardens(sharedGardens.map((g) => (g.id === updated.id ? updated : g)));
    setManagingGarden(updated);
    setShowTransferConfirm(false);
    setTransferTargetId("");
  }, [managingGarden, transferTargetId, setSharedGardens, sharedGardens]);

  // --- Generate Invite Code ---
  const handleGenerateInviteCode = useCallback(async () => {
    if (!managingGarden) return;

    const newCode = generateInviteCode();
    const now = new Date().toISOString();

    const newInvite: PendingInvite = {
      code: newCode,
      role: memberRole,
      scope: { type: memberScope, locationIds: memberScopeLocationIds, plantIds: memberScopePlantIds },
      createdAt: now,
    };

    const updated: SharedGarden = {
      ...managingGarden,
      code: newCode,
      pendingInvites: [...(managingGarden.pendingInvites ?? []), newInvite],
    };

    await updateSharedGarden(updated);
    setSharedGardens(sharedGardens.map((g) => (g.id === updated.id ? updated : g)));
    setManagingGarden(updated);
    setPendingInviteCode(newCode);
  }, [managingGarden, memberRole, memberScope, memberScopeLocationIds, memberScopePlantIds, setSharedGardens, sharedGardens]);

  // --- Export my data to garden ---
  const handleExportToGarden = useCallback(async (gardenId: string) => {
    if (!currentUserId) return;
    setExportStatus(gardenId);

    try {
      const garden = sharedGardens.find((g) => g.id === gardenId);
      if (!garden) throw new Error("Garden not found");

      const [plants, locations, inventory, journals, gardenCells] = await Promise.all([
        getPlantsForUser(currentUserId),
        getLocationsForUser(currentUserId),
        getInventoryForUser(currentUserId),
        getJournalEntriesForUser(currentUserId),
        getGardenCellsForUser(currentUserId),
      ]);

      const exportData = {
        exportedBy: currentUserId,
        exportedAt: new Date().toISOString(),
        plants,
        locations,
        inventory,
        journals,
        gardenCells,
      };

      localStorage.setItem(`garden-export-${gardenId}`, JSON.stringify(exportData));

      setExportStatus(null);
      setImportStatus("Data exported to garden! Other members can now import it.");
      setTimeout(() => setImportStatus(null), 3000);
    } catch {
      setExportStatus(null);
      setImportStatus("Failed to export data.");
      setTimeout(() => setImportStatus(null), 3000);
    }
  }, [currentUserId, sharedGardens]);

  // --- Import garden data ---
  const handleImportFromGarden = useCallback(async (gardenId: string) => {
    if (!currentUserId) return;
    setImportGardenId(gardenId);

    try {
      const raw = localStorage.getItem(`garden-export-${gardenId}`);
      if (!raw) throw new Error("No exported data found for this garden");

      const data = JSON.parse(raw);
      if (!data.plants) throw new Error("Invalid export data");

      const reUserId = (item: any, field = "userId") => ({ ...item, [field]: currentUserId, id: generateId() });
      const sanitizeFields = (item: any, fields: string[]) => {
        const sanitized = { ...item };
        for (const f of fields) {
          if (typeof sanitized[f] === "string") sanitized[f] = sanitizeString(sanitized[f]);
          if (Array.isArray(sanitized[f])) sanitized[f] = sanitizeArray(sanitized[f]);
        }
        return sanitized;
      };

      if (data.plants?.length) {
        await Promise.all(data.plants.map((p: any) => {
          const safe = sanitizeFields(reUserId(p), ["name", "scientificName", "description", "imageUrl"]);
          return addPlant(safe);
        }));
      }
      if (data.locations?.length) {
        await Promise.all(data.locations.map((l: any) => {
          const safe = sanitizeFields(reUserId(l), ["name", "description", "imageUrl"]);
          return addLocation(safe);
        }));
      }
      if (data.inventory?.length) {
        await Promise.all(data.inventory.map((i: any) => {
          const safe = sanitizeFields(reUserId(i), ["name", "notes", "imageUrl", "unit"]);
          return addInventoryItem(safe);
        }));
      }
      if (data.journals?.length) {
        await Promise.all(data.journals.map((j: any) => {
          const safe = sanitizeFields(reUserId(j), ["note", "plantName", "photoUrl"]);
          return addJournalEntry(safe);
        }));
      }
      if (data.gardenCells?.length) {
        const safeCells = data.gardenCells.map((c: any) => {
          const reassigned = reUserId(c);
          if (typeof reassigned.plantName === "string") reassigned.plantName = sanitizeString(reassigned.plantName);
          if (typeof reassigned.plantEmoji === "string") reassigned.plantEmoji = sanitizeString(reassigned.plantEmoji);
          return reassigned;
        });
        await saveGardenCells(safeCells);
      }

      setImportGardenId(null);
      setImportStatus("Garden data imported successfully!");
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportGardenId(null);
      setImportStatus(err instanceof Error ? err.message : "Failed to import garden data.");
      setTimeout(() => setImportStatus(null), 3000);
    }
  }, [currentUserId]);

  const [copiedGardenId, setCopiedGardenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-on-surface">Shared Garden</h1>
          <p className="text-xs text-on-surface-variant/70">
            Collaborate and share your garden with others
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-high">
          <Share2 size={18} className="text-on-surface-variant" />
        </div>
      </div>

      <Tabs defaultValue="my-gardens">
        <TabsList className="w-full">
          <TabsTrigger value="my-gardens" className="flex-1">
            <Users size={14} className="mr-1.5" />
            My Gardens
          </TabsTrigger>
          <TabsTrigger value="join" className="flex-1">
            <LogIn size={14} className="mr-1.5" />
            Join Garden
          </TabsTrigger>
        </TabsList>

        {/* Status message */}
        {importStatus && (
          <div className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            {importStatus}
          </div>
        )}

        {/* ---- My Gardens Tab ---- */}
        <TabsContent value="my-gardens">
          {myGardens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users size={40} className="mb-3 text-on-surface-variant/30" />
              <p className="text-sm font-medium text-on-surface-variant">
                No shared gardens yet
              </p>
              <p className="mt-1 text-xs text-on-surface-variant/50">
                Create a garden to share your plant data with other users
              </p>
              <Button
                className="mt-4"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus size={14} />
                Create Garden
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-on-surface-variant/70">
                  {myGardens.length} garden{myGardens.length !== 1 ? "s" : ""}
                </p>
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus size={14} />
                  Create Garden
                </Button>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {myGardens.map((garden, i) => {
                    const isOwner = garden.ownerId === currentUserId;
                    const currentMember = garden.members?.map(migrateMember).find((m) => m.id === currentUserId);
                    return (
                      <motion.div
                        key={garden.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: i * 0.04 }}
                        layout
                      >
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Sprout size={16} className="shrink-0 text-[var(--theme-primary)]" />
                                  <h3 className="text-sm font-semibold text-on-surface">
                                    {garden.gardenName}
                                  </h3>
                                  {!isOwner && currentMember && (
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${roleBadgeClass(currentMember.role)}`}>
                                      {currentMember.role}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-[10px] font-mono tracking-wider text-on-surface-variant">
                                    {garden.code}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant/60">
                                    {garden.members?.length ?? 0} member{(garden.members?.length ?? 0) !== 1 ? "s" : ""}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant/40">
                                    {(garden.sharedPlantIds?.length ?? 0)} plants shared
                                  </span>
                                </div>
                                <p className="mt-1 text-[10px] text-on-surface-variant/40">
                                  Created {formatDate(garden.createdAt)}
                                </p>

                                {/* Export/Import buttons */}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleExportToGarden(garden.id)}
                                    disabled={exportStatus === garden.id}
                                    className="text-[10px] px-2 py-1 h-auto"
                                  >
                                    {exportStatus === garden.id ? (
                                      <RefreshCw size={10} className="animate-spin" />
                                    ) : (
                                      <Upload size={10} />
                                    )}
                                    Export
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleImportFromGarden(garden.id)}
                                    disabled={importGardenId === garden.id}
                                    className="text-[10px] px-2 py-1 h-auto"
                                  >
                                    {importGardenId === garden.id ? (
                                      <RefreshCw size={10} className="animate-spin" />
                                    ) : (
                                      <Download size={10} />
                                    )}
                                    Import
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setManagingGarden(garden);
                                    setShowAddMember(false);
                                    setPendingInviteCode("");
                                  }}
                                >
                                  <Users size={14} />
                                  Manage
                                </Button>
                                {isOwner ? (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => setConfirmDelete(garden.id)}
                                  >
                                    <X size={14} />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => {
                                      setManagingGarden(garden);
                                      setPendingInviteCode("");
                                    }}
                                  >
                                    <DoorOpen size={14} />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---- Join Garden Tab ---- */}
        <TabsContent value="join">
          {joinStatus.type === "joined" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
                <Check size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-on-surface">Join Successful!</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                You have joined {joinStatus.garden?.gardenName ?? "the garden"}
              </p>
              <div className="mt-4 flex gap-4">
                <div className="rounded-2xl bg-surface-container-high px-4 py-2 text-center">
                  <p className="text-xl font-bold text-on-surface">{joinStatus.memberCount ?? 0}</p>
                  <p className="text-[10px] text-on-surface-variant/60">Members</p>
                </div>
                <div className="rounded-2xl bg-surface-container-high px-4 py-2 text-center">
                  <p className="text-xl font-bold text-on-surface">{joinStatus.sharedCount ?? 0}</p>
                  <p className="text-[10px] text-on-surface-variant/60">Plants Shared</p>
                </div>
              </div>
              <Button
                className="mt-6"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setInviteCode("");
                  setJoinStatus({ type: "idle" });
                }}
              >
                <ArrowLeft size={14} />
                Back
              </Button>
            </motion.div>
          ) : (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--theme-primary)]/10">
                    <LogIn size={18} className="text-[var(--theme-primary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-on-surface">Join a Shared Garden</h3>
                    <p className="mt-0.5 text-xs text-on-surface-variant/70">
                      Enter the 8-character invite code shared by the garden owner.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter invite code (e.g. ABC12345)"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        setJoinStatus({ type: "idle" });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleLookupCode();
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleLookupCode}
                    disabled={joinStatus.type === "loading" || !inviteCode.trim()}
                  >
                    {joinStatus.type === "loading" ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      "Look Up"
                    )}
                  </Button>
                </div>

                {joinStatus.type === "found" && joinStatus.garden && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-2xl bg-[var(--theme-primary)]/10 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Sprout size={16} className="text-[var(--theme-primary)]" />
                      <h4 className="text-sm font-semibold text-on-surface">
                        {joinStatus.garden.gardenName}
                      </h4>
                    </div>
                    <p className="text-xs text-on-surface-variant/70">
                      {joinStatus.memberCount} member{joinStatus.memberCount !== 1 ? "s" : ""} · Created{" "}
                      {formatDate(joinStatus.garden.createdAt)}
                    </p>

                    {joinStatus.role && joinStatus.scope ? (
                      <div className="rounded-xl bg-surface-container/40 p-3 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                          Your role &amp; scope
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass(joinStatus.role as SharedMember["role"])}`}>
                            {joinStatus.role}
                          </span>
                          <span className="text-[10px] text-on-surface-variant/60">
                            {joinStatus.scope.type === "full"
                              ? "Full Access"
                              : joinStatus.scope.type === "location"
                                ? `Scoped to ${joinStatus.scope.locationIds?.length ?? 0} location(s)`
                                : `Scoped to ${joinStatus.scope.plantIds?.length ?? 0} plant(s)`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-on-surface-variant/60">
                        This invite code is no longer valid.
                      </p>
                    )}

                    {joinStatus.role && (
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={handleJoinGarden}
                        disabled={(joinStatus as any).type === "loading"}
                      >
                        {(joinStatus as any).type === "loading" ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <LogIn size={14} />
                        )}
                        Join Garden
                      </Button>
                    )}
                  </motion.div>
                )}

                {joinStatus.type === "error" && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 text-xs text-red-400"
                  >
                    {joinStatus.message}
                  </motion.p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ---- Create Garden Dialog ---- */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setCreateError(null);
            setGardenName("");
            setCreateScope("full");
            setCreateScopeLocationIds([]);
            setCreateScopePlantIds([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Shared Garden</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              label="Garden Name"
              value={gardenName}
              onChange={(e) => setGardenName(e.target.value)}
              placeholder="e.g. Community Greenhouse, Family Garden..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateGarden();
              }}
            />

            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Default Invite Scope
              </label>
              <div className="flex gap-2">
                {(["full", "location", "collection"] as GardenScope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setCreateScope(s);
                      setCreateScopeLocationIds([]);
                      setCreateScopePlantIds([]);
                    }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold transition-all ${
                      createScope === s
                        ? "bg-[var(--theme-primary)]/20 ring-1 ring-[var(--theme-primary)] text-[var(--theme-primary)]"
                        : "bg-surface-container-high text-on-surface-variant/60 hover:bg-surface-container-higher"
                    }`}
                  >
                    {s === "full" && <Shield size={12} />}
                    {s === "location" && <Sprout size={12} />}
                    {s === "collection" && <Sprout size={12} />}
                    {s === "full" ? "Full Access" : s === "location" ? "Location" : "Collection"}
                  </button>
                ))}
              </div>

              {createScope === "location" && (
                <div className="max-h-32 overflow-y-auto space-y-1.5 rounded-2xl bg-surface-container/30 p-3">
                  {allLocations.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/50">No locations found.</p>
                  ) : (
                    allLocations.map((loc) => (
                      <label key={loc.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createScopeLocationIds.includes(loc.id)}
                          onChange={() => {
                            setCreateScopeLocationIds((prev) =>
                              prev.includes(loc.id)
                                ? prev.filter((id) => id !== loc.id)
                                : [...prev, loc.id]
                            );
                          }}
                          className="rounded border-outline/30 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                        />
                        <span className="text-xs text-on-surface">{loc.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}

              {createScope === "collection" && (
                <div className="max-h-32 overflow-y-auto space-y-1.5 rounded-2xl bg-surface-container/30 p-3">
                  {allPlants.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/50">No plants found.</p>
                  ) : (
                    allPlants.map((plant) => (
                      <label key={plant.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createScopePlantIds.includes(plant.id)}
                          onChange={() => {
                            setCreateScopePlantIds((prev) =>
                              prev.includes(plant.id)
                                ? prev.filter((id) => id !== plant.id)
                                : [...prev, plant.id]
                            );
                          }}
                          className="rounded border-outline/30 text-[var(--theme-primary)] focus:ring-[var(--theme-primary)]"
                        />
                        <span className="text-xs text-on-surface">{plant.emoji} {plant.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            {createError && (
              <div className="rounded-xl bg-error/10 border border-error/20 p-3 text-xs text-error">
                {createError}
              </div>
            )}

            <p className="text-[10px] text-on-surface-variant/50">
              An 8-character invite code will be generated automatically.
              Other users can join with this code to access your garden data.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateDialog(false);
                  setGardenName("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateGarden} disabled={!gardenName.trim() || creating}>
                {creating ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {creating ? "Creating..." : "Create Garden"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Manage Garden Dialog ---- */}
      <Dialog
        open={!!managingGarden}
        onOpenChange={(open) => {
          if (!open) {
            setManagingGarden(null);
            setShowAddMember(false);
            setPendingInviteCode("");
            setShowTransferConfirm(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Sprout size={18} className="inline mr-1.5 text-[var(--theme-primary)]" />
              {managingGarden?.gardenName}
            </DialogTitle>
          </DialogHeader>

          {managingGarden && (() => {
            const isOwner = managingGarden.ownerId === currentUserId;
            const migratedMembers = managingGarden.members.map(migrateMember);
            const currentMember = migratedMembers.find((m) => m.id === currentUserId);

            return (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Garden Code */}
                <div className="rounded-2xl bg-surface-container/30 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                    Garden Code
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 rounded-xl bg-surface-container-high px-3 py-1.5 text-sm font-mono tracking-widest text-[var(--theme-primary)] text-center">
                      {managingGarden.code}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(managingGarden.code);
                        setCopiedGardenId(managingGarden.id);
                        setTimeout(() => setCopiedGardenId(null), 2000);
                      }}
                      className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
                    >
                      {copiedGardenId === managingGarden.id ? (
                        <Check size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Member List */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                    Members ({migratedMembers.length})
                  </p>
                  {migratedMembers.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/50">No members yet.</p>
                  ) : (
                    migratedMembers.map((member, i) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between rounded-2xl bg-surface-container/40 px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-container-high text-xs font-bold text-on-surface-variant">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-on-surface">{member.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {member.role === "owner" && (
                                <Shield size={10} className="text-amber-400" />
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${roleBadgeClass(member.role)}`}
                              >
                                {member.role}
                              </span>
                              {member.scope && member.scope.type !== "full" && (
                                <span className="text-[9px] text-on-surface-variant/50">
                                  {member.scope.type === "location"
                                    ? `${member.scope.locationIds?.length ?? 0} location(s)`
                                    : `${member.scope.plantIds?.length ?? 0} plant(s)`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isOwner && member.role !== "owner" && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="rounded-lg p-1.5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          >
                            <UserMinus size={14} />
                          </button>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>

                {isOwner ? (
                  <>
                    {/* Add Member */}
                    {showAddMember ? (
                      <div className="rounded-2xl bg-surface-container/30 p-4 space-y-3">
                        <Input
                          label="Member Name"
                          value={memberName}
                          onChange={(e) => setMemberName(e.target.value)}
                          placeholder="e.g. Alex, Jamie..."
                        />
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                            Role
                          </label>
                          <div className="flex gap-2">
                            {(["caretaker", "observer"] as const).map((role) => (
                              <button
                                key={role}
                                onClick={() => setMemberRole(role)}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold transition-all ${
                                  memberRole === role
                                    ? "bg-[var(--theme-primary)]/20 ring-1 ring-[var(--theme-primary)] text-[var(--theme-primary)]"
                                    : "bg-surface-container-high text-on-surface-variant/60 hover:bg-surface-container-higher"
                                }`}
                              >
                                <Shield size={12} />
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Scope selector for new member */}
                        <div className="space-y-3">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                            Access Scope
                          </label>
                          <div className="flex gap-2">
                            {(["full", "location", "collection"] as GardenScope[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => {
                                  setMemberScope(s);
                                  setMemberScopeLocationIds([]);
                                  setMemberScopePlantIds([]);
                                }}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold transition-all ${
                                  memberScope === s
                                    ? "bg-[var(--theme-primary)]/20 ring-1 ring-[var(--theme-primary)] text-[var(--theme-primary)]"
                                    : "bg-surface-container-high text-on-surface-variant/60 hover:bg-surface-container-higher"
                                }`}
                              >
                                <Shield size={12} />
                                {s === "full" ? "Full" : s === "location" ? "Location" : "Collection"}
                              </button>
                            ))}
                          </div>

                          {memberScope === "location" && (
                            <div className="max-h-28 overflow-y-auto space-y-1.5 rounded-2xl bg-surface-container/20 p-2">
                              {allLocations.length === 0 ? (
                                <p className="text-xs text-on-surface-variant/50">No locations.</p>
                              ) : (
                                allLocations.map((loc) => (
                                  <label key={loc.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                                    <input
                                      type="checkbox"
                                      checked={memberScopeLocationIds.includes(loc.id)}
                                      onChange={() => {
                                        setMemberScopeLocationIds((prev) =>
                                          prev.includes(loc.id)
                                            ? prev.filter((id) => id !== loc.id)
                                            : [...prev, loc.id]
                                        );
                                      }}
                                      className="rounded border-outline/30 text-[var(--theme-primary)]"
                                    />
                                    <span className="text-xs text-on-surface">{loc.name}</span>
                                  </label>
                                ))
                              )}
                            </div>
                          )}

                          {memberScope === "collection" && (
                            <div className="max-h-28 overflow-y-auto space-y-1.5 rounded-2xl bg-surface-container/20 p-2">
                              {allPlants.length === 0 ? (
                                <p className="text-xs text-on-surface-variant/50">No plants.</p>
                              ) : (
                                allPlants.map((plant) => (
                                  <label key={plant.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                                    <input
                                      type="checkbox"
                                      checked={memberScopePlantIds.includes(plant.id)}
                                      onChange={() => {
                                        setMemberScopePlantIds((prev) =>
                                          prev.includes(plant.id)
                                            ? prev.filter((id) => id !== plant.id)
                                            : [...prev, plant.id]
                                        );
                                      }}
                                      className="rounded border-outline/30 text-[var(--theme-primary)]"
                                    />
                                    <span className="text-xs text-on-surface">{plant.emoji} {plant.name}</span>
                                  </label>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setShowAddMember(false)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleAddMember} disabled={!memberName.trim()}>
                            <UserPlus size={14} />
                            Add Member
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowAddMember(true)}
                      >
                        <UserPlus size={14} />
                        Add Member
                      </Button>
                    )}

                    {/* Generate Invite Code */}
                    <div className="space-y-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={handleGenerateInviteCode}
                      >
                        <RefreshCw size={14} />
                        Generate New Invite Code
                      </Button>

                      {pendingInviteCode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="rounded-2xl bg-surface-container/30 p-3"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60 mb-1">
                            New Invite Code
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-xl bg-surface-container-high px-3 py-1.5 text-sm font-mono tracking-widest text-[var(--theme-primary)] text-center">
                              {pendingInviteCode}
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(pendingInviteCode);
                              }}
                              className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Pending Invites */}
                    {managingGarden.pendingInvites && managingGarden.pendingInvites.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                          Pending Invites ({managingGarden.pendingInvites.length})
                        </p>
                        {managingGarden.pendingInvites.map((inv) => (
                          <div
                            key={inv.code}
                            className="flex items-center justify-between rounded-2xl bg-surface-container/20 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <code className="rounded-lg bg-surface-container-high px-2 py-0.5 text-[10px] font-mono tracking-wider text-on-surface-variant">
                                {inv.code}
                              </code>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${roleBadgeClass(inv.role)}`}>
                                {inv.role}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Transfer Ownership */}
                    {migratedMembers.filter((m) => m.role !== "owner").length > 0 && (
                      <div className="rounded-2xl bg-surface-container/30 p-3 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                          Transfer Ownership
                        </p>
                        <Select
                          value={transferTargetId}
                          onValueChange={setTransferTargetId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select new owner..." />
                          </SelectTrigger>
                          <SelectContent>
                            {migratedMembers
                              .filter((m) => m.role !== "owner")
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="danger"
                          size="sm"
                          className="w-full"
                          disabled={!transferTargetId}
                          onClick={() => setShowTransferConfirm(true)}
                        >
                          Transfer Ownership
                        </Button>
                      </div>
                    )}

                    {/* Transfer Confirmation */}
                    <Dialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Transfer Ownership?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-on-surface-variant">
                          Are you sure you want to transfer ownership? You will become a caretaker.
                          This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="ghost" onClick={() => setShowTransferConfirm(false)}>
                            Cancel
                          </Button>
                          <Button
                            variant="danger"
                            onClick={handleTransferOwnership}
                          >
                            Transfer
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <>
                    {/* Non-owner member info */}
                    {currentMember && (
                      <div className="rounded-2xl bg-surface-container/30 p-3 space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                          Your Role &amp; Access
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass(currentMember.role)}`}>
                            {currentMember.role}
                          </span>
                          <span className="text-[10px] text-on-surface-variant/60">
                            {currentMember.scope?.type === "full"
                              ? "Full Access"
                              : currentMember.scope?.type === "location"
                                ? `${currentMember.scope.locationIds?.length ?? 0} location(s)`
                                : `${currentMember.scope.plantIds?.length ?? 0} plant(s)`}
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="danger"
                      size="sm"
                      className="w-full"
                      onClick={() => handleLeaveGarden(managingGarden.id)}
                    >
                      <DoorOpen size={14} />
                      Leave Garden
                    </Button>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation Dialog ---- */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Shared Garden?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-on-surface-variant">
            This will permanently delete the garden and all its member associations.
            Other members will no longer have access. Shared data will remain in their accounts.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmDelete && handleDeleteGarden(confirmDelete)}
            >
              Delete Garden
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
