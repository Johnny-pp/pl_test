export type WorldZone = "sunlit-meadow" | "echo-ruins";
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
};

export function getTimePeriod(hour: number): TimePeriod {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  return normalized >= 6 && normalized < 18 ? "day" : "night";
}

export function getZoneAtTile(tileX: number): WorldZone {
  return tileX < 20 ? "sunlit-meadow" : "echo-ruins";
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
