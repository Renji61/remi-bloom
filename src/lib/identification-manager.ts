import {
  getSpeciesCache,
  setSpeciesCache,
  getInventoryForUser,
} from "@/lib/db";
import { compressImage } from "@/lib/image-utils";
import type {
  PlantIdResult,
  PerenualSpecies,
  PerenualCareGuide,
  SpeciesCacheEntry,
} from "@/lib/db";

const API_TIMEOUT_MS = 15000;

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
// API Calls (via local backend proxies)
// ──────────────────────────────────────────────

/**
 * Call the Plant.id identification API through our local backend proxy.
 * The API key stays on the server.
 */
async function callPlantIdApi(
  imageBlob: Blob,
): Promise<{ results: PlantIdResult[] }> {
  const formData = new FormData();
  formData.append("images", imageBlob, "plant.jpg");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch("/api/identify", {
      method: "POST",
      credentials: "include",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Plant.id API error (${response.status})`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch species data from Perenual through our local backend proxy.
 */
async function callPerenualSpecies(
  scientificName: string,
): Promise<PerenualSpecies | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `/api/perenual?action=species&q=${encodeURIComponent(scientificName)}`,
      { credentials: "include", signal: controller.signal },
    );

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
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch care guide from Perenual through our local backend proxy.
 */
async function callPerenualCareGuide(
  speciesId: number,
): Promise<PerenualCareGuide | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `/api/perenual?action=care-guide&species_id=${speciesId}`,
      { credentials: "include", signal: controller.signal },
    );

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
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Search Perenual species by common name (user-facing search).
 */
export async function searchByName(
  name: string,
): Promise<{ name: string; scientificName: string; thumbnailUrl?: string }[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `/api/perenual?action=search&q=${encodeURIComponent(name)}`,
      { credentials: "include", signal: controller.signal },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Perenual search error (${response.status})`);
    }

    const json = await response.json();
    return json.results ?? [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchCareDataForScientificName(
  scientificName: string,
  userId?: string,
): Promise<{ careSchedules: CareScheduleSuggestion[]; fertilizers: FertilizerSuggestion[]; sunlightNeeds: string[] }> {
  const cached = await getSpeciesCache(scientificName);
  let species: PerenualSpecies | null = null;
  let careGuide: PerenualCareGuide | null = null;

  if (cached) {
    species = cached.speciesData;
    careGuide = cached.careGuideData;
  } else {
    species = await callPerenualSpecies(scientificName);
    if (species) {
      careGuide = await callPerenualCareGuide(species.id);
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
        name.toLowerCase().includes(i.name.toLowerCase()),
    ),
  }));

  return { careSchedules, fertilizers, sunlightNeeds };
}

// ──────────────────────────────────────────────
// Parsing / Extraction helpers
// ──────────────────────────────────────────────

function parseCareSchedules(
  guide: PerenualCareGuide | null,
  species: PerenualSpecies | null,
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
  guide: PerenualCareGuide | null,
): string[] {
  if (!guide?.section) return [];
  const fertilizeSection = guide.section.find(
    (s) => s.type.toLowerCase() === "fertilization",
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
    signal?: AbortSignal,
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

    const visionResult = await callPlantIdApi(compressedBlob);
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
        species = await callPerenualSpecies(topResult.scientificName);
        if (species) {
          careGuide = await callPerenualCareGuide(species.id);
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
            name.toLowerCase().includes(i.name.toLowerCase()),
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
    userId?: string,
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
