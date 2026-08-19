import type { PalInstance } from "../player/playerState";
import type { Pal, PalGrowth } from "../types/pal";

export const MAX_PAL_LEVEL = 50;

const CURVE_MULTIPLIER: Record<PalGrowth["experienceCurve"], number> = {
  fast: 28,
  medium: 36,
  slow: 46,
};

export interface ProgressionStats {
  maxHp: number;
  attack: number;
  defense: number;
}

export interface ExperienceAward {
  instance: PalInstance;
  gained: number;
  previousLevel: number;
  newLevel: number;
  levelsGained: number;
  previousStats: ProgressionStats;
  newStats: ProgressionStats;
  nextLevelExperience?: number;
}

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(MAX_PAL_LEVEL, Math.floor(level)));
}

export function getTotalExperienceForLevel(level: number, curve: PalGrowth["experienceCurve"]): number {
  const safeLevel = clampLevel(level);
  return CURVE_MULTIPLIER[curve] * (safeLevel - 1) ** 2;
}

export function getLevelForExperience(experience: number, curve: PalGrowth["experienceCurve"]): number {
  const safeExperience = Number.isFinite(experience) ? Math.max(0, Math.floor(experience)) : 0;
  const level = Math.floor(Math.sqrt(safeExperience / CURVE_MULTIPLIER[curve])) + 1;
  return clampLevel(level);
}

export function getProgressionStats(pal: Pal, level: number): ProgressionStats {
  const safeLevel = clampLevel(level);
  const increments = safeLevel - 1;
  return {
    maxHp: Math.max(1, Math.round(pal.stats.hp + pal.growth.hpPerLevel * increments)),
    attack: Math.max(1, Math.round(pal.stats.attack + pal.growth.attackPerLevel * increments)),
    defense: Math.max(1, Math.round(pal.stats.defense + pal.growth.defensePerLevel * increments)),
  };
}

export function getBattleExperience(enemyLevel: number, enemyRarity: number, victory: boolean): number {
  if (!victory) return 0;
  const level = clampLevel(enemyLevel);
  const rarity = Number.isFinite(enemyRarity) ? Math.max(1, Math.min(5, Math.floor(enemyRarity))) : 1;
  return 16 + level * 10 + rarity * 6;
}

export function awardBattleExperience(
  instance: PalInstance,
  species: Pal,
  enemyLevel: number,
  enemyRarity: number,
  victory = true
): ExperienceAward {
  const previousLevel = clampLevel(instance.level);
  const minimumExperience = getTotalExperienceForLevel(previousLevel, species.growth.experienceCurve);
  const rawExperience = Number.isFinite(instance.experience)
    ? Math.max(0, Math.floor(instance.experience))
    : minimumExperience;
  const currentExperience = Math.max(minimumExperience, rawExperience);
  const gained = previousLevel >= MAX_PAL_LEVEL ? 0 : getBattleExperience(enemyLevel, enemyRarity, victory);
  const maxExperience = getTotalExperienceForLevel(MAX_PAL_LEVEL, species.growth.experienceCurve);
  const experience = Math.min(maxExperience, currentExperience + gained);
  const newLevel = Math.max(previousLevel, getLevelForExperience(experience, species.growth.experienceCurve));
  const previousStats = getProgressionStats(species, previousLevel);
  const newStats = getProgressionStats(species, newLevel);
  const safeCurrentHp = Number.isFinite(instance.currentHp)
    ? Math.max(0, Math.min(previousStats.maxHp, Math.floor(instance.currentHp)))
    : previousStats.maxHp;
  const currentHp =
    safeCurrentHp === 0
      ? 0
      : Math.min(newStats.maxHp, Math.max(1, safeCurrentHp + newStats.maxHp - previousStats.maxHp));

  return {
    instance: { ...instance, level: newLevel, experience, currentHp },
    gained,
    previousLevel,
    newLevel,
    levelsGained: newLevel - previousLevel,
    previousStats,
    newStats,
    nextLevelExperience:
      newLevel < MAX_PAL_LEVEL
        ? getTotalExperienceForLevel(newLevel + 1, species.growth.experienceCurve)
        : undefined,
  };
}

export function applyExperienceAward(
  ownedPals: PalInstance[],
  uid: string,
  species: Pal,
  enemyLevel: number,
  enemyRarity: number
): { ownedPals: PalInstance[]; award?: ExperienceAward } {
  const instance = ownedPals.find((pal) => pal.uid === uid && pal.speciesId === species.id);
  if (!instance) return { ownedPals };
  const award = awardBattleExperience(instance, species, enemyLevel, enemyRarity);
  return {
    award,
    ownedPals: ownedPals.map((pal) => (pal.uid === uid ? award.instance : pal)),
  };
}
