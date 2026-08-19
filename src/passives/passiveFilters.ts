import type { PassiveCategory, PassiveSkill } from "../types/passiveSkill";

export type PassiveCategoryFilter = PassiveCategory | "all";

export function filterPassiveSkills(
  skills: readonly PassiveSkill[],
  category: PassiveCategoryFilter
): PassiveSkill[] {
  return category === "all" ? [...skills] : skills.filter((skill) => skill.category === category);
}
