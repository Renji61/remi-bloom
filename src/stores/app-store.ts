import { create } from "zustand";
import type {
  Plant,
  PlantLocation,
  CareEvent,
  JournalEntry,
  Tag,
  InventoryItem,
  Reminder,
  Todo,
  ProgressEntry,
  SharedGarden,
  ActionItem,
  User,
  AuditLog,
} from "@/lib/db";
import type { ThemeMode, ThemeColor } from "@/lib/theme-config";
import type { NotificationEngine } from "@/lib/notification-engine";

export interface ConnectionStatus {
  syncing: boolean;
  latency: number | null;
  offline: boolean;
}

interface AppState {
  // Theme
  themeMode: ThemeMode;
  themeColor: ThemeColor;

  // Currency
  currencyCode: string;
  currencySymbol: string;

  // Favicon
  faviconUrl: string;

  // Greenhouse
  greenhouseName: string;

  // Connection
  connectionStatus: ConnectionStatus;

  // Plants
  plants: Plant[];
  selectedPlantId: string | null;

  // Locations
  locations: PlantLocation[];
  selectedLocationId: string | null;

  // Tags
  tags: Tag[];

  // Care Events
  careEvents: CareEvent[];
  plantCareEvents: Record<string, CareEvent[]>;

  // Journal
  journalEntries: JournalEntry[];

  // Inventory
  inventoryItems: InventoryItem[];

  // Garden
  gardenCells: any[];
  selectedTool: "select" | "plant";
  selectedGardenPlant: string | null;

  // Scan
  scanResult: string | null;
  isScanning: boolean;

  // Reminders
  reminders: Reminder[];

  // Todos
  todos: Todo[];

  // Progress Entries
  progressEntries: ProgressEntry[];

  // Shared Gardens
  sharedGardens: SharedGarden[];

  // Weather
  weatherData: any | null;
  weatherLastFetchedAt: number | null;
  weatherLocationHash: string | null;

  // Actions — Action Engine
  actionItems: ActionItem[];

  // Actions — Theme
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (color: ThemeColor) => void;

  // Actions — Currency
  setCurrencyCode: (code: string) => void;
  setCurrencySymbol: (symbol: string) => void;

  // Actions — Favicon
  setFaviconUrl: (url: string) => void;

  // Actions — Greenhouse
  setGreenhouseName: (name: string) => void;

  setConnectionStatus: (status: Partial<ConnectionStatus>) => void;

  // Actions — Plants
  setPlants: (plants: Plant[]) => void;
  setSelectedPlantId: (id: string | null) => void;
  updatePlant: (plant: Plant) => void;
  addPlant: (plant: Plant) => void;
  removePlant: (id: string) => void;

  // Actions — Locations
  setLocations: (locations: PlantLocation[]) => void;
  setSelectedLocationId: (id: string | null) => void;
  addLocation: (location: PlantLocation) => void;
  removeLocation: (id: string) => void;
  updateLocation: (location: PlantLocation) => void;

  // Actions — Tags
  setTags: (tags: Tag[]) => void;
  addTag: (tag: Tag) => void;
  updateTag: (tag: Tag) => void;
  removeTag: (id: string) => void;

  // Actions — Care Events
  setCareEvents: (events: CareEvent[]) => void;
  setPlantCareEvents: (plantId: string, events: CareEvent[]) => void;
  addCareEvent: (event: CareEvent) => void;

  // Actions — Journal
  setJournalEntries: (entries: JournalEntry[]) => void;
  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (entry: JournalEntry) => void;
  removeJournalEntry: (id: string) => void;

  // Actions — Inventory
  setInventoryItems: (items: InventoryItem[]) => void;
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (item: InventoryItem) => void;
  removeInventoryItem: (id: string) => void;

  // Actions — Garden
  setGardenCells: (cells: any[]) => void;
  setSelectedTool: (tool: "select" | "plant") => void;
  setSelectedGardenPlant: (id: string | null) => void;

  // Actions — Scan
  setScanResult: (result: string | null) => void;
  setIsScanning: (scanning: boolean) => void;

  // Actions — Reminders
  setReminders: (reminders: Reminder[]) => void;
  addReminder: (reminder: Reminder) => void;
  updateReminder: (reminder: Reminder) => void;
  removeReminder: (id: string) => void;

  // Actions — Todos
  setTodos: (todos: Todo[]) => void;
  addTodo: (todo: Todo) => void;
  updateTodo: (todo: Todo) => void;
  removeTodo: (id: string) => void;

  // Actions — Progress
  setProgressEntries: (entries: ProgressEntry[]) => void;
  addProgressEntry: (entry: ProgressEntry) => void;
  updateProgressEntry: (entry: ProgressEntry) => void;
  removeProgressEntry: (id: string) => void;

  // Actions — Shared Gardens
  setSharedGardens: (gardens: SharedGarden[]) => void;
  addSharedGarden: (garden: SharedGarden) => void;
  removeSharedGarden: (id: string) => void;

  // Actions — Weather
  setWeatherData: (data: any) => void;
  setWeatherMeta: (timestamp: number, locationHash: string) => void;

  // Notifications — External alerts (Gotify / Apprise)
  notificationEngineType: NotificationEngine;
  notificationEngineUrl: string;
  notificationEngineToken: string;
  useWeatherAlerts: boolean;
  useCareAlerts: boolean;

  setNotificationEngine: (engine: NotificationEngine) => void;
  setNotificationEngineUrl: (url: string) => void;
  setNotificationEngineToken: (token: string) => void;
  setUseWeatherAlerts: (enabled: boolean) => void;
  setUseCareAlerts: (enabled: boolean) => void;

  // Actions — Action Engine
  setActionItems: (items: ActionItem[]) => void;
  addActionItem: (item: ActionItem) => void;
  updateActionItem: (item: ActionItem) => void;
  removeActionItem: (id: string) => void;
  completeActionItem: (id: string) => void;

  // Auth & Users
  currentUserId: string | null;
  currentUser: User | null;
  isLoggedIn: boolean;
  users: User[];
  auditLogs: AuditLog[];

  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  setCurrentUser: (user: User | null) => void;
  setUsers: (users: User[]) => void;
  setAuditLogs: (logs: AuditLog[]) => void;
  addUserToState: (user: User) => void;
  updateUserInState: (user: User) => void;
  removeUserFromState: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  themeMode: "dark",
  themeColor: "emerald",
  connectionStatus: { syncing: false, latency: null, offline: false },

  currencyCode: "USD",
  currencySymbol: "$",

  faviconUrl: "",
  greenhouseName: "My Greenhouse",

  plants: [],
  selectedPlantId: null,

  locations: [],
  selectedLocationId: null,

  tags: [],

  careEvents: [],
  plantCareEvents: {},

  journalEntries: [],

  inventoryItems: [],

  gardenCells: [],
  selectedTool: "select",
  selectedGardenPlant: null,

  scanResult: null,
  isScanning: false,

  reminders: [],
  todos: [],
  progressEntries: [],
  sharedGardens: [],
  weatherData: null,
  weatherLastFetchedAt: null,
  weatherLocationHash: null,
  actionItems: [],

  // Auth & Users
  currentUserId: null,
  currentUser: null,
  isLoggedIn: false,
  users: [],
  auditLogs: [],

  // UI State
  sidebarCollapsed: false,

  // Notification settings
  notificationEngineType: "disabled",
  notificationEngineUrl: "",
  notificationEngineToken: "",
  useWeatherAlerts: false,
  useCareAlerts: false,

  setNotificationEngine: (engine) => set({ notificationEngineType: engine }),
  setNotificationEngineUrl: (url) => set({ notificationEngineUrl: url }),
  setNotificationEngineToken: (token) => set({ notificationEngineToken: token }),
  setUseWeatherAlerts: (enabled) => set({ useWeatherAlerts: enabled }),
  setUseCareAlerts: (enabled) => set({ useCareAlerts: enabled }),

  // Auth setter actions
  setCurrentUser: (user) =>
    set({
      currentUser: user,
      currentUserId: user?.id ?? null,
      isLoggedIn: user !== null,
    }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setUsers: (users) => set({ users }),
  setAuditLogs: (logs) => set({ auditLogs: logs }),
  addUserToState: (user) =>
    set((state) => ({ users: [...state.users, user] })),
  updateUserInState: (user) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === user.id ? user : u)),
    })),
  removeUserFromState: (id) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== id),
    })),

  setThemeMode: (mode) => set({ themeMode: mode }),
  setThemeColor: (color) => set({ themeColor: color }),
  setCurrencyCode: (code) => set({ currencyCode: code }),
  setCurrencySymbol: (symbol) => set({ currencySymbol: symbol }),
  setFaviconUrl: (url) => set({ faviconUrl: url }),
  setGreenhouseName: (name) => set({ greenhouseName: name }),
  setConnectionStatus: (status) =>
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, ...status },
    })),

  setPlants: (plants) => set({ plants }),
  setSelectedPlantId: (id) => set({ selectedPlantId: id }),
  updatePlant: (plant) =>
    set((state) => ({
      plants: state.plants.map((p) => (p.id === plant.id ? plant : p)),
    })),
  addPlant: (plant) =>
    set((state) => ({ plants: [...state.plants, plant] })),
  removePlant: (id) =>
    set((state) => ({
      plants: state.plants.filter((p) => p.id !== id),
      plantCareEvents: Object.fromEntries(
        Object.entries(state.plantCareEvents).filter(([k]) => k !== id)
      ),
      careEvents: state.careEvents.filter((e) => e.plantId !== id),
      reminders: state.reminders.filter((r) => r.plantId !== id),
      progressEntries: state.progressEntries.filter((p) => p.plantId !== id),
    })),

  setLocations: (locations) => set({ locations }),
  setSelectedLocationId: (id) => set({ selectedLocationId: id }),
  addLocation: (location) =>
    set((state) => ({ locations: [...state.locations, location] })),
  removeLocation: (id) =>
    set((state) => ({
      locations: state.locations.filter((l) => l.id !== id),
      plants: state.plants.map((p) =>
        p.locationId === id ? { ...p, locationId: null } : p
      ),
    })),
  updateLocation: (location) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === location.id ? location : l
      ),
    })),

  setTags: (tags) => set({ tags }),
  addTag: (tag) =>
    set((state) => ({ tags: [...state.tags, tag] })),
  updateTag: (tag) =>
    set((state) => ({
      tags: state.tags.map((t) => (t.id === tag.id ? tag : t)),
    })),
  removeTag: (id) =>
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
      plants: state.plants.map((p) => ({
        ...p,
        tags: p.tags.filter((t) => t !== id),
      })),
    })),

  setCareEvents: (events) => set({ careEvents: events }),
  setPlantCareEvents: (plantId, events) =>
    set((state) => ({
      plantCareEvents: { ...state.plantCareEvents, [plantId]: events },
    })),
  addCareEvent: (event) =>
    set((state) => ({
      careEvents: [event, ...state.careEvents],
      plantCareEvents: {
        ...state.plantCareEvents,
        [event.plantId]: [
          event,
          ...(state.plantCareEvents[event.plantId] || []),
        ],
      },
    })),

  setJournalEntries: (entries) => set({ journalEntries: entries }),
  addJournalEntry: (entry) =>
    set((state) => ({
      journalEntries: [entry, ...state.journalEntries],
    })),
  updateJournalEntry: (entry) =>
    set((state) => ({
      journalEntries: state.journalEntries.map((e) =>
        e.id === entry.id ? entry : e
      ),
    })),
  removeJournalEntry: (id) =>
    set((state) => ({
      journalEntries: state.journalEntries.filter((e) => e.id !== id),
    })),

  setInventoryItems: (items) => set({ inventoryItems: items }),
  addInventoryItem: (item) =>
    set((state) => ({ inventoryItems: [...state.inventoryItems, item] })),
  updateInventoryItem: (item) =>
    set((state) => ({
      inventoryItems: state.inventoryItems.map((i) =>
        i.id === item.id ? item : i
      ),
    })),
  removeInventoryItem: (id) =>
    set((state) => ({
      inventoryItems: state.inventoryItems.filter((i) => i.id !== id),
    })),

  setGardenCells: (cells) => set({ gardenCells: cells }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setSelectedGardenPlant: (id) => set({ selectedGardenPlant: id }),

  setScanResult: (result) => set({ scanResult: result }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  setReminders: (reminders) => set({ reminders }),
  addReminder: (reminder) =>
    set((state) => ({ reminders: [...state.reminders, reminder] })),
  updateReminder: (reminder) =>
    set((state) => ({
      reminders: state.reminders.map((r) =>
        r.id === reminder.id ? reminder : r
      ),
    })),
  removeReminder: (id) =>
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    })),

  setTodos: (todos) => set({ todos }),
  addTodo: (todo) =>
    set((state) => ({ todos: [...state.todos, todo] })),
  updateTodo: (todo) =>
    set((state) => ({
      todos: state.todos.map((t) => (t.id === todo.id ? todo : t)),
    })),
  removeTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((t) => t.id !== id),
    })),

  setProgressEntries: (entries) => set({ progressEntries: entries }),
  addProgressEntry: (entry) =>
    set((state) => ({ progressEntries: [...state.progressEntries, entry] })),
  updateProgressEntry: (entry) =>
    set((state) => ({
      progressEntries: state.progressEntries.map((p) =>
        p.id === entry.id ? entry : p
      ),
    })),
  removeProgressEntry: (id) =>
    set((state) => ({
      progressEntries: state.progressEntries.filter((p) => p.id !== id),
    })),

  setSharedGardens: (gardens) => set({ sharedGardens: gardens }),
  addSharedGarden: (garden) =>
    set((state) => ({ sharedGardens: [...state.sharedGardens, garden] })),
  removeSharedGarden: (id) =>
    set((state) => ({
      sharedGardens: state.sharedGardens.filter((g) => g.id !== id),
    })),

  setWeatherData: (data) => set({ weatherData: data }),
  setWeatherMeta: (timestamp, locationHash) =>
    set({ weatherLastFetchedAt: timestamp, weatherLocationHash: locationHash }),

  // --- Action Engine ---
  setActionItems: (items) => set({ actionItems: items }),
  addActionItem: (item) =>
    set((state) => ({ actionItems: [...state.actionItems, item] })),
  updateActionItem: (item) =>
    set((state) => ({
      actionItems: state.actionItems.map((a) =>
        a.id === item.id ? item : a
      ),
    })),
  removeActionItem: (id) =>
    set((state) => ({
      actionItems: state.actionItems.filter((a) => a.id !== id),
    })),
  completeActionItem: (id) =>
    set((state) => ({
      actionItems: state.actionItems.map((a) =>
        a.id === id ? { ...a, completed: true } : a
      ),
    })),
}));
