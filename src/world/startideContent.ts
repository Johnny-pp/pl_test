import { TILE_SIZE } from "./worldMap.ts";
import { STARTIDE_REGION, type WorldRegion } from "./regions.ts";
import type { WorldZone } from "./encounters.ts";

export interface StartideDiscovery {
  id: string;
  x: number;
  y: number;
  label: string;
  /** 发现该地点会清除孢雾的规避信标 */
  clearsSpore?: boolean;
}

export interface StartideChest {
  id: string;
  x: number;
  y: number;
  label: string;
  rewards: {
    resources?: Partial<Record<"wood" | "stone" | "food" | "fiber" | "crystal", number>>;
    captureOrbs?: number;
    healingTonics?: number;
    equipment?: string[];
  };
}

export interface StartideWaypoint {
  id: string;
  x: number;
  y: number;
  label: string;
  targetX: number;
  targetY: number;
}

export interface StartideRareSpawn {
  x: number;
  y: number;
  speciesId: number;
  levelBonus: number;
  label: string;
}

export const STARTIDE_DISCOVERIES: StartideDiscovery[] = [
  { id: "startide-discovery-haven", x: 8 * TILE_SIZE, y: 6 * TILE_SIZE, label: "芦灯港引灯" },
  { id: "startide-discovery-mire", x: 20 * TILE_SIZE, y: 9 * TILE_SIZE, label: "辉沼潮位碑" },
  {
    id: "startide-discovery-observatory",
    x: 31 * TILE_SIZE,
    y: 8 * TILE_SIZE,
    label: "沉星观测台",
    clearsSpore: true,
  },
  { id: "startide-discovery-reef", x: 34 * TILE_SIZE, y: 20 * TILE_SIZE, label: "退潮礁径" },
];

export const STARTIDE_CHESTS: StartideChest[] = [
  {
    id: "startide-chest-haven",
    x: 6 * TILE_SIZE,
    y: 14 * TILE_SIZE,
    label: "潮居宝箱",
    rewards: { resources: { food: 15, crystal: 5 } },
  },
  {
    id: "startide-chest-mire",
    x: 23 * TILE_SIZE,
    y: 22 * TILE_SIZE,
    label: "沼底宝箱",
    rewards: { captureOrbs: 2, healingTonics: 2 },
  },
  {
    id: "startide-chest-observatory",
    x: 36 * TILE_SIZE,
    y: 6 * TILE_SIZE,
    label: "沉星宝箱",
    rewards: { resources: { crystal: 8, fiber: 20 }, equipment: ["armor-solar-carapace"] },
  },
];

export const STARTIDE_WAYPOINTS: StartideWaypoint[] = [
  {
    id: "startide-waypoint-core",
    x: 32 * TILE_SIZE,
    y: 21 * TILE_SIZE,
    label: "星潮回波点",
    targetX: 3.8 * TILE_SIZE,
    targetY: 14.5 * TILE_SIZE,
  },
];

export const STARTIDE_RARE_SPAWN: StartideRareSpawn = {
  x: 26 * TILE_SIZE,
  y: 6 * TILE_SIZE,
  speciesId: 50,
  levelBonus: 4,
  label: "渊潮裂隙（稀有刷新点）",
};

export const STARTIDE_BOSS_ALTARS: Record<string, { x: number; y: number }> = {
  tidewarden: { x: 28 * TILE_SIZE, y: 6 * TILE_SIZE },
  "mire-sovereign": { x: 34 * TILE_SIZE, y: 19 * TILE_SIZE },
  "abyssal-colossus": { x: 36 * TILE_SIZE, y: 12 * TILE_SIZE },
};

export type TidePhase = "ebb" | "flood";

export function getTidePhase(hour: number): TidePhase {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  return normalized >= 6 && normalized < 18 ? "ebb" : "flood";
}

/** 沉星遗迹的孢雾在涨潮（夜晚）时最为浓密，需要规避信标或退潮时段才能安全深入。 */
export function isSporeActive(zone: WorldZone, period: "day" | "night"): boolean {
  if (zone !== "sunken-observatory") return false;
  return period === "night";
}

export function isNearSporeBeacon(x: number, y: number, discovered: string[]): boolean {
  if (!discovered.includes("startide-discovery-observatory")) return false;
  const beacon = STARTIDE_DISCOVERIES.find((d) => d.id === "startide-discovery-observatory");
  if (!beacon) return false;
  return Math.hypot(x - beacon.x, y - beacon.y) < 7 * TILE_SIZE;
}

/** 返回当前是否处于危险孢雾中（无规避手段）。发现沉星观测台信标后可全局规避。 */
export function isSporeHazardActive(
  zone: WorldZone,
  period: "day" | "night",
  _x: number,
  _y: number,
  discovered: string[]
): boolean {
  if (!isSporeActive(zone, period)) return false;
  return !discovered.includes("startide-discovery-observatory");
}

/** 区域迷雾扇区：以 4 个象限划分，访问后揭示。 */
export const STARTIDE_FOG_SECTORS = [
  { id: "startide-sector-haven", xMin: 0, xMax: 13, yMin: 0, yMax: 28, label: "芦灯港" },
  { id: "startide-sector-mire", xMin: 13, xMax: 27, yMin: 0, yMax: 28, label: "辉沼湿地" },
  { id: "startide-sector-observatory", xMin: 27, xMax: 40, yMin: 0, yMax: 28, label: "沉星遗迹" },
  { id: "startide-sector-reef", xMin: 0, xMax: 40, yMin: 0, yMax: 14, label: "退潮礁线" },
] as const;

export function getFogSectorAtTile(tileX: number, tileY: number): string | undefined {
  if (tileY < 14) {
    return tileX < 27 ? "startide-sector-mire" : "startide-sector-observatory";
  }
  if (tileX < 13) return "startide-sector-haven";
  if (tileX < 27) return "startide-sector-mire";
  return "startide-sector-observatory";
}

export function startideExplorationCompletion(
  discovered: string[],
  chests: string[],
  waypoints: string[],
  sectors: string[]
): number {
  const total =
    STARTIDE_DISCOVERIES.length +
    STARTIDE_CHESTS.length +
    STARTIDE_WAYPOINTS.length +
    STARTIDE_FOG_SECTORS.length;
  const done =
    new Set(discovered).size + new Set(chests).size + new Set(waypoints).size + new Set(sectors).size;
  if (total === 0) return 0;
  return Math.min(100, Math.round((Math.min(done, total) / total) * 100));
}

export function isStartideRegion(region: WorldRegion): boolean {
  return region === STARTIDE_REGION;
}
