"use client";

export const dynamic = "force-dynamic";

import { usePageTitle } from "@/hooks/use-page-title";
import { useState, useMemo, useCallback } from "react";
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
  addReminder,
  addJournalEntry,
  saveGardenCells,
} from "@/lib/db";
import { generateId, sanitizeString, sanitizeArray } from "@/lib/utils";
import type { SharedGarden, SharedMember, Plant, PlantLocation, InventoryItem, Reminder, JournalEntry, GardenCell } from "@/lib/db";

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
    case "editor":
      return "bg-[var(--theme-primary)]/15 text-[var(--theme-primary)]";
    case "viewer":
      return "bg-surface-container-high text-on-surface-variant";
  }
}

export default function SharePage() {
  usePageTitle("Shared Garden");
  const currentUserId = useAppStore((s) => s.currentUserId);
  const currentUser = useAppStore((s) => s.currentUser);
  const sharedGardens = useAppStore((s) => s.sharedGardens);
  const setSharedGardens = useAppStore((s) => s.setSharedGardens);
  const addGardenToStore = useAppStore((s) => s.addSharedGarden);
  const removeGardenFromStore = useAppStore((s) => s.removeSharedGarden);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [gardenName, setGardenName] = useState("");

  const [managingGarden, setManagingGarden] = useState<SharedGarden | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("editor");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [joinStatus, setJoinStatus] = useState<{
    type: "idle" | "loading" | "found" | "error";
    garden?: SharedGarden;
    message?: string;
  }>({ type: "idle" });

  // Import/export state
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importGardenId, setImportGardenId] = useState<string | null>(null);

  // --- Create Garden ---
  const handleCreateGarden = useCallback(async () => {
    if (!gardenName.trim() || !currentUserId || !currentUser) return;

    const newGarden: SharedGarden = {
      id: generateId(),
      ownerId: currentUserId,
      gardenName: gardenName.trim(),
      code: generateInviteCode(),
      createdAt: new Date().toISOString().split("T")[0],
      members: [
        {
          id: currentUserId,
          name: currentUser.displayName,
          role: "owner",
          addedAt: new Date().toISOString(),
        },
      ],
      sharedPlantIds: [],
    };

    await addSharedGarden(newGarden);
    addGardenToStore(newGarden);
    setGardenName("");
    setShowCreateDialog(false);
  }, [gardenName, currentUserId, currentUser, addGardenToStore]);

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
    if (!managingGarden || !memberName.trim()) return;

    const newMember: SharedMember = {
      id: generateId(),
      name: memberName.trim(),
      role: memberRole,
      addedAt: new Date().toISOString(),
    };

    const updated: SharedGarden = {
      ...managingGarden,
      members: [...managingGarden.members, newMember],
    };

    await updateSharedGarden(updated);

    setSharedGardens(
      sharedGardens.map((g) => (g.id === updated.id ? updated : g))
    );
    setManagingGarden(updated);
    setMemberName("");
    setShowAddMember(false);
  }, [managingGarden, memberName, memberRole, setSharedGardens, sharedGardens]);

  // --- Remove Member ---
  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (!managingGarden) return;

      const updated: SharedGarden = {
        ...managingGarden,
        members: managingGarden.members.filter((m) => m.id !== memberId),
      };

      await updateSharedGarden(updated);

      setSharedGardens(
        sharedGardens.map((g) => (g.id === updated.id ? updated : g))
      );
      setManagingGarden(updated);
    },
    [managingGarden, setSharedGardens, sharedGardens]
  );

  // --- Join Garden ---
  const handleLookupCode = useCallback(async () => {
    if (!inviteCode.trim()) return;

    setJoinStatus({ type: "loading" });

    try {
      const garden = await getSharedGardenByCode(inviteCode.trim().toUpperCase());
      if (garden) {
        setJoinStatus({ type: "found", garden });
      } else {
        setJoinStatus({
          type: "error",
          message: "No garden found with that invite code.",
        });
      }
    } catch {
      setJoinStatus({
        type: "error",
        message: "An error occurred while looking up the code.",
      });
    }
  }, [inviteCode]);

  // --- Export my data to garden ---
  const handleExportToGarden = useCallback(async (gardenId: string) => {
    if (!currentUserId) return;
    setExportStatus(gardenId);

    try {
      const garden = sharedGardens.find((g) => g.id === gardenId);
      if (!garden) throw new Error("Garden not found");

      // Gather all user's data and generate a serializable snapshot
      const [plants, locations, inventory, reminders, journals, gardenCells] = await Promise.all([
        getPlantsForUser(currentUserId),
        getLocationsForUser(currentUserId),
        getInventoryForUser(currentUserId),
        getRemindersForUser(currentUserId),
        getJournalEntriesForUser(currentUserId),
        getGardenCellsForUser(currentUserId),
      ]);

      const exportData = {
        exportedBy: currentUserId,
        exportedAt: new Date().toISOString(),
        plants,
        locations,
        inventory,
        reminders,
        journals,
        gardenCells,
      };

      // Store export data in garden metadata via localStorage
      // Since IndexedDB SharedGarden doesn't have a freeform data field,
      // we use the garden ID as a localStorage key
      localStorage.setItem(`garden-export-${gardenId}`, JSON.stringify(exportData));

      setExportStatus(null);
      setImportStatus("Data exported to garden! Other members can now import it.");
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
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

      // Import plants, locations, inventory, reminders, journals with sanitization
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
      if (data.reminders?.length) {
        await Promise.all(data.reminders.map((r: any) => {
          const safe = sanitizeFields(reUserId(r), ["title", "note", "plantName"]);
          return addReminder(safe);
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

  const ownerGardens = useMemo(
    () => sharedGardens.filter((g) => g.ownerId === currentUserId),
    [sharedGardens, currentUserId]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
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
          {ownerGardens.length === 0 ? (
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
                  {ownerGardens.length} garden{ownerGardens.length !== 1 ? "s" : ""}
                </p>
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus size={14} />
                  Create Garden
                </Button>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {ownerGardens.map((garden, i) => (
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
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 text-[10px] font-mono tracking-wider text-on-surface-variant">
                                  {garden.code}
                                </span>
                                <span className="text-[10px] text-on-surface-variant/60">
                                  {garden.members.length} member{garden.members.length !== 1 ? "s" : ""}
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
                                  Export My Data
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
                                  Import Garden Data
                                </Button>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setManagingGarden(garden)}
                              >
                                <Users size={14} />
                                Members
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setConfirmDelete(garden.id)}
                              >
                                <UserMinus size={14} />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </TabsContent>

        {/* ---- Join Garden Tab ---- */}
        <TabsContent value="join">
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
                  {joinStatus.type === "loading" ? "Searching..." : "Join"}
                </Button>
              </div>

              {joinStatus.type === "found" && joinStatus.garden && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-2xl bg-[var(--theme-primary)]/10 p-4"
                >
                  <div className="flex items-center gap-2">
                    <Sprout size={16} className="text-[var(--theme-primary)]" />
                    <h4 className="text-sm font-semibold text-on-surface">
                      {joinStatus.garden.gardenName}
                    </h4>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant/70">
                    {joinStatus.garden.members.length} member
                    {joinStatus.garden.members.length !== 1 ? "s" : ""} · Created{" "}
                    {formatDate(joinStatus.garden.createdAt)}
                  </p>
                  <p className="mt-2 text-[11px] text-on-surface-variant/60">
                    Contact the garden owner to be added as a member. Once added, you can import
                    the shared garden data.
                  </p>
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
        </TabsContent>
      </Tabs>

      {/* ---- Create Garden Dialog ---- */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setGardenName("");
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
              <Button onClick={handleCreateGarden} disabled={!gardenName.trim()}>
                <Plus size={14} />
                Create Garden
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Manage Members Dialog ---- */}
      <Dialog
        open={!!managingGarden}
        onOpenChange={(open) => {
          if (!open) {
            setManagingGarden(null);
            setShowAddMember(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Sprout size={18} className="inline mr-1.5 text-[var(--theme-primary)]" />
              {managingGarden?.gardenName} — Members
            </DialogTitle>
          </DialogHeader>

          {managingGarden && (
            <div className="space-y-4">
              {/* Member List */}
              <div className="space-y-2">
                {managingGarden.members.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/50">No members yet.</p>
                ) : (
                  managingGarden.members.map((member, i) => (
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
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {member.role === "owner" && (
                              <Shield size={10} className="text-amber-400" />
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${roleBadgeClass(member.role)}`}
                            >
                              {member.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      {member.role !== "owner" && (
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
                      {(["editor", "viewer"] as const).map((role) => (
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

              {/* Invite Code */}
              <div className="rounded-2xl bg-surface-container/30 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
                  Invite Code
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded-xl bg-surface-container-high px-3 py-1.5 text-sm font-mono tracking-widest text-[var(--theme-primary)] text-center">
                    {managingGarden.code}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(managingGarden.code);
                    }}
                    className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container-high transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
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
