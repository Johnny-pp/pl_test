import { HIGHLAND_REGION, STARTIDE_REGION, type WorldRegion } from "./regions.ts";

export type WorldZone =
  | "sunlit-meadow"
  | "echo-ruins"
  | "mist-terrace"
  | "storm-ridge"
  | "reedlight-haven"
  | "glowmire-wilds"
  | "sunken-observatory";
export type TimePeriod = "day" | "night";

export interface EncounterEntry {
  speciesId: number;
  weight: number;
}

export const ENCOUNTER_TABLES: Record<WorldZone, Record<TimePeriod, EncounterEntry[]>> = {
  "sunlit-meadow": {
    day: [
      { speciesId: 1, weight: 35 },
      { speciesId: 2, weight: 30 },
      { speciesId: 4, weight: 22 },
      { speciesId: 11, weight: 13 },
    ],
    night: [
      { speciesId: 2, weight: 30 },
      { speciesId: 22, weight: 35 },
      { speciesId: 17, weight: 20 },
      { speciesId: 29, weight: 15 },
    ],
  },
  "echo-ruins": {
    day: [
      { speciesId: 15, weight: 30 },
      { speciesId: 23, weight: 25 },
      { speciesId: 28, weight: 25 },
      { speciesId: 26, weight: 20 },
    ],
    night: [
      { speciesId: 22, weight: 35 },
      { speciesId: 26, weight: 28 },
      { speciesId: 29, weight: 22 },
      { speciesId: 30, weight: 15 },
    ],
  },
  "mist-terrace": {
    day: [
      { speciesId: 34, weight: 38 },
      { speciesId: 35, weight: 25 },
      { speciesId: 38, weight: 22 },
      { speciesId: 36, weight: 15 },
    ],
    night: [
      { speciesId: 37, weight: 42 },
      { speciesId: 35, weight: 24 },
      { speciesId: 38, weight: 21 },
      { speciesId: 39, weight: 13 },
    ],
  },
  "storm-ridge": {
    day: [
      { speciesId: 36, weight: 34 },
      { speciesId: 34, weight: 26 },
      { speciesId: 35, weight: 24 },
      { speciesId: 39, weight: 16 },
    ],
    night: [
      { speciesId: 37, weight: 31 },
      { speciesId: 39, weight: 29 },
      { speciesId: 38, weight: 23 },
      { speciesId: 36, weight: 17 },
    ],
  },
  "reedlight-haven": { day: [], night: [] },
  "glowmire-wilds": {
    day: [
      { speciesId: 40, weight: 34 },
      { speciesId: 41, weight: 26 },
      { speciesId: 42, weight: 22 },
      { speciesId: 43, weight: 18 },
    ],
    night: [
      { speciesId: 44, weight: 32 },
      { speciesId: 41, weight: 26 },
      { speciesId: 42, weight: 20 },
      { speciesId: 45, weight: 16 },
    ],
  },
  "sunken-observatory": {
    day: [
      { speciesId: 46, weight: 34 },
      { speciesId: 47, weight: 26 },
      { speciesId: 48, weight: 22 },
      { speciesId: 50, weight: 15 },
    ],
    night: [
      { speciesId: 48, weight: 32 },
      { speciesId: 46, weight: 28 },
      { speciesId: 47, weight: 22 },
      { speciesId: 51, weight: 15 },
    ],
  },
};

export function getTimePeriod(hour: number): TimePeriod {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  return normalized >= 6 && normalized < 18 ? "day" : "night";
}

export function getZoneAtTile(tileX: number, region: WorldRegion = "frontier"): WorldZone {
  if (region === STARTIDE_REGION) {
    if (tileX < 13) return "reedlight-haven";
    return tileX < 27 ? "glowmire-wilds" : "sunken-observatory";
  }
  if (region === HIGHLAND_REGION) return tileX < 20 ? "mist-terrace" : "storm-ridge";
  return tileX < 20 ? "sunlit-meadow" : "echo-ruins";
}

export function getEncounterLevelFloor(zone: WorldZone): number {
  if (zone === "reedlight-haven") return 12;
  if (zone === "glowmire-wilds") return 13;
  if (zone === "sunken-observatory") return 16;
  if (zone === "mist-terrace") return 6;
  if (zone === "storm-ridge") return 9;
  return zone === "echo-ruins" ? 3 : 1;
}

export function pickEncounter(
  zone: WorldZone,
  period: TimePeriod,
  random: () => number = Math.random
): number | undefined {
  const entries = ENCOUNTER_TABLES[zone][period].filter((entry) => entry.weight > 0);
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return undefined;
  let roll = Math.max(0, Math.min(0.999999, random())) * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll < 0) return entry.speciesId;
  }
  return entries[entries.length - 1]?.speciesId;
}
