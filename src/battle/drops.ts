import type { Pal } from "../types/pal.ts";
import { addCoins, addMaterial } from "../player/playerState.ts";
import type { GameSave } from "../player/playerState.ts";

/** 战斗胜利的基础星币奖励，随敌方等级小幅增长。 */
export function battleCoinReward(enemyLevel: number): number {
  return 6 + Math.max(0, Math.floor(enemyLevel / 2));
}

/** 按概率表结算一次击败掉落的掉落物名称列表。 */
export function rollBattleDrops(pal: Pal, random: () => number = Math.random): string[] {
  const drops: string[] = [];
  for (const drop of pal.drops ?? []) {
    if (random() < drop.rate / 100) drops.push(drop.item);
  }
  return drops;
}

export function applyBattleRewards(save: GameSave, enemyPal: Pal, enemyLevel: number): GameSave {
  let next = addCoins(save, battleCoinReward(enemyLevel));
  for (const material of rollBattleDrops(enemyPal)) next = addMaterial(next, material);
  return next;
}
