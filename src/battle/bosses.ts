import type { BossBattleRules } from "./battleEngine";
import type { WorldRegion } from "../world/regions.ts";

export interface BossDefinition {
  id: string;
  speciesId: number;
  name: string;
  level: number;
  region: WorldRegion;
  rules: BossBattleRules;
}

export const BOSSES: BossDefinition[] = [
  {
    id: "storm-lord",
    speciesId: 39,
    name: "岚角羚·风暴领主",
    level: 12,
    region: "cloudridge-highlands",
    rules: {
      id: "storm-lord",
      statusResistance: 55,
      phaseThreshold: 0.5,
      phaseAttackBoost: 28,
      phaseDefenseBoost: 22,
    },
  },
  {
    id: "tidewarden",
    speciesId: 47,
    name: "璨尾鳐·沉星潮卫",
    level: 17,
    region: "startide-archipelago",
    rules: {
      id: "tidewarden",
      statusResistance: 40,
      phaseThreshold: 0,
      phaseAttackBoost: 0,
      phaseDefenseBoost: 0,
    },
  },
  {
    id: "mire-sovereign",
    speciesId: 49,
    name: "苇冠龙·辉沼龙君",
    level: 18,
    region: "startide-archipelago",
    rules: {
      id: "mire-sovereign",
      statusResistance: 45,
      phaseThreshold: 0,
      phaseAttackBoost: 0,
      phaseDefenseBoost: 0,
    },
  },
  {
    id: "abyssal-colossus",
    speciesId: 51,
    name: "晦曜巨像·沉星终章",
    level: 22,
    region: "startide-archipelago",
    rules: {
      id: "abyssal-colossus",
      statusResistance: 60,
      phaseThreshold: 0.5,
      phaseAttackBoost: 30,
      phaseDefenseBoost: 25,
    },
  },
];

export const bossesById = new Map(BOSSES.map((boss) => [boss.id, boss]));

export function getBossesForRegion(region: WorldRegion): BossDefinition[] {
  return BOSSES.filter((boss) => boss.region === region);
}
