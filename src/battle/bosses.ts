import type { BossBattleRules } from "./battleEngine";

export interface BossDefinition {
  id: string;
  speciesId: number;
  name: string;
  level: number;
  rules: BossBattleRules;
}

export const BOSSES: BossDefinition[] = [
  {
    id: "storm-lord",
    speciesId: 39,
    name: "岚角羚·风暴领主",
    level: 12,
    rules: {
      id: "storm-lord",
      statusResistance: 55,
      phaseThreshold: 0.5,
      phaseAttackBoost: 28,
      phaseDefenseBoost: 22,
    },
  },
];

export const bossesById = new Map(BOSSES.map((boss) => [boss.id, boss]));
