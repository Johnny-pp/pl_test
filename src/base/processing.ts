import type { GameSave } from "../player/playerState.ts";
import { getFacilityLevel } from "./baseSystem.ts";
import { canPayResources, payResources } from "./baseLayout.ts";
import { getTechBonuses, isTechUnlocked } from "./techTree.ts";
import type { ResourceId } from "./baseSystem.ts";

/** 熔炉熔炼金属锭的基础成本。 */
export const SMELT_BASE_COST: Partial<Record<ResourceId, number>> = {
  stone: 20,
  ore: 10,
  crystal: 3,
};

/** 装配台制造高级捕获器的成本。 */
export const ASSEMBLE_ORB_COST: Partial<Record<ResourceId, number>> = {
  metal: 2,
  crystal: 2,
};

/** 装配台制造强化装备的成本。 */
export const ASSEMBLE_EQUIPMENT_COST: Partial<Record<ResourceId, number>> = {
  metal: 3,
  fiber: 12,
};

export const ASSEMBLE_EQUIPMENT_ID = "armor-reinforced-mail";

function smeltCost(save: GameSave): Partial<Record<ResourceId, number>> {
  const factor = getTechBonuses(save).metalCostFactor;
  return Object.fromEntries(
    Object.entries(SMELT_BASE_COST).map(([resource, amount]) => [
      resource,
      Math.max(1, Math.floor((amount ?? 0) * factor)),
    ])
  ) as Partial<Record<ResourceId, number>>;
}

export function canSmelt(save: GameSave): boolean {
  if (!isTechUnlocked(save, "tech-smelting")) return false;
  if (getFacilityLevel(save, "forge") <= 0) return false;
  return canPayResources(save.base.resources, smeltCost(save));
}

export function smeltMetal(save: GameSave): GameSave {
  if (!canSmelt(save)) return save;
  return {
    ...save,
    base: {
      ...save.base,
      resources: {
        ...payResources(save.base.resources, smeltCost(save)),
        metal: save.base.resources.metal + 1,
      },
    },
  };
}

export function canAssembleOrb(save: GameSave): boolean {
  if (!isTechUnlocked(save, "tech-assembly")) return false;
  if (getFacilityLevel(save, "assembly") <= 0) return false;
  return canPayResources(save.base.resources, ASSEMBLE_ORB_COST);
}

export function assembleAdvancedOrb(save: GameSave): GameSave {
  if (!canAssembleOrb(save)) return save;
  return {
    ...save,
    base: { ...save.base, resources: payResources(save.base.resources, ASSEMBLE_ORB_COST) },
    inventory: {
      ...save.inventory,
      advancedCaptureOrbs: save.inventory.advancedCaptureOrbs + 1,
    },
  };
}

export function canAssembleEquipment(save: GameSave): boolean {
  if (!isTechUnlocked(save, "tech-assembly")) return false;
  if (getFacilityLevel(save, "assembly") <= 0) return false;
  return canPayResources(save.base.resources, ASSEMBLE_EQUIPMENT_COST);
}

export function assembleEquipment(save: GameSave): GameSave {
  if (!canAssembleEquipment(save)) return save;
  const item = { uid: `assembly-${Date.now().toString(36)}`, equipmentId: ASSEMBLE_EQUIPMENT_ID };
  return {
    ...save,
    base: { ...save.base, resources: payResources(save.base.resources, ASSEMBLE_EQUIPMENT_COST) },
    inventory: { ...save.inventory, equipment: [...save.inventory.equipment, item] },
  };
}
