import type { FacilityId, GameSave, PlacedFacility } from "../player/playerState.ts";

export const GRID_COLS = 6;
export const GRID_ROWS = 4;

export interface FacilityDefinition {
  id: FacilityId;
  label: string;
  /** 网格占地（宽 x 高），单位为格子。 */
  width: number;
  height: number;
  /** 放置/建造所需资源成本。 */
  buildCost: Partial<Record<"wood" | "stone" | "food" | "fiber" | "crystal" | "ore" | "metal", number>>;
  /** 需要解锁的科技节点，未解锁则无法放置。 */
  requiredTech?: string;
  /** 描述。 */
  description: string;
}

export const FACILITY_DEFS: Record<FacilityId, FacilityDefinition> = {
  warehouse: {
    id: "warehouse",
    label: "仓库",
    width: 2,
    height: 2,
    buildCost: { wood: 20, stone: 15 },
    description: "提升资源仓储容量。",
  },
  farm: {
    id: "farm",
    label: "农圃",
    width: 2,
    height: 1,
    buildCost: { wood: 18, fiber: 15 },
    description: "种植岗位的生产设施。",
  },
  workshop: {
    id: "workshop",
    label: "工坊",
    width: 1,
    height: 2,
    buildCost: { stone: 20, fiber: 10 },
    description: "采矿与伐木岗位的生产设施。",
  },
  forge: {
    id: "forge",
    label: "熔炉",
    width: 2,
    height: 2,
    buildCost: { stone: 30, ore: 10, crystal: 5 },
    requiredTech: "tech-smelting",
    description: "把矿石与晶体熔炼为金属锭。",
  },
  assembly: {
    id: "assembly",
    label: "装配台",
    width: 2,
    height: 2,
    buildCost: { metal: 8, stone: 20, crystal: 6 },
    requiredTech: "tech-assembly",
    description: "把金属锭制造成高级捕获器与强化装备。",
  },
};

export const ALL_FACILITY_IDS = Object.keys(FACILITY_DEFS) as FacilityId[];

export function getPlacedFacility(save: GameSave, facilityId: FacilityId): PlacedFacility | undefined {
  return save.base.placedFacilities.find((entry) => entry.facilityId === facilityId);
}

export function canPlaceFacility(
  save: GameSave,
  facilityId: FacilityId,
  gridX: number,
  gridY: number,
  gridCols = GRID_COLS,
  gridRows = GRID_ROWS
): boolean {
  const def = FACILITY_DEFS[facilityId];
  if (def.requiredTech && !save.base.techIds.includes(def.requiredTech)) return false;
  if (gridX < 0 || gridY < 0 || gridX + def.width > gridCols || gridY + def.height > gridRows) return false;
  if (getPlacedFacility(save, facilityId)) return false;
  return !save.base.placedFacilities.some((entry) =>
    rectsOverlap(
      gridX,
      gridY,
      def.width,
      def.height,
      entry.gridX,
      entry.gridY,
      FACILITY_DEFS[entry.facilityId].width,
      FACILITY_DEFS[entry.facilityId].height
    )
  );
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export interface PlacementResult {
  save: GameSave;
  ok: boolean;
  reason?: string;
}

export function placeFacility(
  save: GameSave,
  facilityId: FacilityId,
  gridX: number,
  gridY: number
): PlacementResult {
  const def = FACILITY_DEFS[facilityId];
  if (getPlacedFacility(save, facilityId)) return { save, ok: false, reason: "该设施已经放置" };
  if (!canPlaceFacility(save, facilityId, gridX, gridY))
    return { save, ok: false, reason: "位置被占用或超出网格/未解锁" };
  if (!canPayResources(save.base.resources, def.buildCost))
    return { save, ok: false, reason: "建造资源不足" };
  return {
    save: {
      ...save,
      base: {
        ...save.base,
        resources: payResources(save.base.resources, def.buildCost),
        placedFacilities: [...save.base.placedFacilities, { facilityId, level: 1, gridX, gridY }],
      },
    },
    ok: true,
  };
}

export function moveFacility(
  save: GameSave,
  facilityId: FacilityId,
  gridX: number,
  gridY: number
): PlacementResult {
  const current = getPlacedFacility(save, facilityId);
  if (!current) return { save, ok: false, reason: "设施不存在" };
  if (current.gridX === gridX && current.gridY === gridY) return { save, ok: false, reason: "位置未变化" };
  const removed: GameSave = {
    ...save,
    base: {
      ...save.base,
      placedFacilities: save.base.placedFacilities.filter((entry) => entry.facilityId !== facilityId),
    },
  };
  if (!canPlaceFacility(removed, facilityId, gridX, gridY))
    return { save, ok: false, reason: "目标位置被占用或超出网格" };
  return {
    save: {
      ...save,
      base: {
        ...save.base,
        placedFacilities: save.base.placedFacilities.map((entry) =>
          entry.facilityId === facilityId ? { ...entry, gridX, gridY } : entry
        ),
      },
    },
    ok: true,
  };
}

export function removeFacility(save: GameSave, facilityId: FacilityId): GameSave {
  if (!getPlacedFacility(save, facilityId)) return save;
  return {
    ...save,
    base: {
      ...save.base,
      placedFacilities: save.base.placedFacilities.filter((entry) => entry.facilityId !== facilityId),
    },
  };
}

/** 返回所有相邻（共享一条边）的设施对。 */
export function getAdjacentFacilityPairs(save: GameSave): [FacilityId, FacilityId][] {
  const placed = save.base.placedFacilities;
  const pairs: [FacilityId, FacilityId][] = [];
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      if (facilitiesAdjacent(a, b, FACILITY_DEFS[a.facilityId], FACILITY_DEFS[b.facilityId]))
        pairs.push([a.facilityId, b.facilityId]);
    }
  }
  return pairs;
}

function facilitiesAdjacent(
  a: PlacedFacility,
  b: PlacedFacility,
  ad: FacilityDefinition,
  bd: FacilityDefinition
): boolean {
  const ax1 = a.gridX;
  const ay1 = a.gridY;
  const ax2 = a.gridX + ad.width;
  const ay2 = a.gridY + ad.height;
  const bx1 = b.gridX;
  const by1 = b.gridY;
  const bx2 = b.gridX + bd.width;
  const by2 = b.gridY + bd.height;
  const edgeTouchX = ax2 === bx1 || bx2 === ax1;
  const overlapY = ay1 < by2 && by1 < ay2;
  const edgeTouchY = ay2 === by1 || by2 === ay1;
  const overlapX = ax1 < bx2 && bx1 < ax2;
  return (edgeTouchX && overlapY) || (edgeTouchY && overlapX);
}

export function canPayResources(
  resources: GameSave["base"]["resources"],
  costs: Partial<GameSave["base"]["resources"]>
): boolean {
  return Object.entries(costs).every(
    ([resource, cost]) => resources[resource as keyof typeof resources] >= (cost ?? 0)
  );
}

export function payResources(
  resources: GameSave["base"]["resources"],
  costs: Partial<GameSave["base"]["resources"]>
): GameSave["base"]["resources"] {
  const next = { ...resources };
  for (const [resource, cost] of Object.entries(costs)) next[resource as keyof typeof resources] -= cost ?? 0;
  return next;
}
