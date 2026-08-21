import type { GameSave } from "../player/playerState.ts";
import type { BossBattleRules } from "../battle/battleEngine.ts";
import type { ChallengeRestrictions } from "./challengeRules.ts";

export const TOWER_TOTAL_FLOORS = 10;

/** 从第 4 层起限制出战元素，从第 7 层起再加队伍人数上限。 */
const FLOOR_RESTRICTIONS: Record<number, ChallengeRestrictions> = {
  4: { elementWhitelist: ["fire", "water", "grass", "electric"] },
  7: { elementWhitelist: ["fire", "water", "grass", "electric", "ice", "wind"], maxTeamSize: 4 },
};

export interface TowerFloor {
  floor: number;
  speciesId: number;
  level: number;
  /** 该层独有首领规则（半血强化等）。 */
  bossRules?: BossBattleRules;
}

export const TOWER_FLOORS: TowerFloor[] = [
  { floor: 1, speciesId: 41, level: 24 },
  { floor: 2, speciesId: 37, level: 26 },
  { floor: 3, speciesId: 44, level: 28 },
  { floor: 4, speciesId: 46, level: 30 },
  { floor: 5, speciesId: 47, level: 32 },
  { floor: 6, speciesId: 35, level: 34 },
  { floor: 7, speciesId: 39, level: 36 },
  { floor: 8, speciesId: 49, level: 38 },
  { floor: 9, speciesId: 50, level: 40 },
  {
    floor: 10,
    speciesId: 51,
    level: 42,
    bossRules: {
      id: "tower-colossus",
      statusResistance: 60,
      phaseThreshold: 0.5,
      phaseAttackBoost: 30,
      phaseDefenseBoost: 25,
    },
  },
];

export function getTowerFloor(floor: number): TowerFloor | undefined {
  return TOWER_FLOORS.find((entry) => entry.floor === floor);
}

/** 从当前层开始累计生效的限制（多层限制合并）。 */
export function getTowerRestrictions(floor: number): ChallengeRestrictions | undefined {
  const merged: ChallengeRestrictions = {};
  for (let current = 1; current <= floor; current += 1) {
    const entry = FLOOR_RESTRICTIONS[current];
    if (!entry) continue;
    if (entry.elementWhitelist) merged.elementWhitelist = entry.elementWhitelist;
    if (entry.maxTeamSize !== undefined) merged.maxTeamSize = entry.maxTeamSize;
    if (entry.minRarity !== undefined) merged.minRarity = entry.minRarity;
    if (entry.noCapture) merged.noCapture = true;
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export interface TowerReward {
  label: string;
  coins?: number;
  resources?: Partial<GameSave["base"]["resources"]>;
  captureOrbs?: number;
  healingTonics?: number;
  advancedCaptureOrbs?: number;
  equipment?: string[];
  abilities?: string[];
}

/** 每 3 层一次阶段奖励，通关第 10 层发放终局奖励。 */
export function getTowerReward(floor: number): TowerReward | undefined {
  const rewards: Record<number, TowerReward> = {
    3: {
      label: "星币 200、晶体 10",
      coins: 200,
      resources: { crystal: 10 },
    },
    6: {
      label: "星币 350、治疗剂 3、捕获器 2",
      coins: 350,
      healingTonics: 3,
      captureOrbs: 2,
    },
    9: {
      label: "星币 500、高级捕获器 1、护符「涛影护符」",
      coins: 500,
      advancedCaptureOrbs: 1,
      equipment: ["charm-tide-shadow"],
    },
    10: {
      label: "星币 800、能力「试炼精通」、传说护甲「渊极重铠」",
      coins: 800,
      abilities: ["tower-mastery"],
      equipment: ["armor-abyssal-plate"],
    },
  };
  return rewards[floor];
}

export function isTowerRewardFloor(floor: number): boolean {
  return getTowerReward(floor) !== undefined;
}

/** 记录通过一层，推进最高已通过层数（不会回退）。 */
export function recordTowerVictory(save: GameSave, floor: number): GameSave {
  if (floor <= save.endgame.towerFloorsCleared) return save;
  return {
    ...save,
    endgame: {
      ...save.endgame,
      towerFloorsCleared: Math.max(0, Math.min(TOWER_TOTAL_FLOORS, floor)),
    },
  };
}

/** 领取阶段奖励（按楼层幂等，重复调用不发放）。 */
export function claimTowerReward(save: GameSave, floor: number): GameSave {
  if (floor > save.endgame.towerFloorsCleared) return save;
  if (save.endgame.towerRewardsClaimed.includes(`floor-${floor}`)) return save;
  const reward = getTowerReward(floor);
  if (!reward) return save;
  const resources = { ...save.base.resources };
  for (const [resource, amount] of Object.entries(reward.resources ?? {})) {
    resources[resource as keyof typeof resources] += amount ?? 0;
  }
  return {
    ...save,
    endgame: {
      ...save.endgame,
      towerRewardsClaimed: [...save.endgame.towerRewardsClaimed, `floor-${floor}`],
    },
    progress: {
      ...save.progress,
      unlockedAbilities: [...new Set([...save.progress.unlockedAbilities, ...(reward.abilities ?? [])])],
    },
    inventory: {
      ...save.inventory,
      coins: save.inventory.coins + (reward.coins ?? 0),
      captureOrbs: save.inventory.captureOrbs + (reward.captureOrbs ?? 0),
      healingTonics: save.inventory.healingTonics + (reward.healingTonics ?? 0),
      advancedCaptureOrbs: save.inventory.advancedCaptureOrbs + (reward.advancedCaptureOrbs ?? 0),
      equipment: [
        ...save.inventory.equipment,
        ...(reward.equipment ?? []).map((equipmentId) => ({
          uid: `tower-${floor}-${equipmentId}`,
          equipmentId,
        })),
      ],
    },
    base: { ...save.base, resources },
  };
}

/** 下一目标层；null 表示已通关全部层数。 */
export function getTowerNextFloor(save: GameSave): number | null {
  return save.endgame.towerFloorsCleared >= TOWER_TOTAL_FLOORS ? null : save.endgame.towerFloorsCleared + 1;
}

export interface TowerView {
  clearedFloors: number;
  totalFloors: number;
  nextFloor: number | null;
  /** 可领取但未领取的阶段奖励楼层。 */
  pendingRewards: number[];
  /** 已通关，无更多内容。 */
  complete: boolean;
}

export function getTowerView(save: GameSave): TowerView {
  const nextFloor = getTowerNextFloor(save);
  const pendingRewards = TOWER_FLOORS.map((entry) => entry.floor)
    .filter((floor) => isTowerRewardFloor(floor))
    .filter((floor) => floor <= save.endgame.towerFloorsCleared)
    .filter((floor) => !save.endgame.towerRewardsClaimed.includes(`floor-${floor}`));
  return {
    clearedFloors: save.endgame.towerFloorsCleared,
    totalFloors: TOWER_TOTAL_FLOORS,
    nextFloor,
    pendingRewards,
    complete: nextFloor === null,
  };
}
