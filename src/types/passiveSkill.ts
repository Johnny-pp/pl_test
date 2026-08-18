export type PassiveCategory = "attack" | "defense" | "work" | "move" | "element" | "resource" | "other";

export type PassiveTier = "common" | "rare" | "legendary";

export interface PassiveSkillName {
  zh: string;
  en: string;
}

export interface PassiveSkill {
  id: string;
  name: PassiveSkillName;
  category: PassiveCategory;
  description: string;
  tier: PassiveTier;
}

export const PASSIVE_CATEGORY_LABELS: Record<PassiveCategory, string> = {
  attack: "攻击",
  defense: "防御",
  work: "工作",
  move: "移动",
  element: "属性",
  resource: "资源",
  other: "其他",
};

export const PASSIVE_CATEGORY_COLORS: Record<PassiveCategory, number> = {
  attack: 0xef5350,
  defense: 0x42a5f5,
  work: 0x66bb6a,
  move: 0xffca28,
  element: 0xab47bc,
  resource: 0xa1887f,
  other: 0x90a4ae,
};

export const PASSIVE_TIER_COLORS: Record<PassiveTier, number> = {
  common: 0x9aa0c0,
  rare: 0x4fc3f7,
  legendary: 0xffb300,
};

export const PASSIVE_TIER_LABELS: Record<PassiveTier, string> = {
  common: "普通",
  rare: "稀有",
  legendary: "传说",
};
