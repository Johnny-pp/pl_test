import type { GameSave, NewGamePlusOptions } from "../player/playerState.ts";

export type NgpOptionKey = keyof NewGamePlusOptions;

export const NGP_OPTION_LABELS: Record<NgpOptionKey, string> = {
  randomEncounters: "随机遭遇：野外敌人等级在区域下限附近随机波动",
  restrictedCapture: "限制捕获：捕获只能消耗高级捕获器",
  permadeath: "永久倒下：战斗中倒下的个体无法再出战",
};

export function isNgpEnabled(save: GameSave, option: NgpOptionKey): boolean {
  return save.endgame.newGamePlus[option] === true;
}

export function toggleNgpOption(save: GameSave, option: NgpOptionKey): GameSave {
  return {
    ...save,
    endgame: {
      ...save.endgame,
      newGamePlus: {
        ...save.endgame.newGamePlus,
        [option]: !save.endgame.newGamePlus[option],
      },
    },
  };
}

export function describeNgpOptions(save: GameSave): string[] {
  return (Object.keys(NGP_OPTION_LABELS) as NgpOptionKey[]).filter((key) => isNgpEnabled(save, key));
}

/** 随机遭遇：开启后野外敌人等级在基础值 ±20% 内波动（保持可复现/可测）。 */
export function ngpEncounterLevel(
  baseLevel: number,
  save: GameSave,
  random: () => number = Math.random
): number {
  if (!isNgpEnabled(save, "randomEncounters")) return baseLevel;
  const variation = Math.round(baseLevel * 0.2 * (random() * 2 - 1));
  return Math.max(1, Math.min(50, baseLevel + variation));
}

/** 限制捕获：开启后只能使用高级捕获器。 */
export function ngpCaptureOrbKind(save: GameSave): "advanced" | "normal" {
  return isNgpEnabled(save, "restrictedCapture") ? "advanced" : "normal";
}

export function canUseCaptureOrb(save: GameSave): boolean {
  const kind = ngpCaptureOrbKind(save);
  if (kind === "advanced") return save.inventory.advancedCaptureOrbs > 0;
  return save.inventory.captureOrbs > 0;
}

/** 永久倒下：将战斗中倒下的个体移出存档（装备物品本身保留在背包中）。 */
export function applyPermadeath(save: GameSave, downedUids: readonly string[]): GameSave {
  const dead = new Set(downedUids.filter((uid) => save.ownedPals.some((pal) => pal.uid === uid)));
  if (dead.size === 0) return save;
  const lostUids = [...new Set([...save.endgame.permadeathLostUids, ...dead])];
  return {
    ...save,
    ownedPals: save.ownedPals.filter((pal) => !dead.has(pal.uid)),
    teamIds: save.teamIds.filter((uid) => !dead.has(uid)),
    base: {
      ...save.base,
      assignments: save.base.assignments.filter((assignment) => !dead.has(assignment.palUid)),
    },
    endgame: {
      ...save.endgame,
      permadeathLostUids: lostUids,
    },
  };
}
