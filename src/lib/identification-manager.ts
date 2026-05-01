import {
  getSpeciesCache,
  setSpeciesCache,
  getUserSetting,
  getInventoryForUser,
} from "@/lib/db";
import { compressImage } from "@/lib/image-utils";
import { generateId } from "@/lib/utils";
import type {
  PlantIdResult,
  PerenualSpecies,
  PerenualCareGuide,
  PerenualCareSection,
  SpeciesCacheEntry,
} from "@/lib/db";

const API_TIMEOUT_MS = 15000;

function combineAbortSignals(
  ...signals: (AbortSignal | null | undefined)[]
): AbortSignal | undefined {
  const validSignals = signals.filter(
    (s): s is AbortSignal => s != null
  );
  if (validSignals.length === 0) return undefined;
  if (validSignals.length === 1) return validSignals[0];
  const controller = new AbortController();
  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combinedSignal = combineAbortSignals(timeoutController.signal, options.signal);
  try {
    return await fetch(url, { ...options, signal: combinedSignal ?? timeoutController.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 2, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetchWithTimeout(url, options, timeoutMs);
    if (res.ok || (res.status >= 400 && res.status < 500)) return res;
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return fetchWithTimeout(url, options, timeoutMs);
}

// --- API key resolution from user settings ---

async function getPlantIdKey(userId?: string): Promise<string> {
  if (userId) {
    const fromSettings = await getUserSetting(userId, "plantidApiKey");
    if (fromSettings) return fromSettings;
  }
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PLANTID_API_KEY) {
    return process.env.NEXT_PUBLIC_PLANTID_API_KEY;
  }
  return "";
}

async function getPerenualKey(userId?: string): Promise<string> {
  if (userId) {
    const fromSettings = await getUserSetting(userId, "perenualApiKey");
    if (fromSettings) return fromSettings;
  }
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PERENUAL_API_KEY) {
    return process.env.NEXT_PUBLIC_PERENUAL_API_KEY;
  }
  return "";
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CareScheduleSuggestion {
  type: string;
  label?: string;
  description: string;
  note?: string;
  frequency?: string;
  /** Frequency in days, used by UI for "Every X days" display */
  frequencyDays?: number;
}

export interface FertilizerSuggestion {
  name: string;
  inStock: boolean;
}

export interface IdentifiedPlant {
  name: string;
  scientificName: string;
  confidence: number;
  thumbnailUrl?: string;
  healthAssessment?: string;
}

export interface IdentificationResult {
  species: IdentifiedPlant;
  topMatches: { name: string; scientificName: string; confidence: number }[];
  careSchedules: CareScheduleSuggestion[];
  fertilizers: FertilizerSuggestion[];
  sunlightNeeds: string[];
  careGuideRaw: PerenualCareGuide | null;
  speciesRaw: PerenualSpecies | null;
  imageDataUrl?: string;
}

export type ProgressCallback = (info: { step: number; message: string }) => void;

// Backward-compatible type alias
export type IdentificationProgress = { step: number; message: string };

// ──────────────────────────────────────────────
// API Calls
// ──────────────────────────────────────────────

async function callPlantIdApi(
  imageBlob: Blob,
  userId?: string
): Promise<{ results: PlantIdResult[] }> {
  const apiKey = await getPlantIdKey(userId);
  if (!apiKey) {
    throw new Error("Plant.id API key is not configured. Add it in Settings.");
  }

  const formData = new FormData();
  formData.append("images", imageBlob, "plant.jpg");
  formData.append("organs", "leaf,flower,fruit,bark,habit");

  const url = "https://api.plant.id/v3/identification";
  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Plant.id API error (${response.status})`);
  }

  const json = await response.json();
  const suggestions = json.result?.classification?.suggestions ?? [];
  const results: PlantIdResult[] = suggestions.map((s: any) => ({
    name: s.name ?? "Unknown",
    confidence: Math.round((s.probability ?? 0) * 100),
    scientificName: s.details?.scientific_name ?? "",
    healthAssessment: s.details?.health_assessment ?? undefined,
  }));

  return { results };
}

async function callPerenualSpecies(
  scientificName: string,
  userId?: string
): Promise<PerenualSpecies | null> {
  const apiKey = await getPerenualKey(userId);
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Perenual API key is not configured. Skipping species enrichment."
      );
    }
    return null;
  }

  const url = `https://perenual.com/api/species-list?key=${apiKey}&q=${encodeURIComponent(scientificName)}`;
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Perenual species search failed (${response.status})`);
      }
      return null;
    }
    const json = await response.json();
    const data = json.data?.[0];
    return data ?? null;
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Perenual species search failed due to network error");
    }
    return null;
  }
}

async function callPerenualCareGuide(
  speciesId: number,
  userId?: string
): Promise<PerenualCareGuide | null> {
  const apiKey = await getPerenualKey(userId);
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Perenual API key is not configured. Skipping care guide enrichment.");
    }
    return null;
  }

  const url = `https://perenual.com/api/species-care-guide-list?key=${apiKey}&species_id=${speciesId}`;
  try {
    const response = await fetchWithRetry(url);
    if (!response.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Perenual care guide fetch failed (${response.status})`);
      }
      return null;
    }
    const json = await response.json();
    return json.data?.[0] ?? null;
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Perenual care guide fetch failed due to network error");
    }
    return null;
  }
}

/**
 * Search Perenual species by common name (user-facing search).
 */
export async function searchByName(
  name: string,
  userId?: string
): Promise<{ name: string; scientificName: string; thumbnailUrl?: string }[]> {
  const apiKey = await getPerenualKey(userId);
  if (!apiKey) {
    throw new Error("Perenual API key is not configured. Add it in Settings.");
  }

  const url = `https://perenual.com/api/species-list?key=${apiKey}&q=${encodeURIComponent(name)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Perenual species search error (${response.status})`);
  }

  const json = await response.json();
  const data: PerenualSpecies[] = json.data ?? [];
  return data.map((s) => ({
    name: s.common_name || s.scientific_name?.[0] || "Unknown",
    scientificName: s.scientific_name?.[0] || "",
    thumbnailUrl: s.default_image?.medium_url ?? undefined,
  }));
}

async function fetchCareDataForScientificName(
  scientificName: string,
  userId?: string
): Promise<{ careSchedules: CareScheduleSuggestion[]; fertilizers: FertilizerSuggestion[]; sunlightNeeds: string[] }> {
  const cached = await getSpeciesCache(scientificName);
  let species: PerenualSpecies | null = null;
  let careGuide: PerenualCareGuide | null = null;

  if (cached) {
    species = cached.speciesData;
    careGuide = cached.careGuideData;
  } else {
    species = await callPerenualSpecies(scientificName, userId);
    if (species) {
      careGuide = await callPerenualCareGuide(species.id, userId);
      await setSpeciesCache({
        scientificName,
        speciesData: species,
        careGuideData: careGuide,
        cachedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  const careSchedules = parseCareSchedules(careGuide, species);
  const sunlightNeeds = parseSunlightNeeds(species);
  const fertilizerNames = extractFertilizerNames(careGuide);
  const inventory = userId
    ? await getInventoryForUser(userId)
    : [];
  const fertilizers = fertilizerNames.map((name) => ({
    name,
    inStock: inventory.some(
      (i) =>
        i.category === "supply" &&
        name.toLowerCase().includes(i.name.toLowerCase())
    ),
  }));

  return { careSchedules, fertilizers, sunlightNeeds };
}

// ──────────────────────────────────────────────
// Parsing / Extraction helpers
// ──────────────────────────────────────────────

function parseCareSchedules(
  guide: PerenualCareGuide | null,
  species: PerenualSpecies | null
): CareScheduleSuggestion[] {
  const schedules: CareScheduleSuggestion[] = [];

  if (guide?.section) {
    for (const section of guide.section) {
      schedules.push({
        type: normalizeCareType(section.type),
        description: section.description?.substring(0, 200) ?? "",
      });
    }
  }

  if (species) {
    const wateringDesc = species.watering
      ? `Watering: ${species.watering}`
      : "";
    if (wateringDesc && !schedules.some((s) => s.type === "water")) {
      schedules.push({ type: "water", description: wateringDesc, frequency: species.watering });
    }
  }

  return schedules;
}

function normalizeCareType(type: string): string {
  const map: Record<string, string> = {
    watering: "water",
    fertilization: "fertilize",
    pruning: "prune",
    repotting: "repot",
    sunlight: "sunlight",
    "soil requirements": "soil",
    temperature: "temperature",
    humidity: "humidity",
    "pest and disease management": "pest",
  };
  return map[type.toLowerCase()] ?? type.toLowerCase();
}

function parseSunlightNeeds(species: PerenualSpecies | null): string[] {
  if (!species?.sunlight) return [];
  return species.sunlight.map((s: string) => s.trim()).filter(Boolean);
}

function extractFertilizerNames(
  guide: PerenualCareGuide | null
): string[] {
  if (!guide?.section) return [];
  const fertilizeSection = guide.section.find(
    (s) => s.type.toLowerCase() === "fertilization"
  );
  if (!fertilizeSection?.description) return [];

  const text = fertilizeSection.description.toLowerCase();
  const commonFertilizers = [
    "compost",
    "worm castings",
    "fish emulsion",
    "liquid fertilizer",
    "slow-release fertilizer",
    "balanced fertilizer",
    "nitrogen-rich fertilizer",
    "potassium-rich fertilizer",
    "phosphorus-rich fertilizer",
    "organic fertilizer",
    "seaweed extract",
    "bone meal",
    "blood meal",
    "kelp meal",
  ];

  return commonFertilizers.filter((f) => text.includes(f));
}

// ──────────────────────────────────────────────
// Backward-compatible static API
// ──────────────────────────────────────────────

/**
 * IdentificationManager — static API used by plant-identifier.tsx and identify-plant-dialog.tsx.
 */
export const IdentificationManager = {
  searchByName,

  async identify(
    imageFile: File,
    onProgress?: ProgressCallback,
    userId?: string,
    signal?: AbortSignal
  ): Promise<IdentificationResult> {
    const report = (step: number, message: string) =>
      onProgress?.({ step, message });

    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    report(1, "Step 1: Identifying species...");

    const compressedBlob = await compressImage(imageFile);
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(compressedBlob);
    });

    report(2, "Step 2: Analyzing with Plant.id...");

    const visionResult = await callPlantIdApi(compressedBlob, userId);
    const results = visionResult.results;

    if (results.length === 0) {
      throw new Error("No plant species identified. Try a clearer photo.");
    }

    const topResult = results[0];
    const topMatches = results.slice(0, 3);

    let species: PerenualSpecies | null = null;
    let careGuide: PerenualCareGuide | null = null;
    let careSchedules: CareScheduleSuggestion[] = [];
    let fertilizers: FertilizerSuggestion[] = [];
    let sunlightNeeds: string[] = [];

    if (topResult.confidence >= 80 && topResult.scientificName) {
      report(3, "Step 3: Retrieving expert care guides...");

      const cached = await getSpeciesCache(topResult.scientificName);
      if (cached) {
        species = cached.speciesData;
        careGuide = cached.careGuideData;
      } else {
        species = await callPerenualSpecies(topResult.scientificName, userId);
        if (species) {
          careGuide = await callPerenualCareGuide(species.id, userId);
        }
        if (species) {
          await setSpeciesCache({
            scientificName: topResult.scientificName,
            speciesData: species,
            careGuideData: careGuide,
            cachedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }

      report(4, "Step 4: Setting up your care schedule...");
      careSchedules = parseCareSchedules(careGuide, species);
      sunlightNeeds = parseSunlightNeeds(species);

      const fertilizerNames = extractFertilizerNames(careGuide);
      const inventory = userId
        ? await getInventoryForUser(userId)
        : [];
      fertilizers = fertilizerNames.map((name) => ({
        name,
        inStock: inventory.some(
          (i) =>
            i.category === "supply" &&
            name.toLowerCase().includes(i.name.toLowerCase())
        ),
      }));
    }

    return {
      species: {
        name: topResult.name,
        scientificName: topResult.scientificName,
        confidence: topResult.confidence,
        thumbnailUrl: topResult.scientificName
          ? `https://perenual.com/storage/species_image/${encodeURIComponent(topResult.scientificName)}/thumbnail.jpg`
          : undefined,
        healthAssessment: topResult.healthAssessment,
      },
      topMatches: topMatches.map((m) => ({
        name: m.name,
        scientificName: m.scientificName,
        confidence: m.confidence,
      })),
      careSchedules,
      fertilizers,
      sunlightNeeds,
      careGuideRaw: careGuide,
      speciesRaw: species,
      imageDataUrl,
    };
  },

  /**
   * Fetch care data for a scientific name without needing a photo.
   * Used by manual plant search flow.
   */
  async fetchCareData(
    scientificName: string,
    userId?: string
  ): Promise<{ careSchedules: CareScheduleSuggestion[]; fertilizers: FertilizerSuggestion[]; sunlightNeeds: string[] }> {
    return fetchCareDataForScientificName(scientificName, userId);
  },

  suggestKnownPlants(): { name: string; scientificName: string }[] {
    return [
      { name: "Monstera", scientificName: "Monstera deliciosa" },
      { name: "Snake Plant", scientificName: "Sansevieria trifasciata" },
      { name: "Pothos", scientificName: "Epipremnum aureum" },
      { name: "Spider Plant", scientificName: "Chlorophytum comosum" },
      { name: "Peace Lily", scientificName: "Spathiphyllum wallisii" },
      { name: "Aloe Vera", scientificName: "Aloe barbadensis miller" },
      { name: "Fiddle Leaf Fig", scientificName: "Ficus lyrata" },
      { name: "ZZ Plant", scientificName: "Zamioculcas zamiifolia" },
      { name: "Rubber Plant", scientificName: "Ficus elastica" },
      { name: "Bamboo Palm", scientificName: "Chamaedorea seifrizii" },
    ];
  },
};
