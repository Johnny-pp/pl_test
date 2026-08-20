import type { CombatantBuildInput } from "../battle/battleEngine.ts";
import type { GameSave, PalInstance } from "../player/playerState.ts";
import type { Pal } from "../types/pal.ts";
import type { ActiveSkill } from "../types/activeSkill.ts";
import type { PassiveSkill } from "../types/passiveSkill.ts";
import type { EquipmentDefinition } from "../types/skillTree.ts";
import {
  getBuildBonuses,
  getEquippedSkillIds,
  getFinalBuildStats,
  getSpeciesSkillTree,
} from "./buildSystem.ts";

export interface BuildDeps {
  activeSkills: ReadonlyMap<string, ActiveSkill>;
  passiveSkills: ReadonlyMap<string, PassiveSkill>;
  equipment: ReadonlyMap<string, EquipmentDefinition>;
}

/**
 * Builds a battle snapshot for a player-owned individual, combining the species
 * base stats, level growth, skill tree attribute nodes, equipped skills,
 * random passives and equipped equipment.
 */
export function createInstanceBuildSnapshot(
  save: GameSave,
  pal: Pal,
  instance: PalInstance,
  deps: BuildDeps
): CombatantBuildInput {
  const tree = getSpeciesSkillTree(pal, deps.activeSkills, deps.passiveSkills);
  const finalStats = getFinalBuildStats(pal, instance, tree, deps.equipment, save);
  const { percent } = getBuildBonuses(save, instance, pal, tree, deps.equipment);
  const skillIds = getEquippedSkillIds(pal, instance, tree);
  const passiveIds = [...new Set(instance.passiveSkillIds ?? [])];
  return {
    skillIds,
    stats: {
      maxHp: finalStats.maxHp,
      attack: finalStats.attack,
      defense: finalStats.defense,
      speed: finalStats.moveSpeed,
      workSpeed: finalStats.workSpeed,
    },
    bonuses: {
      attackPercent: percent.attackPercent,
      defensePercent: percent.defensePercent,
      speedPercent: percent.speedPercent,
      damageTakenPercent: percent.damageTakenPercent,
      energyCostPercent: percent.energyCostPercent,
      workSpeedPercent: percent.workSpeedPercent,
      resourceYieldPercent: percent.resourceYieldPercent,
      elementDamagePercent: percent.elementDamagePercent,
      elementResistancePercent: percent.elementResistancePercent,
    },
    passiveSkillIds: passiveIds,
  };
}

/** Describes what each part of a build contributes, and why some effects are inactive. */
export function describeBuildSources(instance: PalInstance): string[] {
  const sources: string[] = [];
  const passiveCount = (instance.passiveSkillIds ?? []).length;
  const nodeCount = (instance.unlockedNodeIds ?? []).length;
  const equippedCount = (instance.equippedSkillIds ?? []).length;
  const equipmentCount = Object.keys(instance.equipment ?? {}).length;
  if (passiveCount > 0) sources.push(`随机被动 ${passiveCount} 个`);
  if (nodeCount > 0) sources.push(`技能树节点 ${nodeCount} 个`);
  if (equippedCount > 0) sources.push(`已装备主动技能 ${equippedCount} 个`);
  if (equipmentCount > 0) sources.push(`已穿戴装备 ${equipmentCount} 件`);
  if (sources.length === 0) sources.push("尚未配置构筑");
  return sources;
}
