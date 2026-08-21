import type { GameSave, PalInstance } from "../player/playerState.ts";
import type { Pal } from "../types/pal.ts";

/**
 * 挑战限制：用于试炼塔、首领重战与每日委托。
 * 限制影响出战队伍选择，不修改存档数据本身。
 */
export interface ChallengeRestrictions {
  /** 只允许包含这些元素的个体出战。 */
  elementWhitelist?: readonly ElementType[];
  /** 最大出战人数。 */
  maxTeamSize?: number;
  /** 最低稀有度（包含）。 */
  minRarity?: number;
  /** 禁止在挑战中使用捕获。 */
  noCapture?: boolean;
}

type ElementType = Pal["elements"][number];

export const ELEMENT_LABELS: Record<ElementType, string> = {
  neutral: "无",
  fire: "火",
  water: "水",
  grass: "草",
  electric: "电",
  ice: "冰",
  ground: "地",
  wind: "风",
  dark: "暗",
  dragon: "龙",
  rock: "岩",
  normal: "普通",
};

export function describeRestrictions(restrictions?: ChallengeRestrictions): string[] {
  if (!restrictions) return [];
  const lines: string[] = [];
  if (restrictions.elementWhitelist?.length) {
    lines.push(`限用元素：${restrictions.elementWhitelist.map((e) => ELEMENT_LABELS[e]).join("/")}`);
  }
  if (restrictions.maxTeamSize !== undefined) {
    lines.push(`队伍上限：${restrictions.maxTeamSize} 只`);
  }
  if (restrictions.minRarity !== undefined) {
    lines.push(`稀有度不低于：${"★".repeat(restrictions.minRarity)}`);
  }
  if (restrictions.noCapture) lines.push("禁止捕获");
  return lines;
}

/** 个体是否满足元素限制（无限制时全部通过）。 */
export function instancePassesRestrictions(
  species: Pal,
  instance: PalInstance,
  restrictions?: ChallengeRestrictions
): boolean {
  if (!restrictions) return true;
  if (restrictions.elementWhitelist?.length) {
    if (!species.elements.some((element) => restrictions.elementWhitelist!.includes(element))) return false;
  }
  if (restrictions.minRarity !== undefined && species.rarity < restrictions.minRarity) return false;
  return true;
}

/**
 * 校验出战队伍是否满足限制，返回缺失说明。
 * valid 为 false 时不能进入挑战。
 */
export function validateChallengeTeam(
  save: GameSave,
  species: readonly Pal[],
  restrictions?: ChallengeRestrictions
): { valid: boolean; missing: string[] } {
  if (!restrictions) return { valid: true, missing: [] };
  const missing: string[] = [];
  const owned = new Set(save.teamIds.filter((uid) => save.ownedPals.some((pal) => pal.uid === uid)));
  if (owned.size === 0) {
    missing.push("队伍中没有幻兽");
    return { valid: false, missing };
  }
  if (restrictions.maxTeamSize !== undefined && owned.size > restrictions.maxTeamSize) {
    missing.push(`最多 ${restrictions.maxTeamSize} 只，当前 ${owned.size} 只`);
  }
  if (restrictions.elementWhitelist?.length || restrictions.minRarity !== undefined) {
    const offenders = [...owned].filter((uid) => {
      const instance = save.ownedPals.find((pal) => pal.uid === uid)!;
      const pal = species.find((entry) => entry.id === instance.speciesId);
      return pal ? !instancePassesRestrictions(pal, instance, restrictions) : true;
    });
    if (offenders.length > 0) missing.push(`${offenders.length} 只幻兽不满足元素/稀有度限制`);
  }
  return { valid: missing.length === 0, missing };
}

/**
 * 从出战队伍中筛选出满足限制的成员，用于构建战斗。
 * 至少保留一只（不满足时返回空数组，由调用方阻止进入）。
 */
export function filterTeamForRestrictions(
  save: GameSave,
  species: readonly Pal[],
  restrictions?: ChallengeRestrictions
): PalInstance[] {
  const ownedById = new Map(save.ownedPals.map((pal) => [pal.uid, pal]));
  const members = save.teamIds
    .map((uid) => ownedById.get(uid))
    .filter((instance): instance is PalInstance => Boolean(instance));
  if (!restrictions) return members;
  const filtered = members.filter((instance) => {
    const pal = species.find((entry) => entry.id === instance.speciesId);
    return pal ? instancePassesRestrictions(pal, instance, restrictions) : false;
  });
  return filtered;
}
