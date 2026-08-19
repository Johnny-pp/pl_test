import type { Pal } from "../types/pal";
import { isWorldRegion, STARTING_REGION, type WorldRegion } from "../world/regions.ts";

export const SAVE_VERSION = 6;
export const TEAM_LIMIT = 6;
export const SAVE_STORAGE_KEY = "pl_test_game_save";

export interface PalInstance {
  uid: string;
  speciesId: number;
  level: number;
  experience: number;
  currentHp: number;
  passiveSkillIds: string[];
  capturedAt: string;
}

export interface GameProgress {
  battlesWon: number;
  captures: number;
  unlockedRegions: WorldRegion[];
  quests: QuestState[];
  defeatedBossIds: string[];
  unlockedAbilities: string[];
}

export interface QuestState {
  id: string;
  progress: Record<string, number>;
  rewardClaimed: boolean;
}

const QUEST_IDS = ["frontier-preparation", "highland-survey", "storm-lord-challenge"] as const;

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
export type FacilityId = "warehouse" | "farm" | "workshop";

export interface BaseAssignment {
  palUid: string;
  job: BaseJob;
}

export interface BaseState {
  resources: {
    wood: number;
    stone: number;
    food: number;
    fiber: number;
    crystal: number;
  };
  assignments: BaseAssignment[];
  facilities: Record<FacilityId, number>;
  lastUpdatedAt: number;
}

export interface PlayerInventory {
  captureOrbs: number;
  healingTonics: number;
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
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function createInstanceId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `pal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    },
    inventory: { captureOrbs: 3, healingTonics: 0 },
    base: {
      resources: { wood: 20, stone: 10, food: 20, fiber: 10, crystal: 0 },
      assignments: [],
      facilities: { warehouse: 1, farm: 1, workshop: 1 },
      lastUpdatedAt: now,
    },
    breedingEggs: [],
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

function normalizePalInstance(pal: PalInstance): PalInstance {
  return {
    ...pal,
    level: Math.max(1, Math.min(50, Math.floor(pal.level))),
    experience: Math.max(0, Math.floor(pal.experience)),
    currentHp: Math.max(0, Math.floor(pal.currentHp)),
    passiveSkillIds: pal.passiveSkillIds.filter((id): id is string => typeof id === "string"),
  };
}

function finiteCount(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : fallback;
}

function finiteAmount(value: unknown, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor((value as number) * 10) / 10) : fallback;
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
  const inventory =
    raw.inventory && typeof raw.inventory === "object" ? (raw.inventory as Partial<PlayerInventory>) : {};
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
    },
    inventory: {
      captureOrbs: finiteCount(inventory.captureOrbs, 3),
      healingTonics: finiteCount(inventory.healingTonics),
    },
    base: {
      resources: {
        wood: finiteAmount(rawResources.wood, 20),
        stone: finiteAmount(rawResources.stone, 10),
        food: finiteAmount(rawResources.food, 20),
        fiber: finiteAmount(rawResources.fiber, 10),
        crystal: finiteAmount(rawResources.crystal),
      },
      assignments: assignments.filter(
        (item, index) => assignments.findIndex((candidate) => candidate.palUid === item.palUid) === index
      ),
      facilities: {
        warehouse: Math.max(1, finiteCount(rawFacilities.warehouse, 1)),
        farm: Math.max(1, finiteCount(rawFacilities.farm, 1)),
        workshop: Math.max(1, finiteCount(rawFacilities.workshop, 1)),
      },
      lastUpdatedAt: Number.isFinite(rawBase.lastUpdatedAt) ? rawBase.lastUpdatedAt! : now,
    },
    breedingEggs,
  };
}

export function loadGame(storage: StorageLike): GameSave {
  try {
    const raw = storage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createEmptySave();
    return migrateSave(JSON.parse(raw));
  } catch {
    return createEmptySave();
  }
}

export function saveGame(storage: StorageLike, save: GameSave): boolean {
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(migrateSave(save)));
    return true;
  } catch {
    return false;
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
