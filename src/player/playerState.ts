import type { Pal } from "../types/pal";

export const SAVE_VERSION = 1;
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
}

export interface GameSave {
  version: typeof SAVE_VERSION;
  ownedPals: PalInstance[];
  teamIds: string[];
  progress: GameProgress;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createEmptySave(): GameSave {
  return {
    version: SAVE_VERSION,
    ownedPals: [],
    teamIds: [],
    progress: { battlesWon: 0, captures: 0 },
  };
}

export function createPalInstance(
  pal: Pal,
  idFactory: () => string = () => crypto.randomUUID(),
  now: () => string = () => new Date().toISOString()
): PalInstance {
  return {
    uid: idFactory(),
    speciesId: pal.id,
    level: 1,
    experience: 0,
    currentHp: pal.stats.hp,
    passiveSkillIds: [],
    capturedAt: now(),
  };
}

function isPalInstance(value: unknown): value is PalInstance {
  if (!value || typeof value !== "object") return false;
  const pal = value as Partial<PalInstance>;
  return typeof pal.uid === "string"
    && Number.isInteger(pal.speciesId)
    && Number.isInteger(pal.level)
    && Number.isFinite(pal.experience)
    && Number.isFinite(pal.currentHp)
    && Array.isArray(pal.passiveSkillIds)
    && typeof pal.capturedAt === "string";
}

function migrateSave(value: unknown): GameSave {
  if (!value || typeof value !== "object") return createEmptySave();
  const raw = value as Record<string, unknown>;
  const ownedPals = Array.isArray(raw.ownedPals)
    ? raw.ownedPals.filter(isPalInstance)
    : [];
  const ownedIds = new Set(ownedPals.map((pal) => pal.uid));
  const teamIds = Array.isArray(raw.teamIds)
    ? raw.teamIds.filter((id): id is string => typeof id === "string" && ownedIds.has(id)).slice(0, TEAM_LIMIT)
    : [];
  const progress = raw.progress && typeof raw.progress === "object"
    ? raw.progress as Partial<GameProgress>
    : {};

  return {
    version: SAVE_VERSION,
    ownedPals,
    teamIds: [...new Set(teamIds)],
    progress: {
      battlesWon: Number.isFinite(progress.battlesWon) ? Math.max(0, Math.floor(progress.battlesWon!)) : 0,
      captures: Number.isFinite(progress.captures) ? Math.max(0, Math.floor(progress.captures!)) : ownedPals.length,
    },
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
