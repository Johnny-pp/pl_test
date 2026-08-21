import type { Pal } from "../types/pal.ts";
import type { EquipmentItem, EquipmentSlot } from "../types/skillTree.ts";
import { isWorldRegion, STARTING_REGION, type WorldRegion } from "../world/regions.ts";
import { loadSettings, SAVE_SLOT_COUNT } from "../settings/settings.ts";

export const SAVE_VERSION = 11;
export const TEAM_LIMIT = 6;
export const SAVE_STORAGE_KEY = "pl_test_game_save";
export const LEGACY_SAVE_KEY = "pl_test_game_save";
export const SAVE_SLOT_KEY_PREFIX = "pl_test_game_save_slot_";
export const AUTO_BACKUP_KEY = "pl_test_game_save_auto_backup";
export const RESTORE_PREFIX = "pl_test_game_restore_";

export function getSaveSlotStorageKey(slot: number): string {
  const safeSlot = Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, Math.floor(slot)));
  // 槽位 0 复用旧存档键，保证旧浏览器测试与既有 localStorage 无缝兼容。
  return safeSlot === 0 ? LEGACY_SAVE_KEY : `${SAVE_SLOT_KEY_PREFIX}${safeSlot}`;
}

export interface PalInstance {
  uid: string;
  speciesId: number;
  level: number;
  experience: number;
  currentHp: number;
  passiveSkillIds: string[];
  capturedAt: string;
  /** Skill tree nodes unlocked by spending skill points. */
  unlockedNodeIds: string[];
  /** Active skill ids the individual currently has equipped (max 4). */
  equippedSkillIds: string[];
  /** Equipped equipment by slot, referencing inventory equipment item uids. */
  equipment: Partial<Record<EquipmentSlot, string>>;
}

export interface GameProgress {
  battlesWon: number;
  captures: number;
  unlockedRegions: WorldRegion[];
  quests: QuestState[];
  defeatedBossIds: string[];
  unlockedAbilities: string[];
  discoveredLocationIds: string[];
  claimedWorldRewardIds: string[];
  activatedWaypointIds: string[];
  revealedSectorIds: string[];
  /** 支线任务进度。 */
  sideQuests: SideQuestState[];
  /** 已对话过的 NPC 标识，用于持久化对话与支线激活。 */
  talkedNpcIds: string[];
  /** 已首次击败的精英/训练者标识。 */
  defeatedEliteIds: string[];
  /** 已开启的探索机关门标识。 */
  openedGateIds: string[];
  /** 商店限量商品的已售罄库存记录（shopStockId -> 剩余数量）。 */
  shopStock: Record<string, number>;
  /** 精英/训练者最近一次被击败的时间戳。 */
  eliteDefeatTimes: Record<string, number>;
}

export interface NewGamePlusOptions {
  /** 随机遭遇：野外敌人等级在区域下限附近随机化。 */
  randomEncounters: boolean;
  /** 限制捕获：捕获只能消耗高级捕获器。 */
  restrictedCapture: boolean;
  /** 永久倒下：战斗中倒下的个体无法再出战。 */
  permadeath: boolean;
}

/** 每日/每周委托的周期状态。 */
export interface PeriodChallengeState {
  /** 周期标识，例如 "daily-2026-08-21" 或 "weekly-2026-W34"。 */
  periodKey: string;
  /** 周期内已记录的事件计数（eventType -> count）。 */
  events: Record<string, number>;
  /** 本周期已领取的奖励标识。 */
  claimedRewardIds: string[];
}

export interface EndgameProgress {
  /** 试炼塔已通过的层数。 */
  towerFloorsCleared: number;
  /** 试炼塔已领取的阶段奖励（楼层标识）。 */
  towerRewardsClaimed: string[];
  /** 各挑战的最佳评分（challengeId -> 最佳分）。 */
  bestScores: Record<string, number>;
  /** 每日/每周委托的周期状态。 */
  periodChallenges: PeriodChallengeState[];
  /** 已领取的首领强化重战一次性奖励。 */
  rematchRewardsClaimed: string[];
  /** 已解锁的成就标识。 */
  unlockedAchievementIds: string[];
  /** 已获得的可展示称号。 */
  unlockedTitles: string[];
  /** 当前装备的称号标识。 */
  equippedTitleId: string | null;
  /** 新周目选项。 */
  newGamePlus: NewGamePlusOptions;
  /** 永久倒下移除的个体 uid（用于展示，不参与战斗）。 */
  permadeathLostUids: string[];
  /** 累计统计计数（key -> 累计值），用于成就判定，例如孵化数、制造数。 */
  stats: Record<string, number>;
}

export interface QuestState {
  id: string;
  progress: Record<string, number>;
  rewardClaimed: boolean;
}

export interface SideQuestState {
  id: string;
  progress: Record<string, number>;
  rewardClaimed: boolean;
}

const QUEST_IDS = [
  "frontier-preparation",
  "highland-survey",
  "storm-lord-challenge",
  "startide-voyage",
  "abyssal-colossus-challenge",
] as const;

function createInitialQuestStates(battlesWon = 0, captures = 0): QuestState[] {
  return QUEST_IDS.map((id) => {
    const progress: Record<string, number> =
      id === "frontier-preparation"
        ? { "battle-win": Math.min(3, battlesWon), capture: Math.min(2, captures) }
        : {};
    return { id, progress, rewardClaimed: false };
  });
}
export type BaseJob = "planting" | "mining" | "lumbering" | "generating";
export type FacilityId = "warehouse" | "farm" | "workshop" | "forge" | "assembly";

export interface BaseAssignment {
  palUid: string;
  job: BaseJob;
}

/** 已放置到基地网格上的设施实例。 */
export interface PlacedFacility {
  facilityId: FacilityId;
  level: number;
  gridX: number;
  gridY: number;
}

/** 基地订单状态（可重复完成的资源消耗目标）。 */
export interface BaseOrderState {
  id: string;
  claimedCount: number;
}

export interface BaseState {
  resources: {
    wood: number;
    stone: number;
    food: number;
    fiber: number;
    crystal: number;
    ore: number;
    metal: number;
  };
  assignments: BaseAssignment[];
  facilities: Record<FacilityId, number>;
  /** 基地网格上已放置的设施（默认布局由旧存档迁移生成）。 */
  placedFacilities: PlacedFacility[];
  /** 已解锁的科技节点标识。 */
  techIds: string[];
  /** 基地订单进度。 */
  orders: BaseOrderState[];
  lastUpdatedAt: number;
}

export interface PlayerInventory {
  captureOrbs: number;
  healingTonics: number;
  equipment: EquipmentItem[];
  /** 通用货币“星币”。 */
  coins: number;
  /** 击败幻兽获得的掉落物库存（掉落物名称 -> 数量）。 */
  materials: Record<string, number>;
  /** 高级捕获器（加工链产物）。 */
  advancedCaptureOrbs: number;
}

export type EggQuality = "common" | "fine" | "radiant";

export interface BreedingEgg {
  id: string;
  parentUids: [string, string];
  speciesId: number;
  passiveSkillIds: string[];
  quality: EggQuality;
  createdAt: number;
  hatchAt: number;
}

export interface GameSave {
  version: typeof SAVE_VERSION;
  ownedPals: PalInstance[];
  teamIds: string[];
  progress: GameProgress;
  inventory: PlayerInventory;
  base: BaseState;
  breedingEggs: BreedingEgg[];
  /** 终局挑战与重复游玩进度。 */
  endgame: EndgameProgress;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  length?: number;
  key?(index: number): string | null;
}

function createInstanceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `pal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyEndgameProgress(): EndgameProgress {
  return {
    towerFloorsCleared: 0,
    towerRewardsClaimed: [],
    bestScores: {},
    periodChallenges: [],
    rematchRewardsClaimed: [],
    unlockedAchievementIds: [],
    unlockedTitles: [],
    equippedTitleId: null,
    newGamePlus: {
      randomEncounters: false,
      restrictedCapture: false,
      permadeath: false,
    },
    permadeathLostUids: [],
    stats: {},
  };
}

function normalizeEndgameProgress(value: unknown): EndgameProgress {
  const raw = value && typeof value === "object" ? (value as Partial<EndgameProgress>) : {};
  const rawNgp =
    raw.newGamePlus && typeof raw.newGamePlus === "object"
      ? (raw.newGamePlus as Partial<NewGamePlusOptions>)
      : {};
  const normalizePeriodChallenges = (value: unknown): PeriodChallengeState[] => {
    const rawList: unknown[] = Array.isArray(value) ? value : [];
    return rawList
      .map((entry): PeriodChallengeState | undefined => {
        if (!entry || typeof entry !== "object") return undefined;
        const item = entry as Partial<PeriodChallengeState>;
        if (typeof item.periodKey !== "string" || item.periodKey.length === 0) return undefined;
        return {
          periodKey: item.periodKey,
          events: normalizeStock(item.events),
          claimedRewardIds: normalizeStringIds(item.claimedRewardIds),
        };
      })
      .filter((entry): entry is PeriodChallengeState => Boolean(entry));
  };
  return {
    towerFloorsCleared: Math.max(0, Math.min(999, finiteCount(raw.towerFloorsCleared))),
    towerRewardsClaimed: normalizeStringIds(raw.towerRewardsClaimed),
    bestScores: normalizeStock(raw.bestScores),
    periodChallenges: normalizePeriodChallenges(raw.periodChallenges),
    rematchRewardsClaimed: normalizeStringIds(raw.rematchRewardsClaimed),
    unlockedAchievementIds: normalizeStringIds(raw.unlockedAchievementIds),
    unlockedTitles: normalizeStringIds(raw.unlockedTitles),
    equippedTitleId: typeof raw.equippedTitleId === "string" ? raw.equippedTitleId : null,
    newGamePlus: {
      randomEncounters: rawNgp.randomEncounters === true,
      restrictedCapture: rawNgp.restrictedCapture === true,
      permadeath: rawNgp.permadeath === true,
    },
    permadeathLostUids: normalizeStringIds(raw.permadeathLostUids),
    stats: normalizeStock(raw.stats),
  };
}

export function createEmptySave(now = Date.now()): GameSave {
  return {
    version: SAVE_VERSION,
    ownedPals: [],
    teamIds: [],
    progress: {
      battlesWon: 0,
      captures: 0,
      unlockedRegions: [STARTING_REGION],
      quests: createInitialQuestStates(),
      defeatedBossIds: [],
      unlockedAbilities: [],
      discoveredLocationIds: [],
      claimedWorldRewardIds: [],
      activatedWaypointIds: [],
      revealedSectorIds: [],
      sideQuests: [],
      talkedNpcIds: [],
      defeatedEliteIds: [],
      openedGateIds: [],
      shopStock: {},
      eliteDefeatTimes: {},
    },
    inventory: {
      captureOrbs: 3,
      healingTonics: 0,
      equipment: [],
      coins: 30,
      materials: {},
      advancedCaptureOrbs: 0,
    },
    base: {
      resources: { wood: 20, stone: 10, food: 20, fiber: 10, crystal: 0, ore: 0, metal: 0 },
      assignments: [],
      facilities: { warehouse: 1, farm: 1, workshop: 1, forge: 0, assembly: 0 },
      placedFacilities: [
        { facilityId: "warehouse", level: 1, gridX: 0, gridY: 0 },
        { facilityId: "farm", level: 1, gridX: 2, gridY: 0 },
        { facilityId: "workshop", level: 1, gridX: 0, gridY: 2 },
      ],
      techIds: [],
      orders: [],
      lastUpdatedAt: now,
    },
    breedingEggs: [],
    endgame: createEmptyEndgameProgress(),
  };
}

export function createPalInstance(
  pal: Pal,
  idFactory: () => string = createInstanceId,
  now: () => string = () => new Date().toISOString(),
  passiveSkillIds: string[] = []
): PalInstance {
  return {
    uid: idFactory(),
    speciesId: pal.id,
    level: 1,
    experience: 0,
    currentHp: pal.stats.hp,
    passiveSkillIds: [...passiveSkillIds],
    capturedAt: now(),
    unlockedNodeIds: [],
    equippedSkillIds: (pal.activeSkills ?? []).slice(0, 4),
    equipment: {},
  };
}

function isPalInstance(value: unknown): value is PalInstance {
  if (!value || typeof value !== "object") return false;
  const pal = value as Partial<PalInstance>;
  return (
    typeof pal.uid === "string" &&
    Number.isInteger(pal.speciesId) &&
    Number.isInteger(pal.level) &&
    Number.isFinite(pal.experience) &&
    Number.isFinite(pal.currentHp) &&
    Array.isArray(pal.passiveSkillIds) &&
    typeof pal.capturedAt === "string"
  );
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = ["core", "charm", "armor"];

function normalizeEquipment(value: unknown): Partial<Record<EquipmentSlot, string>> {
  const equipment: Partial<Record<EquipmentSlot, string>> = {};
  if (!value || typeof value !== "object") return equipment;
  const raw = value as Record<string, unknown>;
  for (const slot of EQUIPMENT_SLOTS) {
    const uid = raw[slot];
    if (typeof uid === "string" && uid.length > 0) equipment[slot] = uid;
  }
  return equipment;
}

function normalizePalInstance(pal: PalInstance): PalInstance {
  return {
    ...pal,
    level: Math.max(1, Math.min(50, Math.floor(pal.level))),
    experience: Math.max(0, Math.floor(pal.experience)),
    currentHp: Math.max(0, Math.floor(pal.currentHp)),
    passiveSkillIds: pal.passiveSkillIds.filter((id): id is string => typeof id === "string"),
    unlockedNodeIds: normalizeStringIds(pal.unlockedNodeIds),
    equippedSkillIds: normalizeStringIds(pal.equippedSkillIds).slice(0, 4),
    equipment: normalizeEquipment(pal.equipment),
  };
}

function finiteCount(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}

function finiteAmount(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor((value as number) * 10) / 10) : fallback;
}

function normalizeStringIds(value: unknown): string[] {
  return [
    ...new Set(
      (Array.isArray(value) ? value : []).filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    ),
  ];
}

function normalizeStock(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.length > 0)
      .map(([key, amount]) => [key, finiteCount(amount)])
  );
}

function migrateSave(value: unknown, now = Date.now()): GameSave {
  if (!value || typeof value !== "object") return createEmptySave(now);
  const raw = value as Record<string, unknown>;
  const ownedPals = Array.isArray(raw.ownedPals)
    ? raw.ownedPals.filter(isPalInstance).map(normalizePalInstance)
    : [];
  const ownedIds = new Set(ownedPals.map((pal) => pal.uid));
  const teamIds = Array.isArray(raw.teamIds)
    ? raw.teamIds
        .filter((id): id is string => typeof id === "string" && ownedIds.has(id))
        .slice(0, TEAM_LIMIT)
    : [];
  const progress =
    raw.progress && typeof raw.progress === "object" ? (raw.progress as Partial<GameProgress>) : {};
  const rawInventory =
    raw.inventory && typeof raw.inventory === "object" ? (raw.inventory as Partial<PlayerInventory>) : {};
  const rawEquipment = Array.isArray(rawInventory.equipment) ? rawInventory.equipment : [];
  const equipmentItems = rawEquipment.filter((item): item is EquipmentItem => {
    if (!item || typeof item !== "object") return false;
    const entry = item as Partial<EquipmentItem>;
    return typeof entry.uid === "string" && typeof entry.equipmentId === "string";
  });
  const rawBase = raw.base && typeof raw.base === "object" ? (raw.base as Partial<BaseState>) : {};
  const rawResources =
    rawBase.resources && typeof rawBase.resources === "object"
      ? (rawBase.resources as Partial<BaseState["resources"]>)
      : {};
  const battlesWon = Number.isFinite(progress.battlesWon) ? Math.max(0, Math.floor(progress.battlesWon!)) : 0;
  const captures = Number.isFinite(progress.captures)
    ? Math.max(0, Math.floor(progress.captures!))
    : ownedPals.length;
  const rawQuests: unknown[] = Array.isArray(progress.quests) ? progress.quests : [];
  const quests = createInitialQuestStates(battlesWon, captures).map((fallback) => {
    const value = rawQuests.find(
      (quest): quest is Partial<QuestState> =>
        Boolean(quest) && typeof quest === "object" && (quest as Partial<QuestState>).id === fallback.id
    );
    if (!value) return fallback;
    const rawQuestProgress =
      value.progress && typeof value.progress === "object" ? value.progress : fallback.progress;
    return {
      id: fallback.id,
      progress: Object.fromEntries(
        Object.entries(rawQuestProgress).map(([key, amount]) => [key, finiteCount(amount)])
      ),
      rewardClaimed: value.rewardClaimed === true,
    };
  });
  const rawFacilities =
    rawBase.facilities && typeof rawBase.facilities === "object"
      ? (rawBase.facilities as Partial<BaseState["facilities"]>)
      : {};
  const validJobs = new Set<BaseJob>(["planting", "mining", "lumbering", "generating"]);
  const assignments = Array.isArray(rawBase.assignments)
    ? rawBase.assignments.filter((assignment): assignment is BaseAssignment => {
        if (!assignment || typeof assignment !== "object") return false;
        const item = assignment as Partial<BaseAssignment>;
        return (
          typeof item.palUid === "string" &&
          ownedIds.has(item.palUid) &&
          typeof item.job === "string" &&
          validJobs.has(item.job as BaseJob)
        );
      })
    : [];
  const breedingEggs = Array.isArray(raw.breedingEggs)
    ? raw.breedingEggs.filter((egg): egg is BreedingEgg => {
        if (!egg || typeof egg !== "object") return false;
        const item = egg as Partial<BreedingEgg>;
        return (
          typeof item.id === "string" &&
          Array.isArray(item.parentUids) &&
          item.parentUids.length === 2 &&
          item.parentUids.every((uid) => typeof uid === "string" && ownedIds.has(uid)) &&
          Number.isInteger(item.speciesId) &&
          Array.isArray(item.passiveSkillIds) &&
          ["common", "fine", "radiant"].includes(item.quality ?? "") &&
          Number.isFinite(item.createdAt) &&
          Number.isFinite(item.hatchAt)
        );
      })
    : [];
  const rawSideQuests: unknown[] = Array.isArray(progress.sideQuests) ? progress.sideQuests : [];
  const sideQuests = rawSideQuests
    .map((value) => {
      if (!value || typeof value !== "object") return undefined;
      const item = value as Partial<SideQuestState>;
      if (typeof item.id !== "string" || item.id.length === 0) return undefined;
      const rawProgress = item.progress && typeof item.progress === "object" ? item.progress : {};
      return {
        id: item.id,
        progress: Object.fromEntries(
          Object.entries(rawProgress).map(([key, amount]) => [key, finiteCount(amount)])
        ),
        rewardClaimed: item.rewardClaimed === true,
      };
    })
    .filter((item): item is SideQuestState => Boolean(item));
  const normalizeIdList = (value: unknown): string[] => normalizeStringIds(value);
  const validFacilityIds = new Set<FacilityId>(["warehouse", "farm", "workshop", "forge", "assembly"]);
  const normalizePlacedFacilities = (
    value: unknown,
    legacyFacilities?: Partial<BaseState["facilities"]>
  ): PlacedFacility[] => {
    const rawList: unknown[] = Array.isArray(value) ? value : [];
    const placed = rawList
      .map((entry): PlacedFacility | undefined => {
        if (!entry || typeof entry !== "object") return undefined;
        const item = entry as Partial<PlacedFacility>;
        if (typeof item.facilityId !== "string" || !validFacilityIds.has(item.facilityId as FacilityId))
          return undefined;
        return {
          facilityId: item.facilityId as FacilityId,
          level: Math.max(1, Math.min(5, Math.floor(item.level ?? 1))),
          gridX: Number.isInteger(item.gridX) ? Math.max(0, item.gridX!) : 0,
          gridY: Number.isInteger(item.gridY) ? Math.max(0, item.gridY!) : 0,
        };
      })
      .filter((entry): entry is PlacedFacility => Boolean(entry));
    if (placed.length > 0) return placed;
    const legacy = legacyFacilities ?? {};
    const defaults: PlacedFacility[] = [
      { facilityId: "warehouse", level: Math.max(1, finiteCount(legacy.warehouse, 1)), gridX: 0, gridY: 0 },
      { facilityId: "farm", level: Math.max(1, finiteCount(legacy.farm, 1)), gridX: 2, gridY: 0 },
      { facilityId: "workshop", level: Math.max(1, finiteCount(legacy.workshop, 1)), gridX: 0, gridY: 2 },
    ];
    if (finiteCount(legacy.forge) > 0)
      defaults.push({ facilityId: "forge", level: finiteCount(legacy.forge), gridX: 2, gridY: 2 });
    if (finiteCount(legacy.assembly) > 0)
      defaults.push({ facilityId: "assembly", level: finiteCount(legacy.assembly), gridX: 4, gridY: 2 });
    return defaults;
  };
  const normalizeBaseOrders = (value: unknown): BaseOrderState[] => {
    const rawList: unknown[] = Array.isArray(value) ? value : [];
    return rawList
      .map((entry): BaseOrderState | undefined => {
        if (!entry || typeof entry !== "object") return undefined;
        const item = entry as Partial<BaseOrderState>;
        if (typeof item.id !== "string" || item.id.length === 0) return undefined;
        return { id: item.id, claimedCount: Math.max(0, finiteCount(item.claimedCount)) };
      })
      .filter((entry): entry is BaseOrderState => Boolean(entry));
  };

  return {
    version: SAVE_VERSION,
    ownedPals,
    teamIds: [...new Set(teamIds)],
    progress: {
      battlesWon,
      captures,
      unlockedRegions: [
        STARTING_REGION,
        ...new Set(
          (Array.isArray(progress.unlockedRegions) ? progress.unlockedRegions : []).filter(
            (region): region is WorldRegion => isWorldRegion(region) && region !== STARTING_REGION
          )
        ),
      ],
      quests,
      defeatedBossIds: [
        ...new Set(
          (Array.isArray(progress.defeatedBossIds) ? progress.defeatedBossIds : []).filter(
            (id): id is string => typeof id === "string"
          )
        ),
      ],
      unlockedAbilities: [
        ...new Set(
          (Array.isArray(progress.unlockedAbilities) ? progress.unlockedAbilities : []).filter(
            (id): id is string => typeof id === "string"
          )
        ),
      ],
      discoveredLocationIds: normalizeStringIds(progress.discoveredLocationIds),
      claimedWorldRewardIds: normalizeStringIds(progress.claimedWorldRewardIds),
      activatedWaypointIds: normalizeStringIds(progress.activatedWaypointIds),
      revealedSectorIds: normalizeStringIds(progress.revealedSectorIds),
      sideQuests,
      talkedNpcIds: normalizeIdList(progress.talkedNpcIds),
      defeatedEliteIds: normalizeIdList(progress.defeatedEliteIds),
      openedGateIds: normalizeIdList(progress.openedGateIds),
      shopStock: normalizeStock(progress.shopStock),
      eliteDefeatTimes: normalizeStock(progress.eliteDefeatTimes),
    },
    inventory: {
      captureOrbs: finiteCount(rawInventory.captureOrbs, 3),
      healingTonics: finiteCount(rawInventory.healingTonics),
      equipment: [...new Map(equipmentItems.map((item) => [item.uid, item])).values()],
      coins: finiteCount(rawInventory.coins, 30),
      materials: normalizeStock(rawInventory.materials),
      advancedCaptureOrbs: finiteCount(rawInventory.advancedCaptureOrbs),
    },
    base: {
      resources: {
        wood: finiteAmount(rawResources.wood, 20),
        stone: finiteAmount(rawResources.stone, 10),
        food: finiteAmount(rawResources.food, 20),
        fiber: finiteAmount(rawResources.fiber, 10),
        crystal: finiteAmount(rawResources.crystal),
        ore: finiteAmount(rawResources.ore),
        metal: finiteAmount(rawResources.metal),
      },
      assignments: assignments.filter(
        (item, index) => assignments.findIndex((candidate) => candidate.palUid === item.palUid) === index
      ),
      facilities: {
        warehouse: Math.max(1, finiteCount(rawFacilities.warehouse, 1)),
        farm: Math.max(1, finiteCount(rawFacilities.farm, 1)),
        workshop: Math.max(1, finiteCount(rawFacilities.workshop, 1)),
        forge: Math.max(0, finiteCount(rawFacilities.forge)),
        assembly: Math.max(0, finiteCount(rawFacilities.assembly)),
      },
      placedFacilities: normalizePlacedFacilities(
        rawBase.placedFacilities,
        rawBase.facilities as Partial<BaseState["facilities"]> | undefined
      ),
      techIds: normalizeIdList(rawBase.techIds),
      orders: normalizeBaseOrders(rawBase.orders),
      lastUpdatedAt: Number.isFinite(rawBase.lastUpdatedAt) ? rawBase.lastUpdatedAt! : now,
    },
    breedingEggs,
    endgame: normalizeEndgameProgress(raw.endgame),
  };
}

export function loadGame(storage: StorageLike): GameSave {
  const slot = loadSettings(storage).saveSlot;
  const key = getSaveSlotStorageKey(slot);
  try {
    let raw = storage.getItem(key);
    if (raw === null && slot === 0) raw = storage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return createEmptySave();
    return migrateSave(JSON.parse(raw));
  } catch {
    return createEmptySave();
  }
}

export function saveGame(storage: StorageLike, save: GameSave): boolean {
  try {
    const slot = loadSettings(storage).saveSlot;
    const key = getSaveSlotStorageKey(slot);
    const previous = storage.getItem(key);
    if (previous !== null) storage.setItem(AUTO_BACKUP_KEY, previous);
    storage.setItem(key, JSON.stringify(migrateSave(save)));
    return true;
  } catch {
    return false;
  }
}

/** 读取最近一次保存前的自动备份。 */
export function loadAutoBackup(storage: StorageLike): GameSave | undefined {
  try {
    const raw = storage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return undefined;
    return migrateSave(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export interface SaveSlotInfo {
  slot: number;
  hasSave: boolean;
  ownedCount: number;
  highestLevel: number;
}

/** 列出全部存档槽位的基本信息。 */
export function listSaveSlots(storage: StorageLike): SaveSlotInfo[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, slot) => {
    const key = getSaveSlotStorageKey(slot);
    let raw = storage.getItem(key);
    if (raw === null && slot === 0) raw = storage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return { slot, hasSave: false, ownedCount: 0, highestLevel: 0 };
    try {
      const save = migrateSave(JSON.parse(raw));
      return {
        slot,
        hasSave: true,
        ownedCount: save.ownedPals.length,
        highestLevel: save.ownedPals.reduce((max, pal) => Math.max(max, pal.level), 0),
      };
    } catch {
      return { slot, hasSave: false, ownedCount: 0, highestLevel: 0 };
    }
  });
}

/** 删除指定槽位的存档（不会删除恢复点）。 */
export function deleteSaveSlot(storage: StorageLike, slot: number): boolean {
  try {
    storage.setItem(getSaveSlotStorageKey(slot), "");
    if (slot === 0) storage.setItem(LEGACY_SAVE_KEY, "");
    return true;
  } catch {
    return false;
  }
}

/** 把一个槽位的存档复制到另一个槽位（目标已有内容时保留并覆盖）。 */
export function copySaveSlot(storage: StorageLike, from: number, to: number): boolean {
  if (from === to) return false;
  try {
    const source = storage.getItem(getSaveSlotStorageKey(from));
    let raw = source;
    if (raw === null && from === 0) raw = storage.getItem(LEGACY_SAVE_KEY);
    if (raw === null) return false;
    storage.setItem(getSaveSlotStorageKey(to), raw);
    return true;
  } catch {
    return false;
  }
}

/** 创建命名恢复点，保存当前槽位存档的副本。 */
export function createRestorePoint(storage: StorageLike, label: string): boolean {
  const cleanLabel = label.trim();
  if (cleanLabel.length === 0) return false;
  try {
    const slot = loadSettings(storage).saveSlot;
    const raw = storage.getItem(getSaveSlotStorageKey(slot));
    if (raw === null && slot === 0) storage.getItem(LEGACY_SAVE_KEY);
    storage.setItem(`${RESTORE_PREFIX}${cleanLabel}`, raw ?? JSON.stringify(createEmptySave()));
    return true;
  } catch {
    return false;
  }
}

/** 列出全部命名恢复点。 */
export function listRestorePoints(storage: StorageLike): string[] {
  const points: string[] = [];
  const length = storage.length ?? 0;
  for (let index = 0; index < length; index += 1) {
    const key = storage.key?.(index) ?? "";
    if (key.startsWith(RESTORE_PREFIX)) points.push(key.slice(RESTORE_PREFIX.length));
  }
  return points.sort();
}

/** 从命名恢复点覆盖当前槽位（不会删除恢复点）。 */
export function restoreFromPoint(storage: StorageLike, label: string): GameSave | undefined {
  try {
    const raw = storage.getItem(`${RESTORE_PREFIX}${label}`);
    if (!raw) return undefined;
    const save = migrateSave(JSON.parse(raw));
    const slot = loadSettings(storage).saveSlot;
    storage.setItem(getSaveSlotStorageKey(slot), JSON.stringify(save));
    return save;
  } catch {
    return undefined;
  }
}

export function exportSaveBackup(save: GameSave): string {
  return JSON.stringify(migrateSave(save), null, 2);
}

export function importSaveBackup(raw: string): GameSave | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return undefined;
    const candidate = value as Record<string, unknown>;
    if (!Array.isArray(candidate.ownedPals) || !Array.isArray(candidate.teamIds)) return undefined;
    return migrateSave(candidate);
  } catch {
    return undefined;
  }
}

export function addCapturedPal(save: GameSave, pal: PalInstance): GameSave {
  if (save.ownedPals.some((owned) => owned.uid === pal.uid)) return save;
  const autoJoin = save.teamIds.length < TEAM_LIMIT;
  return {
    ...save,
    ownedPals: [...save.ownedPals, pal],
    teamIds: autoJoin ? [...save.teamIds, pal.uid] : [...save.teamIds],
    progress: { ...save.progress, captures: save.progress.captures + 1 },
  };
}

export function recordBattleWin(save: GameSave): GameSave {
  return {
    ...save,
    progress: { ...save.progress, battlesWon: save.progress.battlesWon + 1 },
  };
}

export function toggleTeamMember(save: GameSave, uid: string): GameSave {
  if (!save.ownedPals.some((pal) => pal.uid === uid)) return save;
  if (save.teamIds.includes(uid)) {
    return { ...save, teamIds: save.teamIds.filter((id) => id !== uid) };
  }
  if (save.teamIds.length >= TEAM_LIMIT) return save;
  return { ...save, teamIds: [...save.teamIds, uid] };
}

export function updatePalCurrentHp(save: GameSave, uid: string, hp: number): GameSave {
  if (!save.ownedPals.some((pal) => pal.uid === uid)) return save;
  return {
    ...save,
    ownedPals: save.ownedPals.map((pal) =>
      pal.uid === uid ? { ...pal, currentHp: Math.max(0, Math.floor(hp)) } : pal
    ),
  };
}

export function addCoins(save: GameSave, amount: number): GameSave {
  const coins = Math.max(0, Math.floor(amount));
  if (coins === 0) return save;
  return { ...save, inventory: { ...save.inventory, coins: save.inventory.coins + coins } };
}

export function addMaterial(save: GameSave, material: string, amount = 1): GameSave {
  const count = Math.max(0, Math.floor(amount));
  if (count === 0 || !material) return save;
  return {
    ...save,
    inventory: {
      ...save.inventory,
      materials: {
        ...save.inventory.materials,
        [material]: (save.inventory.materials[material] ?? 0) + count,
      },
    },
  };
}
