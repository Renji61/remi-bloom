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

// --- API key resolution from user settings ---

async function getPlantIdKey(userId?: string): Promise<string> {
  if (userId) {
    const fromSettings = await getUserSetting(userId, "plantidApiKey");
    if (fromSettings) return fromSettings;
  }
  return "";
}

async function getPerenualKey(userId?: string): Promise<string> {
  if (userId) {
    const fromSettings = await getUserSetting(userId, "perenualApiKey");
    if (fromSettings) return fromSettings;
  }
  return "";
}

// --- Types ---

export interface IdentificationProgress {
  step: number;
  message: string;
}

export interface IdentifiedPlant {
  name: string;
  scientificName: string;
  confidence: number;
  thumbnailUrl?: string;
  healthAssessment?: string;
}

export interface CareScheduleSuggestion {
  type: "water" | "fertilize" | "repot" | "prune" | "general";
  label: string;
  frequencyDays: number;
  note: string;
}

export interface FertilizerSuggestion {
  name: string;
  inStock: boolean;
}

export interface IdentificationResult {
  species: IdentifiedPlant;
  topMatches: IdentifiedPlant[];
  careSchedules: CareScheduleSuggestion[];
  fertilizers: FertilizerSuggestion[];
  sunlightNeeds: string[];
  careGuideRaw: PerenualCareGuide | null;
  speciesRaw: PerenualSpecies | null;
  imageDataUrl?: string;
}

type ProgressCallback = (progress: IdentificationProgress) => void;

// --- Step A: Plant.id vision API ---

async function callPlantIdApi(
  imageBlob: Blob,
  userId?: string
): Promise<{ results: PlantIdResult[] }> {
  const apiKey = await getPlantIdKey(userId);
  if (!apiKey) {
    throw new Error("Plant.id API key not configured. Add it in Settings > API Keys.");
  }

  const formData = new FormData();
  // Plant.id accepts direct image upload with "images" field
  formData.append("images", imageBlob, "plant.webp");

  const res = await fetch("https://api.plant.id/v3/identification?include_health_probability=true", {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Plant.id API error (${res.status}): ${errText}`);
  }

  const data = await res.json();

  // Parse the v3 response
  if (!data || !data.result || !data.result.classification) {
    throw new Error("Unexpected Plant.id API response format");
  }

  const suggestions = data.result.classification.suggestions || [];
  const results: PlantIdResult[] = suggestions.map((s: any) => ({
    name: s.name || "Unknown",
    confidence: Math.round((s.probability || 0) * 100),
    scientificName: s.details?.scientific_name?.[0] || s.name || "",
    healthAssessment: s.details?.common_names?.[0] || undefined,
  }));

  // If health assessment is enabled, parse it
  let healthAssessment: string | undefined;
  const health = data.result?.health_assessment;
  if (health) {
    const isHealthy = health.is_healthy;
    healthAssessment = isHealthy ? "Healthy" : "Needs attention";
    if (health.description) {
      healthAssessment += ` - ${health.description}`;
    }
  }

  // Apply health assessment to the top result
  if (results.length > 0 && healthAssessment) {
    results[0].healthAssessment = healthAssessment;
  }

  return { results };
}

// --- Step B: Perenual Species List ---

async function callPerenualSpecies(
  scientificName: string,
  userId?: string
): Promise<PerenualSpecies | null> {
  const apiKey = await getPerenualKey(userId);
  if (!apiKey) {
    console.warn("Perenual API key not configured. Skipping species lookup.");
    return null;
  }

  const url = `https://perenual.com/api/species-list?key=${apiKey}&q=${encodeURIComponent(scientificName)}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`Perenual species search error (${res.status}): ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  if (!data || !data.data || data.data.length === 0) return null;

  // Find the best match by looking for exact scientific name match
  const exact = data.data.find(
    (s: any) =>
      s.scientific_name &&
      s.scientific_name.some(
        (n: string) => n.toLowerCase() === scientificName.toLowerCase()
      )
  );
  return exact || data.data[0];
}

// --- Step C: Perenual Species Care Guide ---

async function callPerenualCareGuide(
  speciesId: number,
  userId?: string
): Promise<PerenualCareGuide | null> {
  const apiKey = await getPerenualKey(userId);
  if (!apiKey) return null;

  const url = `https://perenual.com/api/species-care-guide-list?key=${apiKey}&species_id=${speciesId}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.warn(`Perenual care guide error (${res.status}): ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  if (!data || !data.data || data.data.length === 0) return null;
  return data.data[0];
}

// --- Parse care schedules from Perenual care guide ---

function parseCareSchedules(
  careGuide: PerenualCareGuide | null,
  species: PerenualSpecies | null
): CareScheduleSuggestion[] {
  const schedules: CareScheduleSuggestion[] = [];

  // 1. From care guide sections
  if (careGuide?.section) {
    for (const section of careGuide.section) {
      const desc = (section.description || "").toLowerCase();

      // Watering frequency
      if (section.type === "watering") {
        const match = desc.match(/(\d+)\s*-\s*(\d+)\s*days/i);
        if (match) {
          const avgDays = Math.round(
            (parseInt(match[1]) + parseInt(match[2])) / 2
          );
          schedules.push({
            type: "water",
            label: "Watering",
            frequencyDays: avgDays,
            note: section.description,
          });
        } else {
          // If description mentions watering but no number, default to 7 days
          schedules.push({
            type: "water",
            label: "Watering",
            frequencyDays: 7,
            note: section.description || "Regular watering",
          });
        }
      }

      // Fertilizer
      if (section.type === "fertilization") {
        const match = desc.match(/(\d+)\s*days/i);
        const days = match ? parseInt(match[1]) : 30;
        schedules.push({
          type: "fertilize",
          label: "Fertilizing",
          frequencyDays: days,
          note: section.description || "Regular fertilizing",
        });
      }

      // Pruning
      if (section.type === "pruning") {
        const match = desc.match(/(\d+)\s*days/i);
        const days = match ? parseInt(match[1]) : 90;
        schedules.push({
          type: "prune",
          label: "Pruning",
          frequencyDays: days,
          note: section.description || "Regular pruning",
        });
      }
    }
  }

  // 2. From species-level watering hint (fallback)
  if (species && schedules.length === 0) {
    const w = (species.watering || "").toLowerCase();
    if (w.includes("frequent")) {
      schedules.push({
        type: "water",
        label: "Watering",
        frequencyDays: 3,
        note: "Frequent watering",
      });
    } else if (w.includes("average") || w.includes("moderate")) {
      schedules.push({
        type: "water",
        label: "Watering",
        frequencyDays: 7,
        note: "Moderate watering",
      });
    } else if (w.includes("minimum")) {
      schedules.push({
        type: "water",
        label: "Watering",
        frequencyDays: 14,
        note: "Minimum watering",
      });
    } else if (w.includes("none")) {
      // skip
    } else {
      // default
      schedules.push({
        type: "water",
        label: "Watering",
        frequencyDays: 7,
        note: "Regular watering",
      });
    }
  }

  return schedules;
}

// --- Parse sunlight needs ---

function parseSunlightNeeds(species: PerenualSpecies | null): string[] {
  if (!species?.sunlight) return [];
  return species.sunlight.map((s) =>
    s.charAt(0).toUpperCase() + s.slice(1)
  );
}

// --- Extract fertilizer names from care guide ---

function extractFertilizerNames(careGuide: PerenualCareGuide | null): string[] {
  if (!careGuide?.section) return [];
  const names: string[] = [];
  for (const section of careGuide.section) {
    if (section.type === "fertilization" && section.description) {
      // Try to extract fertilizer product names from the description
      const matches = section.description.match(
        /(?:use|apply|fertilize with)\s+([A-Za-z0-9\s\-]+?)(?:\.|,|$)/gi
      );
      if (matches) {
        matches.forEach((m) => {
          const cleaned = m.replace(/^(use|apply|fertilize with)\s+/i, "").replace(/[.,]+$/, "").trim();
          if (cleaned) names.push(cleaned);
        });
      }
      // Fallback: add the whole description as suggestion
      if (names.length === 0) {
        names.push(section.description.trim());
      }
    }
  }
  return [...new Set(names)];
}

// ===============================
// Main public API
// ===============================

export const IdentificationManager = {
  /**
   * Full identification pipeline:
   * 1. Compress image
   * 2. Call Plant.id API (vision)
   * 3. If confidence > 80%, try Perenual species & care guide
   * 4. Parse results into IdentificationResult
   * 5. Cache the Perenual data in IndexedDB
   */
  async identify(
    imageFile: File,
    onProgress?: ProgressCallback,
    userId?: string
  ): Promise<IdentificationResult> {
    const report = (step: number, message: string) =>
      onProgress?.({ step, message });

    report(1, "Step 1: Identifying species...");

    // Compress the image
    const compressedBlob = await compressImage(imageFile);
    const imageDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(compressedBlob);
    });

    // Step A: Plant.id vision API
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

    // Step B & C: Only if confidence > 80%
    if (topResult.confidence >= 80 && topResult.scientificName) {
      report(2, "Step 2: Retrieving expert care guides...");

      // Check local cache first
      const cached = await getSpeciesCache(topResult.scientificName);
      if (cached) {
        species = cached.speciesData;
        careGuide = cached.careGuideData;
      } else {
        // Query Perenual
        species = await callPerenualSpecies(topResult.scientificName, userId);

        if (species) {
          // Step C: Care guide
          careGuide = await callPerenualCareGuide(species.id, userId);
        }

        // Cache everything
        if (species) {
          const entry: SpeciesCacheEntry = {
            scientificName: topResult.scientificName,
            speciesData: species,
            careGuideData: careGuide,
            cachedAt: new Date().toISOString(),
          };
          await setSpeciesCache(entry).catch(() => {});
        }
      }

      report(3, "Step 3: Setting up your care schedule...");

      careSchedules = parseCareSchedules(careGuide, species);
      sunlightNeeds = parseSunlightNeeds(species);

      // Check inventory for fertilizers
      const fertilizerNames = extractFertilizerNames(careGuide);
      const inventory = await getInventoryForUser(userId ?? "");
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
        thumbnailUrl: topResult.imageUrl,
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
   * Search Perenual by manual name input (fallback when identification fails).
   */
  async searchByName(
    query: string,
    userId?: string
  ): Promise<IdentifiedPlant[]> {
    const apiKey = await getPerenualKey(userId);
    if (!apiKey) {
      throw new Error("Perenual API key not configured.");
    }

    const url = `https://perenual.com/api/species-list?key=${apiKey}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Perenual search failed (${res.status})`);
    }

    const data = await res.json();
    if (!data?.data) return [];

    return data.data.map((s: PerenualSpecies) => ({
      name: s.common_name || s.scientific_name?.[0] || "Unknown",
      scientificName:
        s.scientific_name?.[0] || s.common_name || "Unknown",
      confidence: 0,
      thumbnailUrl: s.default_image?.medium_url || undefined,
    }));
  },

  /**
   * Fetch care guide for a given scientific name (used after manual selection).
   */
  async fetchCareData(
    scientificName: string,
    userId?: string
  ): Promise<{
    careSchedules: CareScheduleSuggestion[];
    fertilizers: FertilizerSuggestion[];
    sunlightNeeds: string[];
  }> {
    // Check cache
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
        setSpeciesCache({
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
    const inventory = await getInventoryForUser(userId ?? "");
    const fertilizers = fertilizerNames.map((name) => ({
      name,
      inStock: inventory.some(
        (i) =>
          i.category === "supply" &&
          name.toLowerCase().includes(i.name.toLowerCase())
      ),
    }));

    return { careSchedules, fertilizers, sunlightNeeds };
  },
};
