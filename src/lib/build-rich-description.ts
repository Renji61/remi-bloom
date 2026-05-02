import type { IdentificationResult } from "@/lib/identification-manager";

const SECTION_EMOJI: Record<string, string> = {
  watering: "💧",
  sunlight: "☀️",
  pruning: "✂️",
  propagation: "🌱",
  fertilization: "🧪",
  hardiness: "🌡️",
  soil: "🪴",
  growth_conditions: "📈",
  maintenance: "🔧",
};

const WATER_SECTION_TYPES = new Set(["watering", "sunlight"]);
const MAINTENANCE_SECTION_TYPES = new Set(["pruning", "propagation", "fertilization"]);
const GROWTH_SECTION_TYPES = new Set(["hardiness", "soil", "growth_conditions"]);

/**
 * Build a comprehensive, well-formatted description from the Perenual care guide
 * raw section data. Falls back to the simpler auto-generated description when no
 * care guide sections are available.
 */
export function buildRichDescription(identificationResult: IdentificationResult): string {
  const guide = identificationResult.careGuideRaw;
  const sections = guide?.section ?? [];

  if (sections.length === 0) {
    // Fall back to current behavior
    const careLines: string[] = [];
    if (identificationResult.sunlightNeeds.length > 0) {
      careLines.push(`☀️ Light: ${identificationResult.sunlightNeeds.join(", ")}`);
    }
    for (const cs of identificationResult.careSchedules) {
      const freq = cs.frequencyDays === 1 ? "every day" : `every ${cs.frequencyDays} days`;
      careLines.push(`${cs.label}: ${freq}`);
    }
    if (identificationResult.fertilizers.length > 0) {
      careLines.push(`🧪 Recommended fertilizer: ${identificationResult.fertilizers.map((f) => f.name).join(", ")}`);
    }
    return careLines.length > 0
      ? careLines.join("\n")
      : `🌿 ${identificationResult.species.name || identificationResult.species.scientificName || "Plant"}`;
  }

  const waterLines: string[] = [];
  const maintenanceLines: string[] = [];
  const growthLines: string[] = [];
  const otherLines: string[] = [];

  for (const section of sections) {
    const desc = section.description?.trim();
    if (!desc) continue;

    const type = section.type;
    const emoji = SECTION_EMOJI[type] || "•";
    const sentence = `${emoji} ${desc.replace(/\.$/, "")}.`;

    if (WATER_SECTION_TYPES.has(type)) {
      waterLines.push(sentence);
    } else if (MAINTENANCE_SECTION_TYPES.has(type)) {
      maintenanceLines.push(sentence);
    } else if (GROWTH_SECTION_TYPES.has(type)) {
      growthLines.push(sentence);
    } else {
      otherLines.push(sentence);
    }
  }

  const parts: string[] = [];

  // Watering & Sunlight (always first)
  if (waterLines.length > 0) {
    parts.push(waterLines.join("\n"));
  }

  // Growth Specs
  if (growthLines.length > 0) {
    parts.push(growthLines.join("\n"));
  }

  // Maintenance
  if (maintenanceLines.length > 0) {
    parts.push(maintenanceLines.join("\n"));
  }

  // Any other sections
  if (otherLines.length > 0) {
    parts.push(otherLines.join("\n"));
  }

  return parts.join("\n\n");
}
