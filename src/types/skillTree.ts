import type { ElementType } from "./pal";

export type SkillTreeNodeType = "attribute" | "active" | "passive";

export interface SkillTreeNode {
  id: string;
  type: SkillTreeNodeType;
  name: {
    zh: string;
    en: string;
  };
  description: string;
  /** Skill points required to unlock. */
  cost: number;
  /** Node ids that must be unlocked first. */
  requires: string[];
  /** Attribute node stat bonus (flat values). */
  stats?: {
    attack?: number;
    defense?: number;
    maxHp?: number;
    moveSpeed?: number;
    workSpeed?: number;
  };
  /** Active node: the active skill id this node unlocks. */
  skillId?: string;
  /** Passive node: the passive skill id this node grants. */
  passiveId?: string;
}

export type EquipmentSlot = "core" | "charm" | "armor";

export type EquipmentRarity = "common" | "rare" | "legendary";

export interface EquipmentAffix {
  stat:
    | "attackPercent"
    | "defensePercent"
    | "maxHpPercent"
    | "speedPercent"
    | "workSpeedPercent"
    | "resourceYieldPercent"
    | "energyCostPercent"
    | "damageTakenPercent"
    | "maxHpFlat"
    | "attackFlat"
    | "defenseFlat"
    | "moveSpeedFlat"
    | "workSpeedFlat"
    | "elementDamage"
    | "elementResistance";
  value: number;
  element?: ElementType;
}

export interface EquipmentDefinition {
  id: string;
  name: {
    zh: string;
    en: string;
  };
  description: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  affixes: EquipmentAffix[];
}

export interface EquipmentItem {
  uid: string;
  equipmentId: string;
}

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  core: "核心",
  charm: "护符",
  armor: "护甲",
};

export const EQUIPMENT_RARITY_LABELS: Record<EquipmentRarity, string> = {
  common: "基础",
  rare: "稀有",
  legendary: "传说",
};
