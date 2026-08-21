import type { Pal } from "../types/pal";
import type { BaseJob, FacilityId, GameSave } from "../player/playerState";
import { getBuildBonuses, getSpeciesSkillTree } from "../build/buildSystem.ts";
import { getPlacedFacility } from "./baseLayout.ts";
import { getTechBonuses } from "./techTree.ts";
import type { ActiveSkill } from "../types/activeSkill.ts";
import type { PassiveSkill } from "../types/passiveSkill.ts";
import type { EquipmentDefinition } from "../types/skillTree.ts";

export interface ProductionBuildDeps {
  activeSkills?: ReadonlyMap<string, ActiveSkill>;
  passiveSkills?: ReadonlyMap<string, PassiveSkill>;
  equipment?: ReadonlyMap<string, EquipmentDefinition>;
}

const EMPTY_DEPS: ProductionBuildDeps = {};

export type ResourceId = keyof GameSave["base"]["resources"];
export type CraftableItem = "capture-orb" | "healing-tonic";

export const JOB_RESOURCE: Record<BaseJob, ResourceId> = {
  planting: "food",
  mining: "stone",
  lumbering: "wood",
  generating: "crystal",
};

export const CRAFT_RECIPES: Record<CraftableItem, Partial<Record<ResourceId, number>>> = {
  "capture-orb": { wood: 8, fiber: 6, crystal: 2 },
  "healing-tonic": { food: 10, fiber: 4 },
};

const FACILITY_COSTS: Record<FacilityId, Partial<Record<ResourceId, number>>> = {
  warehouse: { wood: 30, stone: 20 },
  farm: { wood: 25, fiber: 20 },
  workshop: { stone: 30, crystal: 8 },
  forge: { stone: 40, ore: 15, crystal: 8 },
  assembly: { metal: 8, stone: 30, crystal: 6 },
};

export function getFacilityLevel(save: GameSave, facility: FacilityId): number {
  return getPlacedFacility(save, facility)?.level ?? save.base.facilities[facility] ?? 0;
}

export function getStorageCapacity(save: GameSave): number {
  const tech = getTechBonuses(save);
  return Math.floor((100 + getFacilityLevel(save, "warehouse") * 100) * tech.capacityMultiplier);
}

function suitabilityLevel(pal: Pal, job: BaseJob): number {
  const accepted = job === "generating" ? new Set(["generating", "electricity"]) : new Set([job]);
  return pal.workSuitability.find((work) => accepted.has(work.type))?.level ?? 0;
}

export function assignWorker(
  save: GameSave,
  palUid: string,
  job: BaseJob,
  speciesById: ReadonlyMap<number, Pal>
): GameSave {
  const instance = save.ownedPals.find((pal) => pal.uid === palUid);
  const species = instance ? speciesById.get(instance.speciesId) : undefined;
  if (!species || suitabilityLevel(species, job) <= 0) return save;
  return {
    ...save,
    base: {
      ...save.base,
      assignments: [
        ...save.base.assignments.filter((assignment) => assignment.palUid !== palUid),
        { palUid, job },
      ],
    },
  };
}

export function removeWorker(save: GameSave, palUid: string): GameSave {
  if (!save.base.assignments.some((assignment) => assignment.palUid === palUid)) return save;
  return {
    ...save,
    base: {
      ...save.base,
      assignments: save.base.assignments.filter((assignment) => assignment.palUid !== palUid),
    },
  };
}

export function simulateProduction(
  save: GameSave,
  speciesById: ReadonlyMap<number, Pal>,
  now = Date.now(),
  deps: ProductionBuildDeps = EMPTY_DEPS
): GameSave {
  const elapsedMinutes = Math.max(0, Math.min(480, (now - save.base.lastUpdatedAt) / 60_000));
  const resources = { ...save.base.resources };
  const capacity = getStorageCapacity(save);
  const tech = getTechBonuses(save);
  const techWork = 1 + tech.workSpeedPercent / 100;
  const techYield = 1 + tech.resourceYieldPercent / 100;
  for (const assignment of save.base.assignments) {
    const instance = save.ownedPals.find((pal) => pal.uid === assignment.palUid);
    const species = instance ? speciesById.get(instance.speciesId) : undefined;
    if (!instance || !species) continue;
    const level = suitabilityLevel(species, assignment.job);
    if (level <= 0) continue;
    const facility =
      assignment.job === "planting"
        ? "farm"
        : assignment.job === "mining"
          ? "workshop"
          : assignment.job === "lumbering"
            ? "workshop"
            : "workshop";
    const facilityLevel = getFacilityLevel(save, facility);
    const facilityMultiplier = 1 + (facilityLevel - 1) * 0.15;
    const tree = getSpeciesSkillTree(
      species,
      deps.activeSkills ?? new Map(),
      deps.passiveSkills ?? new Map()
    );
    const build = getBuildBonuses(save, instance, species, tree, deps.equipment ?? new Map(), {
      hour: new Date(now).getHours(),
    });
    const workSpeedPercent = build.percent.workSpeedPercent;
    const resourceYieldPercent = build.percent.resourceYieldPercent;
    const passiveMultiplier = 1 + workSpeedPercent / 100;
    const yieldMultiplier = 1 + resourceYieldPercent / 100;
    const ratePerMinute =
      level *
      (species.stats.workSpeed / 100) *
      facilityMultiplier *
      passiveMultiplier *
      yieldMultiplier *
      techWork *
      techYield *
      0.25;
    const resource = JOB_RESOURCE[assignment.job];
    resources[resource] = Math.min(capacity, resources[resource] + ratePerMinute * elapsedMinutes);
    if (assignment.job === "mining") {
      const oreRate = level * 0.08 * facilityMultiplier * yieldMultiplier * techYield;
      resources.ore = Math.min(capacity, resources.ore + oreRate * elapsedMinutes);
    }
  }
  for (const resource of Object.keys(resources) as ResourceId[]) {
    resources[resource] = Math.floor(resources[resource] * 10) / 10;
  }
  return { ...save, base: { ...save.base, resources, lastUpdatedAt: now } };
}

function canPay(
  resources: GameSave["base"]["resources"],
  costs: Partial<Record<ResourceId, number>>
): boolean {
  return Object.entries(costs).every(([resource, cost]) => resources[resource as ResourceId] >= (cost ?? 0));
}

function pay(resources: GameSave["base"]["resources"], costs: Partial<Record<ResourceId, number>>) {
  const next = { ...resources };
  for (const [resource, cost] of Object.entries(costs)) next[resource as ResourceId] -= cost ?? 0;
  return next;
}

export function upgradeFacility(save: GameSave, facility: FacilityId): GameSave {
  const level = getFacilityLevel(save, facility);
  if (level >= 5) return save;
  const costs = Object.fromEntries(
    Object.entries(FACILITY_COSTS[facility]).map(([resource, amount]) => [resource, (amount ?? 0) * level])
  ) as Partial<Record<ResourceId, number>>;
  if (!canPay(save.base.resources, costs)) return save;
  return {
    ...save,
    base: {
      ...save.base,
      resources: pay(save.base.resources, costs),
      facilities: { ...save.base.facilities, [facility]: level + 1 },
      placedFacilities: save.base.placedFacilities.map((entry) =>
        entry.facilityId === facility ? { ...entry, level: level + 1 } : entry
      ),
    },
  };
}

export function craftItem(save: GameSave, item: CraftableItem): GameSave {
  const recipe = CRAFT_RECIPES[item];
  if (!canPay(save.base.resources, recipe)) return save;
  return {
    ...save,
    base: { ...save.base, resources: pay(save.base.resources, recipe) },
    inventory: {
      ...save.inventory,
      captureOrbs: save.inventory.captureOrbs + (item === "capture-orb" ? 1 : 0),
      healingTonics: save.inventory.healingTonics + (item === "healing-tonic" ? 1 : 0),
    },
  };
}

export function consumeCaptureOrb(save: GameSave): { save: GameSave; consumed: boolean } {
  if (save.inventory.captureOrbs <= 0) return { save, consumed: false };
  return {
    consumed: true,
    save: { ...save, inventory: { ...save.inventory, captureOrbs: save.inventory.captureOrbs - 1 } },
  };
}

/** 按捕获器种类消耗一个捕获器（普通或高级）。 */
export function consumeCaptureOrbByKind(
  save: GameSave,
  kind: "advanced" | "normal"
): { save: GameSave; consumed: boolean } {
  if (kind === "advanced") {
    if (save.inventory.advancedCaptureOrbs <= 0) return { save, consumed: false };
    return {
      consumed: true,
      save: {
        ...save,
        inventory: { ...save.inventory, advancedCaptureOrbs: save.inventory.advancedCaptureOrbs - 1 },
      },
    };
  }
  return consumeCaptureOrb(save);
}

export function useHealingTonic(save: GameSave, palUid: string, maxHp: number): GameSave {
  if (save.inventory.healingTonics <= 0) return save;
  const index = save.ownedPals.findIndex((pal) => pal.uid === palUid);
  if (index < 0 || save.ownedPals[index].currentHp >= maxHp) return save;
  const ownedPals = save.ownedPals.map((pal, current) =>
    current === index ? { ...pal, currentHp: maxHp } : pal
  );
  return {
    ...save,
    ownedPals,
    inventory: { ...save.inventory, healingTonics: save.inventory.healingTonics - 1 },
  };
}
