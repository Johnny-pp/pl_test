import type { GameSave } from "../player/playerState.ts";
import type { BossBattleRules } from "../battle/battleEngine.ts";
import { bossesById } from "../battle/bosses.ts";
import type { ChallengeRestrictions } from "./challengeRules.ts";

/**
 * 主线首领的强化重战：等级更高、阶段强化更强，并施加队伍限制。
 * 首次重战胜利发放一次性奖励，之后可重复挑战以刷新最佳评分。
 */
export interface BossRematchDef {
  bossId: string;
  level: number;
  rules: BossBattleRules;
  restrictions: ChallengeRestrictions;
  firstRewardLabel: string;
  firstRewards: {
    coins?: number;
    resources?: Partial<GameSave["base"]["resources"]>;
    equipment?: string[];
  };
}

export const BOSS_REMATCHES: BossRematchDef[] = [
  {
    bossId: "storm-lord",
    level: 16,
    rules: {
      id: "rematch-storm-lord",
      statusResistance: 65,
      phaseThreshold: 0.5,
      phaseAttackBoost: 40,
      phaseDefenseBoost: 30,
    },
    restrictions: { maxTeamSize: 4 },
    firstRewardLabel: "星币 260、晶体 15",
    firstRewards: { coins: 260, resources: { crystal: 15 } },
  },
  {
    bossId: "tidewarden",
    level: 22,
    rules: {
      id: "rematch-tidewarden",
      statusResistance: 55,
      phaseThreshold: 0.35,
      phaseAttackBoost: 35,
      phaseDefenseBoost: 28,
    },
    restrictions: { elementWhitelist: ["fire", "electric", "grass", "dark"], maxTeamSize: 5 },
    firstRewardLabel: "星币 360、核心「渊潮之心」",
    firstRewards: { coins: 360, equipment: ["core-abyssal-heart"] },
  },
  {
    bossId: "mire-sovereign",
    level: 24,
    rules: {
      id: "rematch-mire-sovereign",
      statusResistance: 60,
      phaseThreshold: 0.4,
      phaseAttackBoost: 38,
      phaseDefenseBoost: 30,
    },
    restrictions: { elementWhitelist: ["water", "grass", "wind", "ice"], maxTeamSize: 4 },
    firstRewardLabel: "星币 420、护甲「重装壁垒甲」",
    firstRewards: { coins: 420, equipment: ["armor-bulwark-mail"] },
  },
  {
    bossId: "abyssal-colossus",
    level: 28,
    rules: {
      id: "rematch-abyssal-colossus",
      statusResistance: 70,
      phaseThreshold: 0.5,
      phaseAttackBoost: 45,
      phaseDefenseBoost: 35,
    },
    restrictions: { elementWhitelist: ["fire", "water", "grass", "electric", "ice", "wind"], maxTeamSize: 4 },
    firstRewardLabel: "星币 600、护符「岚主之角」",
    firstRewards: { coins: 600, equipment: ["charm-stormlord-horn"] },
  },
];

export const bossRematchesById = new Map(BOSS_REMATCHES.map((entry) => [entry.bossId, entry]));

export function getRematchForBoss(bossId: string): BossRematchDef | undefined {
  return bossRematchesById.get(bossId);
}

/** 重战是否可用：需先击败对应主线首领。 */
export function canRematchBoss(save: GameSave, bossId: string): boolean {
  return save.progress.defeatedBossIds.includes(bossId) && Boolean(getRematchForBoss(bossId));
}

/** 是否已领取首次重战奖励。 */
export function isRematchFirstRewardClaimed(save: GameSave, bossId: string): boolean {
  return save.endgame.rematchRewardsClaimed.includes(`rematch-${bossId}`);
}

/** 领取首次重战奖励（幂等，仅一次）。 */
export function claimRematchFirstReward(save: GameSave, bossId: string): GameSave {
  if (isRematchFirstRewardClaimed(save, bossId)) return save;
  const rematch = getRematchForBoss(bossId);
  if (!rematch) return save;
  const rewards = rematch.firstRewards;
  const resources = { ...save.base.resources };
  for (const [resource, amount] of Object.entries(rewards.resources ?? {})) {
    resources[resource as keyof typeof resources] += amount ?? 0;
  }
  return {
    ...save,
    endgame: {
      ...save.endgame,
      rematchRewardsClaimed: [...save.endgame.rematchRewardsClaimed, `rematch-${bossId}`],
    },
    inventory: {
      ...save.inventory,
      coins: save.inventory.coins + (rewards.coins ?? 0),
      equipment: [
        ...save.inventory.equipment,
        ...(rewards.equipment ?? []).map((equipmentId) => ({
          uid: `rematch-${bossId}-${equipmentId}`,
          equipmentId,
        })),
      ],
    },
    base: { ...save.base, resources },
  };
}

export interface RematchView {
  rematch: BossRematchDef;
  bossName: string;
  unlocked: boolean;
  firstRewardClaimed: boolean;
}

export function getRematchViews(save: GameSave): RematchView[] {
  return BOSS_REMATCHES.map((rematch) => {
    const boss = bossesById.get(rematch.bossId);
    return {
      rematch,
      bossName: boss?.name ?? rematch.bossId,
      unlocked: canRematchBoss(save, rematch.bossId),
      firstRewardClaimed: isRematchFirstRewardClaimed(save, rematch.bossId),
    };
  });
}
