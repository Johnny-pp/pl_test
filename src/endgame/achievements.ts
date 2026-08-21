import type { GameSave } from "../player/playerState.ts";
import type { Pal } from "../types/pal.ts";
import { TOWER_TOTAL_FLOORS } from "./tower.ts";

export type AchievementCategory = "dex" | "explore" | "breeding" | "base" | "battle" | "challenge";

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  /** 解锁时授予的可展示称号。 */
  titles?: string[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "dex-quarter", category: "dex", title: "初见星屿", description: "收集全部幻兽的四分之一。" },
  { id: "dex-half", category: "dex", title: "博物见闻", description: "收集全部幻兽的一半。" },
  {
    id: "dex-complete",
    category: "dex",
    title: "幻兽图鉴",
    description: "收集全部幻兽的四分之三。",
    titles: ["幻兽大师"],
  },
  { id: "discover-ten", category: "explore", title: "踏遍山川", description: "发现 10 处地点。" },
  { id: "explore-all", category: "explore", title: "疆域开拓", description: "解锁全部三个地区。" },
  {
    id: "chest-three",
    category: "explore",
    title: "探宝者",
    description: "开启 3 个隐藏宝箱。",
    titles: ["探宝者"],
  },
  {
    id: "hatch-ten",
    category: "breeding",
    title: "育成师",
    description: "孵化 10 只幻兽。",
    titles: ["育成师"],
  },
  { id: "radiant-egg", category: "breeding", title: "光辉之卵", description: "获得一枚辉煌品质的蛋。" },
  {
    id: "craft-twenty",
    category: "base",
    title: "能工巧匠",
    description: "在基地制造 20 次道具。",
    titles: ["能工巧匠"],
  },
  { id: "tech-all", category: "base", title: "科技先驱", description: "解锁全部科技节点。" },
  { id: "base-expand", category: "base", title: "大兴土木", description: "基地设施等级总和达到 12。" },
  {
    id: "battle-fifty",
    category: "battle",
    title: "久经沙场",
    description: "累计赢得 50 场战斗。",
    titles: ["百战勇者"],
  },
  {
    id: "boss-all",
    category: "battle",
    title: "星屿讨伐者",
    description: "击败全部主线首领。",
    titles: ["星屿讨伐者"],
  },
  { id: "elite-two", category: "battle", title: "迎难而上", description: "击败全部精英训练者。" },
  {
    id: "tower-clear",
    category: "challenge",
    title: "登塔之巅",
    description: "通关试炼塔的全部 10 层。",
    titles: ["试炼征服者"],
  },
  { id: "rematch-one", category: "challenge", title: "再战强敌", description: "完成一次首领强化重战。" },
  { id: "score-high", category: "challenge", title: "巅峰时刻", description: "任意挑战最佳评分达到 600。" },
];

export const achievementsById = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));

/** 记录一条累计统计（用于配种/制造类成就），重复调用累加。 */
export function recordEndgameStat(save: GameSave, key: string, amount = 1): GameSave {
  const count = Math.max(1, Math.floor(amount));
  return {
    ...save,
    endgame: {
      ...save.endgame,
      stats: { ...save.endgame.stats, [key]: (save.endgame.stats[key] ?? 0) + count },
    },
  };
}

/** 计算当前存档满足的全部成就 id（纯计算，不修改存档）。 */
export function evaluateAchievements(save: GameSave, species: readonly Pal[]): string[] {
  const ownedSpecies = new Set(save.ownedPals.map((pal) => pal.speciesId));
  const totalSpecies = species.length;
  const dexRatio = totalSpecies > 0 ? ownedSpecies.size / totalSpecies : 0;
  const techTotal = 5;
  const facilityLevelTotal = save.base.placedFacilities.reduce((sum, item) => sum + item.level, 0);
  const challengeScores = Object.values(save.endgame.bestScores);
  const unlocked: string[] = [];
  const criteria: Record<string, boolean> = {
    "dex-quarter": dexRatio >= 0.25,
    "dex-half": dexRatio >= 0.5,
    "dex-complete": dexRatio >= 0.75,
    "discover-ten": save.progress.discoveredLocationIds.length >= 10,
    "explore-all": save.progress.unlockedRegions.length >= 3,
    "chest-three": save.progress.claimedWorldRewardIds.length >= 3,
    "hatch-ten": (save.endgame.stats.incubated ?? 0) >= 10,
    "radiant-egg": save.breedingEggs.some((egg) => egg.quality === "radiant"),
    "craft-twenty": (save.endgame.stats.crafted ?? 0) >= 20,
    "tech-all": save.base.techIds.length >= techTotal,
    "base-expand": facilityLevelTotal >= 12,
    "battle-fifty": save.progress.battlesWon >= 50,
    "boss-all": save.progress.defeatedBossIds.length >= 4,
    "elite-two": save.progress.defeatedEliteIds.length >= 2,
    "tower-clear": save.endgame.towerFloorsCleared >= TOWER_TOTAL_FLOORS,
    "rematch-one": save.endgame.rematchRewardsClaimed.length >= 1,
    "score-high": challengeScores.some((score) => score >= 600),
  };
  for (const [id, met] of Object.entries(criteria)) {
    if (met) unlocked.push(id);
  }
  return unlocked;
}

/** 刷新成就：解锁新达成的成就并授予对应称号（幂等）。 */
export function refreshAchievements(save: GameSave, species: readonly Pal[]): GameSave {
  const metIds = evaluateAchievements(save, species);
  const newlyMet = metIds.filter((id) => !save.endgame.unlockedAchievementIds.includes(id));
  if (newlyMet.length === 0) return save;
  const gainedTitles = newlyMet.flatMap((id) => achievementsById.get(id)?.titles ?? []);
  return {
    ...save,
    endgame: {
      ...save.endgame,
      unlockedAchievementIds: [
        ...save.endgame.unlockedAchievementIds,
        ...new Set(newlyMet.filter((id) => achievementsById.has(id))),
      ],
      unlockedTitles: [...new Set([...save.endgame.unlockedTitles, ...gainedTitles])],
    },
  };
}

export function getOwnedTitles(save: GameSave): string[] {
  return save.endgame.unlockedTitles;
}

/** 装备称号（必须已拥有，null 表示卸下）。 */
export function equipTitle(save: GameSave, titleId: string | null): GameSave {
  if (titleId !== null && !save.endgame.unlockedTitles.includes(titleId)) return save;
  return { ...save, endgame: { ...save.endgame, equippedTitleId: titleId } };
}

export function isAchievementUnlocked(save: GameSave, achievementId: string): boolean {
  return save.endgame.unlockedAchievementIds.includes(achievementId);
}
