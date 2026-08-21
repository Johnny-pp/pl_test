import type { GameSave, PeriodChallengeState } from "../player/playerState.ts";
import { hashString, mulberry32, seededInt } from "./seededRandom.ts";

export type ChallengePeriod = "daily" | "weekly";

export type EndgameEventType =
  | "battle-win"
  | "capture"
  | "gather"
  | "craft"
  | "sell"
  | "buy"
  | "elite-win"
  | "tower-floor"
  | "rematch-win"
  | "collect";

export interface EndgameEvent {
  type: EndgameEventType;
  amount?: number;
}

export interface PeriodChallengeGoal {
  id: string;
  type: EndgameEventType;
  label: string;
  target: number;
}

export interface PeriodChallenge {
  id: string;
  periodKey: string;
  period: ChallengePeriod;
  title: string;
  description: string;
  goals: PeriodChallengeGoal[];
  rewardLabel: string;
  rewards: {
    coins?: number;
    resources?: Partial<GameSave["base"]["resources"]>;
    captureOrbs?: number;
    healingTonics?: number;
    advancedCaptureOrbs?: number;
    equipment?: string[];
  };
}

interface GoalTemplate {
  type: EndgameEventType;
  label: string;
  targetRange: readonly [number, number];
}

const GOAL_POOL: GoalTemplate[] = [
  { type: "battle-win", label: "赢得普通战斗", targetRange: [3, 5] },
  { type: "tower-floor", label: "通过试炼塔层数", targetRange: [1, 2] },
  { type: "rematch-win", label: "完成首领强化重战", targetRange: [1, 2] },
  { type: "elite-win", label: "击败精英训练者", targetRange: [1, 2] },
  { type: "capture", label: "捕获幻兽", targetRange: [1, 2] },
  { type: "gather", label: "采集素材", targetRange: [3, 5] },
  { type: "craft", label: "制造道具", targetRange: [1, 2] },
  { type: "sell", label: "向商店出售货物", targetRange: [1, 2] },
  { type: "collect", label: "收集掉落物", targetRange: [2, 3] },
];

const PERIOD_COUNTS: Record<ChallengePeriod, number> = { daily: 3, weekly: 2 };

const DAILY_TITLES = ["潮汐委托", "探索委托", "采集委托", "战斗委托", "捕获委托"];
const WEEKLY_TITLES = ["本周远征", "长期委托"];

/** 构造稳定周期标识：daily-2026-08-21 / weekly-2026-W34。 */
export function periodKeyFor(date: Date, period: ChallengePeriod): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (period === "daily") return `daily-${year}-${month}-${day}`;
  const janFirst = new Date(year, 0, 1);
  const week = Math.ceil(((date.getTime() - janFirst.getTime()) / 86400000 + janFirst.getDay() + 1) / 7);
  return `weekly-${year}-W${week}`;
}

function rewardForTemplate(template: GoalTemplate, random: () => number) {
  switch (template.type) {
    case "battle-win":
      return { coins: 60 + seededInt(random, 0, 4) * 15 };
    case "tower-floor":
      return { coins: 90 + seededInt(random, 0, 4) * 20, resources: { crystal: 6 } as const };
    case "rematch-win":
      return { coins: 150 + seededInt(random, 0, 3) * 25 };
    case "elite-win":
      return { coins: 100 + seededInt(random, 0, 3) * 20, healingTonics: 2 };
    case "capture":
      return { coins: 70 + seededInt(random, 0, 3) * 15, captureOrbs: 1 };
    case "gather":
      return { resources: { wood: 25, stone: 20 } as const };
    case "craft":
      return { coins: 80 + seededInt(random, 0, 3) * 15, healingTonics: 1 };
    case "sell":
      return { coins: 120 + seededInt(random, 0, 4) * 20 };
    case "collect":
      return { coins: 60 + seededInt(random, 0, 3) * 15, captureOrbs: 1 };
    default:
      return { coins: 60 };
  }
}

/** 按日历种子生成本周期的委托内容（同一周期固定可复现）。 */
export function getPeriodChallenges(date: Date, period: ChallengePeriod): PeriodChallenge[] {
  const periodKey = periodKeyFor(date, period);
  const random = mulberry32(hashString(periodKey));
  const count = PERIOD_COUNTS[period];
  const shuffled = [...GOAL_POOL].sort(() => random() - 0.5);
  const titles = period === "daily" ? DAILY_TITLES : WEEKLY_TITLES;
  return Array.from({ length: count }, (_, index) => {
    const template = shuffled[index % shuffled.length];
    const target = seededInt(random, template.targetRange[0], template.targetRange[1]);
    const title = titles[index % titles.length];
    const reward = rewardForTemplate(template, random);
    return {
      id: `${periodKey}-${index}`,
      periodKey,
      period,
      title: `${title}·${template.label}`,
      description: `本周期完成「${template.label}」${target} 次，即可领取对应奖励。`,
      goals: [{ id: template.type, type: template.type, label: template.label, target }],
      rewardLabel:
        `星币 ${reward.coins ?? 0}` +
        (reward.captureOrbs ? `、捕获器 ${reward.captureOrbs}` : "") +
        (reward.healingTonics ? `、治疗剂 ${reward.healingTonics}` : "") +
        (reward.resources
          ? `、${Object.entries(reward.resources)
              .map(
                ([key, value]) => `${key === "wood" ? "木材" : key === "stone" ? "石材" : "晶体"} ${value}`
              )
              .join("、")}`
          : ""),
      rewards: reward as PeriodChallenge["rewards"],
    };
  });
}

/** 获取/创建当前周期的进度状态。 */
function periodStateFor(save: GameSave, periodKey: string): PeriodChallengeState {
  return (
    save.endgame.periodChallenges.find((state) => state.periodKey === periodKey) ?? {
      periodKey,
      events: {},
      claimedRewardIds: [],
    }
  );
}

/** 记录一个终局事件到当前周期（跨日自动切到新周期）。 */
export function recordEndgameEvent(save: GameSave, event: EndgameEvent, now = Date.now()): GameSave {
  if (event.amount === 0) return save;
  const today = periodKeyFor(new Date(now), "daily");
  const week = periodKeyFor(new Date(now), "weekly");
  const state = periodStateFor(save, today);
  const weekState = periodStateFor(save, week);
  const amount = Math.max(1, Math.floor(event.amount ?? 1));
  const apply = (current: PeriodChallengeState): PeriodChallengeState => ({
    ...current,
    events: {
      ...current.events,
      [event.type]: (current.events[event.type] ?? 0) + amount,
    },
  });
  const nextState = apply(state);
  const nextWeekState = apply(weekState);
  const periodChallenges = [...save.endgame.periodChallenges];
  const upsert = (candidate: PeriodChallengeState) => {
    const existingIndex = periodChallenges.findIndex((item) => item.periodKey === candidate.periodKey);
    if (existingIndex >= 0) periodChallenges[existingIndex] = candidate;
    else periodChallenges.push(candidate);
  };
  upsert(nextState);
  if (today !== week) upsert(nextWeekState);
  return { ...save, endgame: { ...save.endgame, periodChallenges } };
}

export interface PeriodChallengeView {
  challenge: PeriodChallenge;
  status: "active" | "complete" | "claimed";
  progress: Record<string, number>;
}

export function getPeriodChallengeViews(save: GameSave, now = Date.now()): PeriodChallengeView[] {
  const today = periodKeyFor(new Date(now), "daily");
  const week = periodKeyFor(new Date(now), "weekly");
  const views: PeriodChallengeView[] = [];
  for (const period of ["daily", "weekly"] as const) {
    const periodKey = period === "daily" ? today : week;
    const challenges = getPeriodChallenges(new Date(now), period);
    const state = periodStateFor(save, periodKey);
    for (const challenge of challenges) {
      const progress: Record<string, number> = {};
      let complete = true;
      for (const goal of challenge.goals) {
        const current = state.events[goal.type] ?? 0;
        progress[goal.type] = Math.min(goal.target, current);
        if (current < goal.target) complete = false;
      }
      const claimed = state.claimedRewardIds.includes(challenge.id);
      views.push({
        challenge,
        status: claimed ? "claimed" : complete ? "complete" : "active",
        progress,
      });
    }
  }
  return views;
}

/** 领取周期委托奖励（幂等，按周期+委托 id 去重）。 */
export function claimPeriodChallengeReward(save: GameSave, challengeId: string, now = Date.now()): GameSave {
  const view = getPeriodChallengeViews(save, now).find((entry) => entry.challenge.id === challengeId);
  if (!view || view.status !== "complete") return save;
  const challenge = view.challenge;
  const state = periodStateFor(save, challenge.periodKey);
  const rewards = challenge.rewards;
  const resources = { ...save.base.resources };
  for (const [resource, amount] of Object.entries(rewards.resources ?? {})) {
    resources[resource as keyof typeof resources] += amount ?? 0;
  }
  const periodChallenges = [...save.endgame.periodChallenges];
  const existingIndex = periodChallenges.findIndex((item) => item.periodKey === challenge.periodKey);
  const updated = {
    ...state,
    claimedRewardIds: [...state.claimedRewardIds, challenge.id],
  };
  if (existingIndex >= 0) periodChallenges[existingIndex] = updated;
  else periodChallenges.push(updated);
  return {
    ...save,
    endgame: { ...save.endgame, periodChallenges },
    inventory: {
      ...save.inventory,
      coins: save.inventory.coins + (rewards.coins ?? 0),
      captureOrbs: save.inventory.captureOrbs + (rewards.captureOrbs ?? 0),
      healingTonics: save.inventory.healingTonics + (rewards.healingTonics ?? 0),
      advancedCaptureOrbs: save.inventory.advancedCaptureOrbs + (rewards.advancedCaptureOrbs ?? 0),
      equipment: [
        ...save.inventory.equipment,
        ...(rewards.equipment ?? []).map((equipmentId) => ({
          uid: `${challenge.id}-${equipmentId}`,
          equipmentId,
        })),
      ],
    },
    base: { ...save.base, resources },
  };
}
