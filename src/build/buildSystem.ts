import type { ActiveSkill } from "../types/activeSkill.ts";
import type { ElementType, Pal } from "../types/pal.ts";
import type { PassiveSkill } from "../types/passiveSkill.ts";
import type { EquipmentDefinition, EquipmentItem, EquipmentSlot, SkillTreeNode } from "../types/skillTree.ts";
import type { GameSave, PalInstance } from "../player/playerState.ts";
import { MAX_PAL_LEVEL } from "../progression/progression.ts";
import { getPassiveBonuses, type PassiveBonuses } from "../passives/passiveEffects.ts";

export const MAX_EQUIPPED_SKILLS = 4;
export const ACTIVE_NODE_COST = 7;
export const PASSIVE_NODE_COST = 10;
export const RESET_BASE_COST = 2;
export const RESET_COST_PER_10_LEVELS = 2;

const ROOT_COST = 3;
const SECONDARY_COST = 4;

const ATTRIBUTE_NODES: SkillTreeNode[] = [
  {
    id: "attr-power",
    type: "attribute",
    name: { zh: "强攻", en: "Power" },
    description: "攻击 +6",
    cost: ROOT_COST,
    requires: [],
    stats: { attack: 6 },
  },
  {
    id: "attr-guard",
    type: "attribute",
    name: { zh: "坚守", en: "Guard" },
    description: "防御 +6",
    cost: ROOT_COST,
    requires: [],
    stats: { defense: 6 },
  },
  {
    id: "attr-vital",
    type: "attribute",
    name: { zh: "强体", en: "Vitality" },
    description: "最大生命 +20",
    cost: ROOT_COST,
    requires: [],
    stats: { maxHp: 20 },
  },
  {
    id: "attr-power-2",
    type: "attribute",
    name: { zh: "锐意", en: "Edge" },
    description: "攻击 +10",
    cost: SECONDARY_COST,
    requires: ["attr-power"],
    stats: { attack: 10 },
  },
  {
    id: "attr-guard-2",
    type: "attribute",
    name: { zh: "壁垒", en: "Bulwark" },
    description: "防御 +10",
    cost: SECONDARY_COST,
    requires: ["attr-guard"],
    stats: { defense: 10 },
  },
  {
    id: "attr-vital-2",
    type: "attribute",
    name: { zh: "磐体", en: "Boulder" },
    description: "最大生命 +30",
    cost: SECONDARY_COST,
    requires: ["attr-vital"],
    stats: { maxHp: 30 },
  },
];

const ELEMENT_ROOT: Record<ElementType, string> = {
  fire: "attr-power",
  electric: "attr-power",
  dragon: "attr-power",
  dark: "attr-power",
  normal: "attr-power",
  neutral: "attr-power",
  water: "attr-guard",
  ice: "attr-guard",
  ground: "attr-guard",
  rock: "attr-guard",
  grass: "attr-vital",
  wind: "attr-vital",
};

const ELEMENT_PASSIVE: Record<ElementType, string> = {
  fire: "flame_attuned",
  electric: "spark_attuned",
  dragon: "star_attuned",
  dark: "dusk_attuned",
  normal: "balanced_frame",
  neutral: "balanced_frame",
  water: "tide_attuned",
  ice: "frost_attuned",
  ground: "stonehide",
  rock: "stonehide",
  grass: "grove_attuned",
  wind: "windstep",
};

/** Total skill points available at a given level (1 point per level up to max). */
export function getSkillPointTotal(level: number): number {
  return Math.max(0, Math.min(MAX_PAL_LEVEL, Math.floor(level)) - 1);
}

/** The skills an individual can use from the start (first N learnable skills). */
export function getBaseSkillIds(pal: Pal): string[] {
  return (pal.activeSkills ?? []).slice(0, MAX_EQUIPPED_SKILLS);
}

export function getSpeciesSkillTree(
  pal: Pal,
  skillsById: ReadonlyMap<string, ActiveSkill>,
  passivesById: ReadonlyMap<string, PassiveSkill>
): SkillTreeNode[] {
  const activeNodes: SkillTreeNode[] = (pal.activeSkills ?? []).map((skillId) => {
    const skill = skillsById.get(skillId);
    const root = skill ? (ELEMENT_ROOT[skill.element] ?? "attr-power") : "attr-power";
    return {
      id: `skill-${skillId}`,
      type: "active",
      name: skill?.name ?? { zh: skillId, en: skillId },
      description: `解锁主动技能「${skill?.name.zh ?? skillId}」以供装备`,
      cost: ACTIVE_NODE_COST,
      requires: [root],
      skillId,
    };
  });
  const passiveId =
    pal.passiveSkills?.[0] ?? ELEMENT_PASSIVE[pal.elements[0] ?? "neutral"] ?? "balanced_frame";
  const firstSkill = pal.activeSkills?.[0];
  const passiveNode: SkillTreeNode = {
    id: `passive-${passiveId}`,
    type: "passive",
    name: { zh: "血脉传承", en: "Legacy" },
    description: `获得被动效果「${passivesById.get(passiveId)?.name.zh ?? passiveId}」`,
    cost: PASSIVE_NODE_COST,
    requires: firstSkill ? [`skill-${firstSkill}`] : ["attr-power"],
    passiveId,
  };
  return [...ATTRIBUTE_NODES.map((node) => ({ ...node })), ...activeNodes, passiveNode];
}

export function getNodeById(nodes: readonly SkillTreeNode[], nodeId: string): SkillTreeNode | undefined {
  return nodes.find((node) => node.id === nodeId);
}

export function getSpentSkillPoints(nodes: readonly SkillTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + node.cost, 0);
}

export function getAvailableSkillPoints(instance: PalInstance, nodes: readonly SkillTreeNode[]): number {
  const unlocked = new Set(instance.unlockedNodeIds ?? []);
  const spent = nodes.filter((node) => unlocked.has(node.id)).reduce((sum, node) => sum + node.cost, 0);
  return getSkillPointTotal(instance.level) - spent;
}

export function isBaseSkill(pal: Pal, skillId: string): boolean {
  return getBaseSkillIds(pal).includes(skillId);
}

export function isSkillEquipable(
  pal: Pal,
  skillId: string,
  speciesTree: readonly SkillTreeNode[],
  unlockedNodeIds: readonly string[] = []
): boolean {
  if (isBaseSkill(pal, skillId)) return true;
  return speciesTree.some(
    (node) => node.type === "active" && node.skillId === skillId && unlockedNodeIds.includes(node.id)
  );
}

export function getEquippedSkillIds(
  pal: Pal,
  instance: PalInstance,
  nodes: readonly SkillTreeNode[]
): string[] {
  const unlocked = instance.unlockedNodeIds ?? [];
  const valid = (instance.equippedSkillIds ?? []).filter((id) => isSkillEquipable(pal, id, nodes, unlocked));
  if (valid.length > 0) return valid.slice(0, MAX_EQUIPPED_SKILLS);
  return getBaseSkillIds(pal).slice(0, MAX_EQUIPPED_SKILLS);
}

export function canUnlockNode(
  instance: PalInstance,
  nodes: readonly SkillTreeNode[],
  nodeId: string
): boolean {
  const node = getNodeById(nodes, nodeId);
  if (!node) return false;
  const unlocked = instance.unlockedNodeIds ?? [];
  if (unlocked.includes(nodeId)) return false;
  if (!node.requires.every((id) => unlocked.includes(id))) return false;
  return (
    node.cost <=
    getSkillPointTotal(instance.level) -
      getSpentSkillPoints(nodes.filter((item) => unlocked.includes(item.id)))
  );
}

export function unlockNode(
  save: GameSave,
  uid: string,
  nodeId: string,
  pal: Pal,
  skillsById: ReadonlyMap<string, ActiveSkill>,
  passivesById: ReadonlyMap<string, PassiveSkill>
): GameSave {
  const instance = save.ownedPals.find((item) => item.uid === uid);
  if (!instance) return save;
  const tree = getSpeciesSkillTree(pal, skillsById, passivesById);
  if (!canUnlockNode(instance, tree, nodeId)) return save;
  const unlocked = instance.unlockedNodeIds ?? [];
  return {
    ...save,
    ownedPals: save.ownedPals.map((item) =>
      item.uid === uid ? { ...item, unlockedNodeIds: [...unlocked, nodeId] } : item
    ),
  };
}

export function getResetCost(instance: PalInstance): number {
  return RESET_BASE_COST + Math.floor(instance.level / 10) * RESET_COST_PER_10_LEVELS;
}

export function resetSkillTree(save: GameSave, uid: string, pal: Pal): GameSave {
  const instance = save.ownedPals.find((item) => item.uid === uid);
  if (!instance) return save;
  const cost = getResetCost(instance);
  if (save.base.resources.crystal < cost) return save;
  return {
    ...save,
    base: {
      ...save.base,
      resources: { ...save.base.resources, crystal: save.base.resources.crystal - cost },
    },
    ownedPals: save.ownedPals.map((item) => {
      if (item.uid !== uid) return item;
      const baseSkills = getBaseSkillIds(pal);
      return {
        ...item,
        unlockedNodeIds: [],
        equippedSkillIds: baseSkills,
      };
    }),
  };
}

export function equipSkill(
  save: GameSave,
  uid: string,
  skillId: string,
  pal: Pal,
  speciesTree: readonly SkillTreeNode[]
): GameSave {
  const instance = save.ownedPals.find((item) => item.uid === uid);
  if (!instance) return save;
  if (!isSkillEquipable(pal, skillId, speciesTree, instance.unlockedNodeIds ?? [])) return save;
  const equipped = instance.equippedSkillIds ?? [];
  if (equipped.includes(skillId)) return save;
  if (equipped.length >= MAX_EQUIPPED_SKILLS && !isBaseSkill(pal, skillId)) return save;
  return {
    ...save,
    ownedPals: save.ownedPals.map((item) =>
      item.uid === uid
        ? { ...item, equippedSkillIds: [...equipped, skillId].slice(0, MAX_EQUIPPED_SKILLS) }
        : item
    ),
  };
}

export function unequipSkill(save: GameSave, uid: string, skillId: string): GameSave {
  const instance = save.ownedPals.find((item) => item.uid === uid);
  if (!instance) return save;
  const equipped = instance.equippedSkillIds ?? [];
  if (!equipped.includes(skillId)) return save;
  return {
    ...save,
    ownedPals: save.ownedPals.map((item) =>
      item.uid === uid ? { ...item, equippedSkillIds: equipped.filter((id) => id !== skillId) } : item
    ),
  };
}

export interface BuildFlat {
  maxHp: number;
  attack: number;
  defense: number;
  workSpeed: number;
  moveSpeed: number;
}

export interface BuildPercent {
  attackPercent: number;
  defensePercent: number;
  maxHpPercent: number;
  speedPercent: number;
  workSpeedPercent: number;
  resourceYieldPercent: number;
  energyCostPercent: number;
  damageTakenPercent: number;
  elementDamagePercent: Partial<Record<ElementType, number>>;
  elementResistancePercent: Partial<Record<ElementType, number>>;
}

export interface BuildBonuses {
  flat: BuildFlat;
  percent: BuildPercent;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function addElement(
  record: Partial<Record<ElementType, number>>,
  element: ElementType | undefined,
  amount: number
) {
  if (!element) return;
  record[element] = (record[element] ?? 0) + amount;
}

function applyEquipmentAffixes(percent: BuildPercent, flat: BuildFlat, equipment: EquipmentDefinition): void {
  for (const affix of equipment.affixes) {
    switch (affix.stat) {
      case "attackPercent":
        percent.attackPercent += affix.value;
        break;
      case "defensePercent":
        percent.defensePercent += affix.value;
        break;
      case "maxHpPercent":
        percent.maxHpPercent += affix.value;
        break;
      case "speedPercent":
        percent.speedPercent += affix.value;
        break;
      case "workSpeedPercent":
        percent.workSpeedPercent += affix.value;
        break;
      case "resourceYieldPercent":
        percent.resourceYieldPercent += affix.value;
        break;
      case "energyCostPercent":
        percent.energyCostPercent += affix.value;
        break;
      case "damageTakenPercent":
        percent.damageTakenPercent += affix.value;
        break;
      case "elementDamage":
        addElement(percent.elementDamagePercent, affix.element, affix.value);
        break;
      case "elementResistance":
        addElement(percent.elementResistancePercent, affix.element, affix.value);
        break;
      case "maxHpFlat":
        flat.maxHp += affix.value;
        break;
      case "attackFlat":
        flat.attack += affix.value;
        break;
      case "defenseFlat":
        flat.defense += affix.value;
        break;
      case "moveSpeedFlat":
        flat.moveSpeed += affix.value;
        break;
      case "workSpeedFlat":
        flat.workSpeed += affix.value;
        break;
      default:
        break;
    }
  }
}

function flatFromNodes(instance: PalInstance, speciesTree: readonly SkillTreeNode[]): BuildFlat {
  const flat: BuildFlat = { maxHp: 0, attack: 0, defense: 0, workSpeed: 0, moveSpeed: 0 };
  const unlocked = new Set(instance.unlockedNodeIds ?? []);
  for (const node of speciesTree) {
    if (node.type !== "attribute" || !unlocked.has(node.id)) continue;
    flat.attack += node.stats?.attack ?? 0;
    flat.defense += node.stats?.defense ?? 0;
    flat.maxHp += node.stats?.maxHp ?? 0;
    flat.workSpeed += node.stats?.workSpeed ?? 0;
    flat.moveSpeed += node.stats?.moveSpeed ?? 0;
  }
  return flat;
}

function percentFromPassives(
  instance: PalInstance,
  speciesTree: readonly SkillTreeNode[],
  context: { hour?: number } = {}
): BuildPercent {
  const percent: BuildPercent = {
    attackPercent: 0,
    defensePercent: 0,
    maxHpPercent: 0,
    speedPercent: 0,
    workSpeedPercent: 0,
    resourceYieldPercent: 0,
    energyCostPercent: 0,
    damageTakenPercent: 0,
    elementDamagePercent: {},
    elementResistancePercent: {},
  };
  const passiveIds = new Set(instance.passiveSkillIds ?? []);
  for (const node of speciesTree) {
    if ((instance.unlockedNodeIds ?? []).includes(node.id) && node.passiveId) passiveIds.add(node.passiveId);
  }
  const passive: PassiveBonuses = getPassiveBonuses([...passiveIds], context);
  percent.attackPercent += passive.attackPercent;
  percent.defensePercent += passive.defensePercent;
  percent.speedPercent += passive.speedPercent;
  percent.workSpeedPercent += passive.workSpeedPercent;
  percent.resourceYieldPercent += passive.resourceYieldPercent;
  percent.energyCostPercent += passive.energyCostPercent;
  percent.damageTakenPercent += passive.damageTakenPercent;
  for (const [element, amount] of Object.entries(passive.elementDamagePercent))
    percent.elementDamagePercent[element as ElementType] = amount;
  for (const [element, amount] of Object.entries(passive.elementResistancePercent))
    percent.elementResistancePercent[element as ElementType] = amount;
  return percent;
}

export function getEquippedEquipmentItems(instance: PalInstance, save: GameSave): EquipmentItem[] {
  const slots = instance.equipment ?? {};
  return (["core", "charm", "armor"] as EquipmentSlot[])
    .map((slot) => slots[slot])
    .filter((uid): uid is string => Boolean(uid))
    .map((uid) => save.inventory.equipment.find((item) => item.uid === uid))
    .filter((item): item is EquipmentItem => Boolean(item));
}

export function getBuildBonuses(
  save: GameSave,
  instance: PalInstance,
  pal: Pal,
  speciesTree: readonly SkillTreeNode[],
  equipmentDefinitions: ReadonlyMap<string, EquipmentDefinition>,
  context: { hour?: number } = {}
): BuildBonuses {
  const flat = flatFromNodes(instance, speciesTree);
  const percent = percentFromPassives(instance, speciesTree, context);
  for (const item of getEquippedEquipmentItems(instance, save)) {
    const definition = equipmentDefinitions.get(item.equipmentId);
    if (definition) applyEquipmentAffixes(percent, flat, definition);
  }
  percent.attackPercent = clamp(percent.attackPercent, -40, 60);
  percent.defensePercent = clamp(percent.defensePercent, -40, 60);
  percent.maxHpPercent = clamp(percent.maxHpPercent, -20, 60);
  percent.speedPercent = clamp(percent.speedPercent, -40, 60);
  percent.workSpeedPercent = clamp(percent.workSpeedPercent, -30, 80);
  percent.resourceYieldPercent = clamp(percent.resourceYieldPercent, 0, 60);
  percent.energyCostPercent = clamp(percent.energyCostPercent, -40, 40);
  percent.damageTakenPercent = clamp(percent.damageTakenPercent, -40, 40);
  for (const element of Object.keys(percent.elementDamagePercent) as ElementType[]) {
    percent.elementDamagePercent[element] = clamp(percent.elementDamagePercent[element] ?? 0, 0, 50);
  }
  for (const element of Object.keys(percent.elementResistancePercent) as ElementType[]) {
    percent.elementResistancePercent[element] = clamp(percent.elementResistancePercent[element] ?? 0, 0, 50);
  }
  return { flat, percent };
}

export interface FinalBuildStats {
  maxHp: number;
  attack: number;
  defense: number;
  workSpeed: number;
  moveSpeed: number;
}

export function getFinalBuildStats(
  pal: Pal,
  instance: PalInstance,
  speciesTree: readonly SkillTreeNode[],
  equipmentDefinitions: ReadonlyMap<string, EquipmentDefinition>,
  save: GameSave
): FinalBuildStats {
  const baseHp = pal.stats.hp + pal.growth.hpPerLevel * Math.max(0, instance.level - 1);
  const baseAttack = pal.stats.attack + pal.growth.attackPerLevel * Math.max(0, instance.level - 1);
  const baseDefense = pal.stats.defense + pal.growth.defensePerLevel * Math.max(0, instance.level - 1);
  const bonuses = getBuildBonuses(save, instance, pal, speciesTree, equipmentDefinitions);
  const maxHp = Math.max(
    1,
    Math.round((baseHp + bonuses.flat.maxHp) * (1 + bonuses.percent.maxHpPercent / 100))
  );
  const attack = Math.max(
    1,
    Math.round((baseAttack + bonuses.flat.attack) * (1 + bonuses.percent.attackPercent / 100))
  );
  const defense = Math.max(
    1,
    Math.round((baseDefense + bonuses.flat.defense) * (1 + bonuses.percent.defensePercent / 100))
  );
  const workSpeed = Math.max(
    1,
    Math.round((pal.stats.workSpeed + bonuses.flat.workSpeed) * (1 + bonuses.percent.workSpeedPercent / 100))
  );
  const moveSpeed = Math.max(
    1,
    Math.round((pal.stats.moveSpeed + bonuses.flat.moveSpeed) * (1 + bonuses.percent.speedPercent / 100))
  );
  return { maxHp, attack, defense, workSpeed, moveSpeed };
}

export function describeBuildBonuses(
  save: GameSave,
  instance: PalInstance,
  pal: Pal,
  speciesTree: readonly SkillTreeNode[],
  equipmentDefinitions: ReadonlyMap<string, EquipmentDefinition>
): string[] {
  const { flat, percent } = getBuildBonuses(save, instance, pal, speciesTree, equipmentDefinitions);
  const labels: string[] = [];
  if (percent.attackPercent) labels.push(`攻击 +${percent.attackPercent}%`);
  if (percent.defensePercent) labels.push(`防御 +${percent.defensePercent}%`);
  if (percent.maxHpPercent) labels.push(`生命 +${percent.maxHpPercent}%`);
  if (percent.speedPercent) labels.push(`速度 +${percent.speedPercent}%`);
  if (percent.workSpeedPercent) labels.push(`工作 +${percent.workSpeedPercent}%`);
  if (percent.resourceYieldPercent) labels.push(`产量 +${percent.resourceYieldPercent}%`);
  if (percent.energyCostPercent)
    labels.push(`能耗 ${percent.energyCostPercent > 0 ? "+" : ""}${percent.energyCostPercent}%`);
  if (percent.damageTakenPercent)
    labels.push(`承伤 ${percent.damageTakenPercent > 0 ? "+" : ""}${percent.damageTakenPercent}%`);
  if (flat.maxHp) labels.push(`生命 +${flat.maxHp}`);
  if (flat.attack) labels.push(`攻击 +${flat.attack}`);
  if (flat.defense) labels.push(`防御 +${flat.defense}`);
  if (flat.moveSpeed) labels.push(`速度 +${flat.moveSpeed}`);
  if (flat.workSpeed) labels.push(`工作 +${flat.workSpeed}`);
  for (const [element, amount] of Object.entries(percent.elementDamagePercent))
    labels.push(`${element}伤害 +${amount}%`);
  for (const [element, amount] of Object.entries(percent.elementResistancePercent))
    labels.push(`${element}抗性 +${amount}%`);
  return labels;
}
