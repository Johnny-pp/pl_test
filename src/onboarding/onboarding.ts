/** 新手引导：按实际进度逐步介绍核心系统，可跳过并持久化。 */

export const ONBOARDING_STORAGE_KEY = "pl_test_onboarding";

export interface OnboardingStep {
  id: string;
  title: string;
  text: string;
  /** 跳转提示的目标场景（可为空）。 */
  scene?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "capture",
    title: "捕获成功",
    text: "已捕获幻兽！前往「队伍」页查看并编组你的伙伴。",
    scene: "TeamScene",
  },
  {
    id: "team",
    title: "编组队伍",
    text: "队伍页可调整出战顺序、使用治疗剂，并管理存档槽与备份。",
  },
  {
    id: "base",
    title: "基地生产",
    text: "在基地为幻兽分配岗位，可持续生产木材、石材、食物等资源。",
    scene: "BaseScene",
  },
  {
    id: "breeding",
    title: "配种孵化",
    text: "共鸣孵化所可让两只幻兽配种，后代继承部分被动技能。",
    scene: "BreedingScene",
  },
  {
    id: "build",
    title: "个体构筑",
    text: "构筑页可解锁技能树节点、配置主动技能并穿戴装备。",
    scene: "BuildScene",
  },
  {
    id: "quest",
    title: "任务奖励",
    text: "任务页提供连续目标，完成任务后记得领取奖励。",
    scene: "QuestScene",
  },
  {
    id: "endgame",
    title: "终局试炼",
    text: "完成主线后，试炼塔、首领重战与周期委托提供长期挑战。",
    scene: "EndgameScene",
  },
];

export interface OnboardingState {
  skipped: boolean;
  /** 已发生的引导事件（进入过对应场景或完成关键动作）。 */
  triggeredIds: string[];
  /** 玩家已确认阅读的引导。 */
  completedIds: string[];
}

export function createEmptyOnboardingState(): OnboardingState {
  return { skipped: false, triggeredIds: [], completedIds: [] };
}

function normalizeOnboarding(value: unknown): OnboardingState {
  const defaults = createEmptyOnboardingState();
  if (!value || typeof value !== "object") return defaults;
  const raw = value as Partial<OnboardingState>;
  const stringList = (input: unknown): string[] =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === "string") : [];
  return {
    skipped: raw.skipped === true,
    triggeredIds: stringList(raw.triggeredIds),
    completedIds: stringList(raw.completedIds),
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadOnboarding(storage: StorageLike): OnboardingState {
  try {
    const raw = storage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return createEmptyOnboardingState();
    return normalizeOnboarding(JSON.parse(raw));
  } catch {
    return createEmptyOnboardingState();
  }
}

function persist(storage: StorageLike, state: OnboardingState): void {
  storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
}

export function isOnboardingSkipped(storage: StorageLike): boolean {
  return loadOnboarding(storage).skipped;
}

/** 标记一个引导步骤已发生（进入对应场景或完成动作）。 */
export function triggerOnboardingStep(storage: StorageLike, stepId: string): void {
  const state = loadOnboarding(storage);
  if (state.triggeredIds.includes(stepId)) return;
  persist(storage, { ...state, triggeredIds: [...state.triggeredIds, stepId] });
}

export function isOnboardingStepTriggered(storage: StorageLike, stepId: string): boolean {
  return loadOnboarding(storage).triggeredIds.includes(stepId);
}

/** 玩家确认阅读后标记完成。 */
export function completeOnboardingStep(storage: StorageLike, stepId: string): void {
  const state = loadOnboarding(storage);
  if (state.completedIds.includes(stepId)) return;
  persist(storage, { ...state, completedIds: [...state.completedIds, stepId] });
}

/** 跳过全部引导。 */
export function skipOnboarding(storage: StorageLike): void {
  persist(storage, { ...loadOnboarding(storage), skipped: true });
}

/** 待展示的引导步骤：已触发但尚未阅读且未跳过。 */
export function getPendingOnboardingStep(storage: StorageLike): OnboardingStep | undefined {
  const state = loadOnboarding(storage);
  if (state.skipped) return undefined;
  return ONBOARDING_STEPS.find(
    (step) => state.triggeredIds.includes(step.id) && !state.completedIds.includes(step.id)
  );
}
