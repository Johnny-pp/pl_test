import { TILE_SIZE } from "../world/worldMap.ts";
import type { GameSave } from "../player/playerState.ts";
import type { Pal } from "../types/pal.ts";
import { recordSideQuestEvent } from "../quests/sideQuests.ts";

export interface ExploreGate {
  id: string;
  x: number;
  y: number;
  label: string;
  requiredAbility: string;
  /** 开启后揭示的隐藏宝箱 id（可选，与 hiddenChest 对应）。 */
  chestId?: string;
  /** 开启后揭示的一次性发现地点 id（可选）。 */
  discoveryId?: string;
}

export interface HiddenChest {
  id: string;
  x: number;
  y: number;
  label: string;
  requiredGate: string;
  rewards: {
    coins?: number;
    resources?: Partial<Record<"wood" | "stone" | "food" | "fiber" | "crystal", number>>;
    captureOrbs?: number;
    healingTonics?: number;
    equipment?: string[];
  };
}

export const EXPLORE_GATES: ExploreGate[] = [
  {
    id: "startide-gate-vine",
    x: 17 * TILE_SIZE,
    y: 10 * TILE_SIZE,
    label: "藤蔓封径",
    requiredAbility: "vine-cut",
    chestId: "startide-chest-hidden-vine",
  },
  {
    id: "startide-gate-rock",
    x: 31 * TILE_SIZE,
    y: 17 * TILE_SIZE,
    label: "落岩洞隙",
    requiredAbility: "rock-break",
    chestId: "startide-chest-hidden-rock",
  },
  {
    id: "startide-gate-wade",
    x: 10 * TILE_SIZE,
    y: 21 * TILE_SIZE,
    label: "退潮浅滩",
    requiredAbility: "wading",
    chestId: "startide-chest-hidden-wade",
  },
  {
    id: "startide-gate-light",
    x: 36 * TILE_SIZE,
    y: 20 * TILE_SIZE,
    label: "幽黑潮洞",
    requiredAbility: "illuminate",
    chestId: "startide-chest-hidden-light",
  },
  {
    id: "startide-gate-glide",
    x: 23 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    label: "潮顶高台",
    requiredAbility: "glide",
    discoveryId: "startide-discovery-glide",
  },
];

export const HIDDEN_CHESTS: HiddenChest[] = [
  {
    id: "startide-chest-hidden-vine",
    x: 19 * TILE_SIZE,
    y: 8 * TILE_SIZE,
    label: "藤蔓后宝箱",
    requiredGate: "startide-gate-vine",
    rewards: { coins: 40, resources: { fiber: 12, food: 8 } },
  },
  {
    id: "startide-chest-hidden-rock",
    x: 33 * TILE_SIZE,
    y: 15 * TILE_SIZE,
    label: "岩隙宝箱",
    requiredGate: "startide-gate-rock",
    rewards: { coins: 50, resources: { stone: 10, crystal: 6 } },
  },
  {
    id: "startide-chest-hidden-wade",
    x: 8 * TILE_SIZE,
    y: 23 * TILE_SIZE,
    label: "浅滩宝箱",
    requiredGate: "startide-gate-wade",
    rewards: { coins: 30, captureOrbs: 1 },
  },
  {
    id: "startide-chest-hidden-light",
    x: 37 * TILE_SIZE,
    y: 18 * TILE_SIZE,
    label: "幽洞宝箱",
    requiredGate: "startide-gate-light",
    rewards: { coins: 45, resources: { crystal: 8, fiber: 15 } },
  },
];

export const GLIDE_DISCOVERY = {
  id: "startide-discovery-glide",
  x: 25 * TILE_SIZE,
  y: 3 * TILE_SIZE,
  label: "潮顶瞭望点",
};

export function getTeamExploreAbilityIds(save: GameSave, speciesById: ReadonlyMap<number, Pal>): Set<string> {
  const abilities = new Set<string>();
  for (const uid of save.teamIds) {
    const instance = save.ownedPals.find((pal) => pal.uid === uid);
    if (!instance) continue;
    const species = speciesById.get(instance.speciesId);
    for (const ability of species?.exploreAbilities ?? []) abilities.add(ability);
  }
  return abilities;
}

export function isGateOpened(save: GameSave, gateId: string): boolean {
  return save.progress.openedGateIds.includes(gateId);
}

export function canOpenGate(
  save: GameSave,
  gate: ExploreGate,
  speciesById: ReadonlyMap<number, Pal>
): boolean {
  if (isGateOpened(save, gate.id)) return false;
  return getTeamExploreAbilityIds(save, speciesById).has(gate.requiredAbility);
}

export function openGate(save: GameSave, gate: ExploreGate, speciesById: ReadonlyMap<number, Pal>): GameSave {
  if (!canOpenGate(save, gate, speciesById)) return save;
  const next = {
    ...save,
    progress: {
      ...save.progress,
      openedGateIds: [...save.progress.openedGateIds, gate.id],
    },
  };
  return recordSideQuestEvent(next, { type: "ability-use" });
}

/** 某隐藏宝箱在对应机关开启后是否可见且尚未领取。 */
export function isHiddenChestAvailable(
  save: GameSave,
  chest: HiddenChest,
  claimedChestIds: Iterable<string>
): boolean {
  if (isGateOpened(save, chest.requiredGate) && ![...claimedChestIds].includes(chest.id)) return true;
  return false;
}
