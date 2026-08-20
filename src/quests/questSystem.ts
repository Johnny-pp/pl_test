import type { GameSave, QuestState } from "../player/playerState";
import { HIGHLAND_REGION, STARTIDE_REGION, type WorldRegion } from "../world/regions.ts";

export type QuestEventType = "battle-win" | "capture" | "gather" | "craft" | "boss-win";

export interface QuestEvent {
  type: QuestEventType;
  region?: WorldRegion;
  bossId?: string;
}

export interface QuestGoal {
  id: string;
  type: QuestEventType;
  label: string;
  target: number;
  region?: WorldRegion;
  bossId?: string;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  prerequisites: string[];
  requiredRegion?: WorldRegion;
  goals: QuestGoal[];
  rewardLabel: string;
  rewards: {
    resources?: Partial<GameSave["base"]["resources"]>;
    captureOrbs?: number;
    healingTonics?: number;
    abilities?: string[];
  };
}

export type QuestStatus = "locked" | "active" | "complete" | "claimed";

export interface QuestView {
  definition: QuestDefinition;
  state: QuestState;
  status: QuestStatus;
}

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: "frontier-preparation",
    title: "远征准备",
    description: "在晴风边境磨炼队伍，为翻越高地积累物资。",
    prerequisites: [],
    goals: [
      { id: "battle-win", type: "battle-win", label: "赢得战斗", target: 3 },
      { id: "capture", type: "capture", label: "捕获幻兽", target: 2 },
    ],
    rewardLabel: "木材 30、石材 20、晶体 5",
    rewards: { resources: { wood: 30, stone: 20, crystal: 5 } },
  },
  {
    id: "highland-survey",
    title: "云脊踏勘",
    description: "进入云脊高地，采集当地素材并在基地完成一次制造。",
    prerequisites: ["frontier-preparation"],
    requiredRegion: HIGHLAND_REGION,
    goals: [
      { id: "highland-gather", type: "gather", label: "采集高地素材", target: 3, region: HIGHLAND_REGION },
      { id: "craft", type: "craft", label: "制造任意道具", target: 1 },
    ],
    rewardLabel: "捕获器 1、治疗剂 2",
    rewards: { captureOrbs: 1, healingTonics: 2 },
  },
  {
    id: "storm-lord-challenge",
    title: "风暴领主",
    description: "前往风暴山脊祭坛，击败会在半血时强化的岚角羚首领。",
    prerequisites: ["highland-survey"],
    requiredRegion: HIGHLAND_REGION,
    goals: [
      {
        id: "storm-lord",
        type: "boss-win",
        label: "击败风暴领主",
        target: 1,
        bossId: "storm-lord",
      },
    ],
    rewardLabel: "晶体 20、能力「岚印锻造」",
    rewards: { resources: { crystal: 20 }, abilities: ["storm-forging"] },
  },
  {
    id: "startide-voyage",
    title: "星潮远航",
    description: "修复渡门后深入星潮群岛，采集群岛素材并赢得数场战斗。",
    prerequisites: ["storm-lord-challenge"],
    requiredRegion: STARTIDE_REGION,
    goals: [
      {
        id: "startide-gather",
        type: "gather",
        label: "采集星潮素材",
        target: 3,
        region: STARTIDE_REGION,
      },
      {
        id: "startide-battle",
        type: "battle-win",
        label: "在星潮群岛获胜",
        target: 4,
        region: STARTIDE_REGION,
      },
    ],
    rewardLabel: "捕获器 2、治疗剂 3",
    rewards: { captureOrbs: 2, healingTonics: 3 },
  },
  {
    id: "abyssal-colossus-challenge",
    title: "沉星终章",
    description: "前往沉星遗迹核心，击败半血强化的晦曜巨像终章首领。",
    prerequisites: ["startide-voyage"],
    requiredRegion: STARTIDE_REGION,
    goals: [
      {
        id: "abyssal-colossus",
        type: "boss-win",
        label: "击败沉星终章首领",
        target: 1,
        bossId: "abyssal-colossus",
      },
    ],
    rewardLabel: "晶体 30、能力「星潮引航」",
    rewards: { resources: { crystal: 30 }, abilities: ["tide-navigation"] },
  },
];

function stateFor(save: GameSave, questId: string): QuestState {
  return (
    save.progress.quests.find((quest) => quest.id === questId) ?? {
      id: questId,
      progress: {},
      rewardClaimed: false,
    }
  );
}

function prerequisitesMet(save: GameSave, quest: QuestDefinition): boolean {
  return quest.prerequisites.every((id) => stateFor(save, id).rewardClaimed);
}

function questIsComplete(state: QuestState, quest: QuestDefinition): boolean {
  return quest.goals.every((goal) => (state.progress[goal.id] ?? 0) >= goal.target);
}

export function getQuestViews(save: GameSave): QuestView[] {
  return QUEST_DEFINITIONS.map((definition) => {
    const state = stateFor(save, definition.id);
    let status: QuestStatus = "locked";
    if (state.rewardClaimed) status = "claimed";
    else if (
      prerequisitesMet(save, definition) &&
      (!definition.requiredRegion || save.progress.unlockedRegions.includes(definition.requiredRegion))
    )
      status = questIsComplete(state, definition) ? "complete" : "active";
    return { definition, state, status };
  });
}

function matchesGoal(goal: QuestGoal, event: QuestEvent): boolean {
  return (
    goal.type === event.type &&
    (!goal.region || goal.region === event.region) &&
    (!goal.bossId || goal.bossId === event.bossId)
  );
}

export function recordQuestEvent(save: GameSave, event: QuestEvent): GameSave {
  const activeViews = getQuestViews(save).filter((view) => view.status === "active");
  let changed = false;
  const quests = save.progress.quests.map((state) => {
    const view = activeViews.find((item) => item.definition.id === state.id);
    if (!view) return state;
    const progress = { ...state.progress };
    for (const goal of view.definition.goals) {
      if (!matchesGoal(goal, event)) continue;
      const current = progress[goal.id] ?? 0;
      const next = Math.min(goal.target, current + 1);
      if (next !== current) {
        progress[goal.id] = next;
        changed = true;
      }
    }
    return changed ? { ...state, progress } : state;
  });
  return changed ? { ...save, progress: { ...save.progress, quests } } : save;
}

export function recordBossVictory(save: GameSave, bossId: string): GameSave {
  if (save.progress.defeatedBossIds.includes(bossId)) return save;
  const defeated = {
    ...save,
    progress: {
      ...save.progress,
      defeatedBossIds: [...save.progress.defeatedBossIds, bossId],
    },
  };
  return recordQuestEvent(defeated, { type: "boss-win", bossId });
}

export function claimQuestReward(save: GameSave, questId: string): GameSave {
  const view = getQuestViews(save).find((item) => item.definition.id === questId);
  if (!view || view.status !== "complete") return save;
  const rewards = view.definition.rewards;
  const resources = { ...save.base.resources };
  for (const [resource, amount] of Object.entries(rewards.resources ?? {})) {
    resources[resource as keyof typeof resources] += amount ?? 0;
  }
  return {
    ...save,
    progress: {
      ...save.progress,
      quests: save.progress.quests.map((state) =>
        state.id === questId ? { ...state, rewardClaimed: true } : state
      ),
      unlockedAbilities: [...new Set([...save.progress.unlockedAbilities, ...(rewards.abilities ?? [])])],
    },
    inventory: {
      ...save.inventory,
      captureOrbs: save.inventory.captureOrbs + (rewards.captureOrbs ?? 0),
      healingTonics: save.inventory.healingTonics + (rewards.healingTonics ?? 0),
    },
    base: { ...save.base, resources },
  };
}

export function canChallengeBoss(save: GameSave, bossId: string): boolean {
  if (save.progress.defeatedBossIds.includes(bossId)) return false;
  return getQuestViews(save).some(
    (view) => view.status === "active" && view.definition.goals.some((goal) => goal.bossId === bossId)
  );
}
