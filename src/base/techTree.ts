import type { FacilityId, GameSave } from "../player/playerState.ts";
import type { WorldRegion } from "../world/regions.ts";
import { canPayResources, payResources } from "./baseLayout.ts";

export interface TechRequirement {
  techIds?: string[];
  facilityLevels?: Partial<Record<FacilityId, number>>;
  regionUnlocked?: WorldRegion;
  bossDefeated?: string;
}

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: Partial<Record<"wood" | "stone" | "food" | "fiber" | "crystal" | "ore" | "metal", number>>;
  requires: TechRequirement;
}

export const TECH_TREE: TechNode[] = [
  {
    id: "tech-smelting",
    name: "冶炼",
    description: "解锁熔炉，可用矿石与晶体熔炼金属锭，并开启熔炉工位加工。",
    cost: { stone: 40, ore: 15, crystal: 8 },
    requires: { facilityLevels: { workshop: 2 } },
  },
  {
    id: "tech-assembly",
    name: "装配",
    description: "解锁装配台，用金属锭制造高级捕获器与强化装备。",
    cost: { metal: 8, stone: 30, crystal: 10 },
    requires: { techIds: ["tech-smelting"], regionUnlocked: "startide-archipelago" },
  },
  {
    id: "tech-logistics",
    name: "物流",
    description: "工作与产量提升 10%。",
    cost: { wood: 40, stone: 30 },
    requires: { facilityLevels: { workshop: 2 } },
  },
  {
    id: "tech-refining",
    name: "精炼",
    description: "熔炉熔炼金属锭的资源消耗降低 20%。",
    cost: { crystal: 12, metal: 4 },
    requires: { techIds: ["tech-smelting"] },
  },
  {
    id: "tech-foundation",
    name: "地基",
    description: "仓库容量提升 25%。",
    cost: { wood: 50, stone: 40 },
    requires: { facilityLevels: { warehouse: 2 } },
  },
];

export function isTechUnlocked(save: GameSave, techId: string): boolean {
  return save.base.techIds.includes(techId);
}

export function canUnlockTech(save: GameSave, tech: TechNode): boolean {
  if (isTechUnlocked(save, tech.id)) return false;
  if (!techRequirementMet(save, tech.requires)) return false;
  return canPayResources(save.base.resources, tech.cost);
}

export function techRequirementMet(save: GameSave, req: TechRequirement): boolean {
  if (req.techIds && !req.techIds.every((id) => isTechUnlocked(save, id))) return false;
  if (req.facilityLevels) {
    for (const [facility, level] of Object.entries(req.facilityLevels)) {
      const placed = save.base.placedFacilities.find((entry) => entry.facilityId === facility);
      if (!placed || placed.level < (level ?? 0)) return false;
    }
  }
  if (req.regionUnlocked && !save.progress.unlockedRegions.includes(req.regionUnlocked)) return false;
  if (req.bossDefeated && !save.progress.defeatedBossIds.includes(req.bossDefeated)) return false;
  return true;
}

export function unlockTech(save: GameSave, techId: string): GameSave {
  const tech = TECH_TREE.find((node) => node.id === techId);
  if (!tech || !canUnlockTech(save, tech)) return save;
  return {
    ...save,
    base: {
      ...save.base,
      resources: payResources(save.base.resources, tech.cost),
      techIds: [...save.base.techIds, tech.id],
    },
  };
}

export interface TechBonuses {
  workSpeedPercent: number;
  resourceYieldPercent: number;
  /** 熔炉熔炼金属锭的成本系数（1 = 无折扣）。 */
  metalCostFactor: number;
  /** 仓库容量倍数。 */
  capacityMultiplier: number;
}

export function getTechBonuses(save: GameSave): TechBonuses {
  const bonuses: TechBonuses = {
    workSpeedPercent: 0,
    resourceYieldPercent: 0,
    metalCostFactor: 1,
    capacityMultiplier: 1,
  };
  if (isTechUnlocked(save, "tech-logistics")) {
    bonuses.workSpeedPercent += 10;
    bonuses.resourceYieldPercent += 10;
  }
  if (isTechUnlocked(save, "tech-refining")) bonuses.metalCostFactor = 0.8;
  if (isTechUnlocked(save, "tech-foundation")) bonuses.capacityMultiplier = 1.25;
  return bonuses;
}
