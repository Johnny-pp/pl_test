import type { GameSave } from "../player/playerState";

export type WorldRegion = "frontier" | "cloudridge-highlands";

export const STARTING_REGION: WorldRegion = "frontier";
export const HIGHLAND_REGION: WorldRegion = "cloudridge-highlands";

export const HIGHLAND_UNLOCK_REQUIREMENTS = {
  battlesWon: 3,
  captures: 2,
  resources: { wood: 30, stone: 20, crystal: 5 },
} as const;

export interface RegionUnlockStatus {
  unlocked: boolean;
  eligible: boolean;
  missing: string[];
}

export function isWorldRegion(value: unknown): value is WorldRegion {
  return value === STARTING_REGION || value === HIGHLAND_REGION;
}

export function getHighlandUnlockStatus(save: GameSave): RegionUnlockStatus {
  if (save.progress.unlockedRegions.includes(HIGHLAND_REGION)) {
    return { unlocked: true, eligible: true, missing: [] };
  }
  const missing: string[] = [];
  const requirements = HIGHLAND_UNLOCK_REQUIREMENTS;
  if (save.progress.battlesWon < requirements.battlesWon)
    missing.push(`胜利 ${save.progress.battlesWon}/${requirements.battlesWon}`);
  if (save.progress.captures < requirements.captures)
    missing.push(`捕获 ${save.progress.captures}/${requirements.captures}`);
  for (const [resource, amount] of Object.entries(requirements.resources)) {
    const current = save.base.resources[resource as keyof typeof requirements.resources];
    if (current < amount) {
      const label = resource === "wood" ? "木材" : resource === "stone" ? "石材" : "晶体";
      missing.push(`${label} ${current}/${amount}`);
    }
  }
  return { unlocked: false, eligible: missing.length === 0, missing };
}

export function unlockHighlandRegion(save: GameSave): GameSave {
  const status = getHighlandUnlockStatus(save);
  if (status.unlocked || !status.eligible) return save;
  const costs = HIGHLAND_UNLOCK_REQUIREMENTS.resources;
  return {
    ...save,
    progress: {
      ...save.progress,
      unlockedRegions: [...save.progress.unlockedRegions, HIGHLAND_REGION],
    },
    base: {
      ...save.base,
      resources: {
        ...save.base.resources,
        wood: save.base.resources.wood - costs.wood,
        stone: save.base.resources.stone - costs.stone,
        crystal: save.base.resources.crystal - costs.crystal,
      },
    },
  };
}
