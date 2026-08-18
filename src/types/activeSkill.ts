import type { ElementType } from "./pal";

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
}
