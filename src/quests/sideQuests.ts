import type { GameSave, SideQuestState } from "../player/playerState.ts";
import { STARTIDE_REGION, type WorldRegion } from "../world/regions.ts";
import type { QuestState } from "../player/playerState.ts";

export type SideQuestEventType =
  | "talk"
  | "gather"
  | "craft"
  | "battle-win"
  | "capture"
  | "sell"
  | "buy"
  | "ability-use"
  | "open-chest"
  | "elite-win"
  | "discover"
  | "collect";

export interface SideQuestEvent {
  type: SideQuestEventType;
  region?: WorldRegion;
  npcId?: string;
  eliteId?: string;
  material?: string;
}

export interface SideQuestGoal {
  id: string;
  type: SideQuestEventType;
  label: string;
  target: number;
  region?: WorldRegion;
  npcId?: string;
  eliteId?: string;
  material?: string;
}

export interface SideQuestDefinition {
  id: string;
  title: string;
  description: string;
  prerequisites: string[];
  requiredRegion?: WorldRegion;
  giverNpcId?: string;
  goals: SideQuestGoal[];
  rewardLabel: string;
  rewards: {
    coins?: number;
    resources?: Partial<GameSave["base"]["resources"]>;
    captureOrbs?: number;
    healingTonics?: number;
    abilities?: string[];
    equipment?: string[];
  };
}

export type SideQuestStatus = "locked" | "active" | "complete" | "claimed";

export interface SideQuestView {
  definition: SideQuestDefinition;
  state: SideQuestState;
  status: SideQuestStatus;
}

export const SIDE_QUEST_DEFINITIONS: SideQuestDefinition[] = [
  {
    id: "side-reedlight-prayer",
    title: "芦灯萤语",
    description: "与芦灯港的渔人交谈，再为长明灯采集一些群岛素材。",
    prerequisites: ["storm-lord-challenge"],
    requiredRegion: STARTIDE_REGION,
    giverNpcId: "npc-tao",
    goals: [
      { id: "talk-tao", type: "talk", label: "与渔人交谈", target: 1, npcId: "npc-tao" },
      {
        id: "gather-startide",
        type: "gather",
        label: "采集群岛素材",
        target: 3,
        region: STARTIDE_REGION,
      },
    ],
    rewardLabel: "星币 80、捕获器 1",
    rewards: { coins: 80, captureOrbs: 1 },
  },
  {
    id: "side-herb-mist",
    title: "雾潮采药",
    description: "在辉沼湿地收集三份掉落素材，交给疗愈师调配药水。",
    prerequisites: ["storm-lord-challenge"],
    requiredRegion: STARTIDE_REGION,
    giverNpcId: "npc-ying",
    goals: [{ id: "collect-materials", type: "collect", label: "收集掉落素材", target: 3 }],
    rewardLabel: "星币 60、治疗剂 3",
    rewards: { coins: 60, healingTonics: 3 },
  },
  {
    id: "side-tide-memory",
    title: "潮音回响",
    description: "记录群岛上的潮位碑与地标，再回基地完成一次制造。",
    prerequisites: ["side-reedlight-prayer"],
    requiredRegion: STARTIDE_REGION,
    giverNpcId: "npc-bo",
    goals: [
      {
        id: "discover-startide",
        type: "discover",
        label: "发现群岛地点",
        target: 2,
        region: STARTIDE_REGION,
      },
      { id: "craft-any", type: "craft", label: "制造任意道具", target: 1 },
    ],
    rewardLabel: "星币 100、治疗剂 2",
    rewards: { coins: 100, healingTonics: 2 },
  },
  {
    id: "side-merchant-deal",
    title: "商旅的委托",
    description: "帮芦灯港的商贩周转两件货物，再从店里采购一件用品。",
    prerequisites: ["side-reedlight-prayer"],
    requiredRegion: STARTIDE_REGION,
    giverNpcId: "npc-alu",
    goals: [
      { id: "sell-any", type: "sell", label: "向商店出售货物", target: 2 },
      { id: "buy-any", type: "buy", label: "从商店购买用品", target: 1 },
    ],
    rewardLabel: "星币 140",
    rewards: { coins: 140 },
  },
  {
    id: "side-sunken-keeper",
    title: "沉星守望者",
    description: "击败盘踞在群岛深处的训练者，并赢得两场野外战斗。",
    prerequisites: ["side-tide-memory"],
    requiredRegion: STARTIDE_REGION,
    giverNpcId: "npc-xi",
    goals: [
      {
        id: "elite-win",
        type: "elite-win",
        label: "击败精英训练者",
        target: 1,
      },
      {
        id: "battle-startide",
        type: "battle-win",
        label: "在群岛获胜",
        target: 2,
        region: STARTIDE_REGION,
      },
    ],
    rewardLabel: "星币 150、晶体 10",
    rewards: { coins: 150, resources: { crystal: 10 } },
  },
  {
    id: "side-shallow-secret",
    title: "退潮秘径",
    description: "用幻兽的探索能力打开一处机关，再取走退潮后露出的宝箱。",
    prerequisites: ["side-sunken-keeper"],
    requiredRegion: STARTIDE_REGION,
    giverNpcId: "npc-tao",
    goals: [
      { id: "open-gate", type: "ability-use", label: "开启探索机关", target: 1 },
      { id: "open-chest", type: "open-chest", label: "开启机关宝箱", target: 1 },
    ],
    rewardLabel: "星币 120、护符「守护图腾符」",
    rewards: { coins: 120, equipment: ["charm-ward-totem"] },
  },
];

function sideStateFor(save: GameSave, questId: string): SideQuestState {
  return (
    save.progress.sideQuests.find((quest) => quest.id === questId) ?? {
      id: questId,
      progress: {},
      rewardClaimed: false,
    }
  );
}

function mainQuestClaimed(save: GameSave, questId: string): boolean {
  return (save.progress.quests.find((quest) => quest.id === questId) as QuestState | undefined)
    ?.rewardClaimed === true;
}

function sidePrerequisitesMet(save: GameSave, quest: SideQuestDefinition): boolean {
  return quest.prerequisites.every((id) => {
    const side = sideStateFor(save, id);
    if (side.rewardClaimed) return true;
    return mainQuestClaimed(save, id);
  });
}

function sideQuestIsComplete(state: SideQuestState, quest: SideQuestDefinition): boolean {
  return quest.goals.every((goal) => (state.progress[goal.id] ?? 0) >= goal.target);
}

export function getSideQuestViews(save: GameSave): SideQuestView[] {
  return SIDE_QUEST_DEFINITIONS.map((definition) => {
    const state = sideStateFor(save, definition.id);
    let status: SideQuestStatus = "locked";
    if (state.rewardClaimed) status = "claimed";
    else if (
      sidePrerequisitesMet(save, definition) &&
      (!definition.requiredRegion ||
        save.progress.unlockedRegions.includes(definition.requiredRegion))
    )
      status = sideQuestIsComplete(state, definition) ? "complete" : "active";
    return { definition, state, status };
  });
}

function matchesSideGoal(goal: SideQuestGoal, event: SideQuestEvent): boolean {
  return (
    goal.type === event.type &&
    (!goal.region || goal.region === event.region) &&
    (!goal.npcId || goal.npcId === event.npcId) &&
    (!goal.eliteId || goal.eliteId === event.eliteId) &&
    (!goal.material || goal.material === event.material)
  );
}

export function recordSideQuestEvent(save: GameSave, event: SideQuestEvent): GameSave {
  const activeViews = getSideQuestViews(save).filter((view) => view.status === "active");
  if (activeViews.length === 0) return save;
  let changed = false;
  const existing = new Map(save.progress.sideQuests.map((state) => [state.id, state]));
  const sideQuests = SIDE_QUEST_DEFINITIONS.map((definition) => {
    const state = existing.get(definition.id) ?? sideStateFor(save, definition.id);
    const view = activeViews.find((item) => item.definition.id === definition.id);
    if (!view) return state;
    const progress = { ...state.progress };
    for (const goal of view.definition.goals) {
      if (!matchesSideGoal(goal, event)) continue;
      const current = progress[goal.id] ?? 0;
      const next = Math.min(goal.target, current + 1);
      if (next !== current) {
        progress[goal.id] = next;
        changed = true;
      }
    }
    return changed ? { ...state, progress } : state;
  });
  return changed ? { ...save, progress: { ...save.progress, sideQuests } } : save;
}

export function recordNpcTalk(save: GameSave, npcId: string): GameSave {
  if (save.progress.talkedNpcIds.includes(npcId)) return save;
  const next = {
    ...save,
    progress: {
      ...save.progress,
      talkedNpcIds: [...save.progress.talkedNpcIds, npcId],
    },
  };
  return recordSideQuestEvent(next, { type: "talk", npcId });
}

export function recordEliteVictory(save: GameSave, eliteId: string): GameSave {
  return recordSideQuestEvent(save, { type: "elite-win", eliteId });
}

export function claimSideQuestReward(save: GameSave, questId: string): GameSave {
  const view = getSideQuestViews(save).find((item) => item.definition.id === questId);
  if (!view || view.status !== "complete") return save;
  const rewards = view.definition.rewards;
  const resources = { ...save.base.resources };
  for (const [resource, amount] of Object.entries(rewards.resources ?? {})) {
    resources[resource as keyof typeof resources] += amount ?? 0;
  }
  const existing = new Map(save.progress.sideQuests.map((state) => [state.id, state]));
  const sideQuests = SIDE_QUEST_DEFINITIONS.map((definition) => {
    const state = existing.get(definition.id) ?? sideStateFor(save, definition.id);
    return state.id === questId ? { ...state, rewardClaimed: true } : state;
  });
  return {
    ...save,
    progress: {
      ...save.progress,
      sideQuests,
      unlockedAbilities: [
        ...new Set([...save.progress.unlockedAbilities, ...(rewards.abilities ?? [])]),
      ],
    },
    inventory: {
      ...save.inventory,
      coins: save.inventory.coins + (rewards.coins ?? 0),
      captureOrbs: save.inventory.captureOrbs + (rewards.captureOrbs ?? 0),
      healingTonics: save.inventory.healingTonics + (rewards.healingTonics ?? 0),
      equipment: [
        ...save.inventory.equipment,
        ...(rewards.equipment ?? []).map((equipmentId) => ({
          uid: `sidequest-${questId}-${equipmentId}`,
          equipmentId,
        })),
      ],
    },
    base: { ...save.base, resources },
  };
}
