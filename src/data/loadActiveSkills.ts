import activeSkillsJson from "../../data/active-skills.json";
import type { ActiveSkill } from "../types/activeSkill";

export const activeSkills = activeSkillsJson as ActiveSkill[];

export const activeSkillsById = new Map(activeSkills.map((skill) => [skill.id, skill]));
