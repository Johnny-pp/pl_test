import type { GameSave } from "../player/playerState.ts";
import { recordEliteVictory } from "../quests/sideQuests.ts";
import { STARTIDE_REGION, type WorldRegion } from "../world/regions.ts";

export interface EliteDef {
  id: string;
  name: string;
  region: WorldRegion;
  x: number;
  y: number;
  /** 王牌幻兽（作为战斗对手）。 */
  speciesId: number;
  level: number;
  rewardLabel: string;
  rewards: {
    coins?: number;
    resources?: Partial<GameSave["base"]["resources"]>;
    captureOrbs?: number;
    healingTonics?: number;
    equipment?: string[];
  };
  /** 首次击败奖励只发放一次；此字段控制再次挑战的冷却。 */
  replayCooldownMs: number;
}

export const ELITES: EliteDef[] = [
  {
    id: "elite-plumage-sentinel",
    name: "滩头巡逻兵·羽翎",
    region: STARTIDE_REGION,
    x: 14 * 32,
    y: 14 * 32,
    speciesId: 42,
    level: 14,
    rewardLabel: "星币 90、掉落素材 2",
    rewards: { coins: 90 },
    replayCooldownMs: 0,
  },
  {
    id: "elite-deep-diver",
    name: "深潜客·潮髓",
    region: STARTIDE_REGION,
    x: 27 * 32,
    y: 12 * 32,
    speciesId: 45,
    level: 16,
    rewardLabel: "星币 130、晶体 8",
    rewards: { coins: 130, resources: { crystal: 8 } },
    replayCooldownMs: 0,
  },
];

export const elitesById = new Map(ELITES.map((elite) => [elite.id, elite]));

export function getElitesForRegion(region: WorldRegion): EliteDef[] {
  return ELITES.filter((elite) => elite.region === region);
}

export function isEliteDefeated(save: GameSave, eliteId: string): boolean {
  return save.progress.defeatedEliteIds.includes(eliteId);
}

/** 首次击败已记录时，是否允许按冷却规则重战。 */
export function canRebattleElite(save: GameSave, elite: EliteDef, now = Date.now()): boolean {
  if (!isEliteDefeated(save, elite.id)) return true;
  const lastDefeat = save.progress.eliteDefeatTimes[elite.id] ?? 0;
  return now - lastDefeat >= elite.replayCooldownMs;
}

export interface EliteVictoryResult {
  save: GameSave;
  /** 是否首次击败（发放一次性奖励）。 */
  firstDefeat: boolean;
}

/** 记录精英被击败：首次击败发放奖励并记录，同时更新重战冷却。 */
export function recordEliteDefeat(
  save: GameSave,
  elite: EliteDef,
  now = Date.now()
): EliteVictoryResult {
  const firstDefeat = !isEliteDefeated(save, elite.id);
  const rewards = elite.rewards;
  const resources = { ...save.base.resources };
  for (const [resource, amount] of Object.entries(rewards.resources ?? {})) {
    resources[resource as keyof typeof resources] += amount ?? 0;
  }
  let next: GameSave = {
    ...save,
    progress: {
      ...save.progress,
      eliteDefeatTimes: { ...save.progress.eliteDefeatTimes, [elite.id]: now },
    },
  };
  if (firstDefeat) {
    next = {
      ...next,
      progress: {
        ...next.progress,
        defeatedEliteIds: [...next.progress.defeatedEliteIds, elite.id],
      },
      inventory: {
        ...next.inventory,
        coins: next.inventory.coins + (rewards.coins ?? 0),
        captureOrbs: next.inventory.captureOrbs + (rewards.captureOrbs ?? 0),
        healingTonics: next.inventory.healingTonics + (rewards.healingTonics ?? 0),
        equipment: [
          ...next.inventory.equipment,
          ...(rewards.equipment ?? []).map((equipmentId) => ({
            uid: `elite-${elite.id}-${equipmentId}`,
            equipmentId,
          })),
        ],
      },
      base: { ...next.base, resources },
    };
  }
  return { save: recordEliteVictory(next, elite.id), firstDefeat };
}
