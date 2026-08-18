import type { ElementType } from "./pal";

export type StatusEffectType = "burn" | "poison" | "freeze" | "attack-up" | "defense-up" | "speed-up";

export interface ActiveSkillEffect {
  status: StatusEffectType;
  target: "self" | "opponent";
  chance: number;
  duration: number;
  magnitude: number;
}

export interface ActiveSkill {
  id: string;
  name: {
    zh: string;
    en: string;
  };
  description: string;
  element: ElementType;
  power: number;
  accuracy: number;
  energyCost: number;
  priority: number;
  effect?: ActiveSkillEffect;
}
