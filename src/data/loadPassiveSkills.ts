import passiveSkillsJson from "../../data/passive-skills.json";
import type { PassiveSkill } from "../types/passiveSkill";

export const passiveSkills = passiveSkillsJson as PassiveSkill[];

export const passiveSkillsById = new Map(passiveSkills.map((skill) => [skill.id, skill]));
