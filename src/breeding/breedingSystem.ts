import type { Pal } from "../types/pal";
import {
  addCapturedPal,
  createPalInstance,
  type BreedingEgg,
  type EggQuality,
  type GameSave,
} from "../player/playerState.ts";

export const BREEDING_FOOD_COST = 20;
export const INCUBATION_MS: Record<EggQuality, number> = {
  common: 30_000,
  fine: 60_000,
  radiant: 120_000,
};

export interface BreedResult {
  save: GameSave;
  egg?: BreedingEgg;
  error?: "same-parent" | "missing-parent" | "missing-species" | "insufficient-food" | "queue-full";
}

export function previewOffspring(parentA: Pal, parentB: Pal, species: readonly Pal[]): Pal | undefined {
  const powerA = parentA.breeding?.power ?? parentA.id;
  const powerB = parentB.breeding?.power ?? parentB.id;
  const sharedElementBonus = parentA.elements.some((element) => parentB.elements.includes(element)) ? -3 : 3;
  const target = (powerA + powerB) / 2 + sharedElementBonus;
  return [...species].sort((left, right) => {
    const leftDistance = Math.abs((left.breeding?.power ?? left.id) - target);
    const rightDistance = Math.abs((right.breeding?.power ?? right.id) - target);
    return leftDistance - rightDistance || left.id - right.id;
  })[0];
}

function rollQuality(parentA: Pal, parentB: Pal, random: () => number): EggQuality {
  const rarityBonus = (parentA.rarity + parentB.rarity) * 0.035;
  const roll = random() + rarityBonus;
  if (roll >= 1.05) return "radiant";
  if (roll >= 0.62) return "fine";
  return "common";
}

function inheritPassives(
  first: string[],
  second: string[],
  passivePool: readonly string[],
  random: () => number
): string[] {
  const inherited: string[] = [];
  for (const passive of [...new Set([...first, ...second])]) {
    if (inherited.length < 2 && random() < 0.45) inherited.push(passive);
  }
  if (inherited.length < 2 && passivePool.length > 0 && random() < 0.15) {
    const mutation = passivePool[Math.floor(random() * passivePool.length)];
    if (!inherited.includes(mutation)) inherited.push(mutation);
  }
  return inherited;
}

export function breed(
  save: GameSave,
  parentAUid: string,
  parentBUid: string,
  species: readonly Pal[],
  passivePool: readonly string[],
  random: () => number = Math.random,
  now = Date.now(),
  idFactory: () => string = () =>
    globalThis.crypto?.randomUUID?.() ?? `egg-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
): BreedResult {
  if (parentAUid === parentBUid) return { save, error: "same-parent" };
  if (save.breedingEggs.length >= 4) return { save, error: "queue-full" };
  const parentA = save.ownedPals.find((pal) => pal.uid === parentAUid);
  const parentB = save.ownedPals.find((pal) => pal.uid === parentBUid);
  if (!parentA || !parentB) return { save, error: "missing-parent" };
  if (save.base.resources.food < BREEDING_FOOD_COST) return { save, error: "insufficient-food" };
  const speciesA = species.find((pal) => pal.id === parentA.speciesId);
  const speciesB = species.find((pal) => pal.id === parentB.speciesId);
  if (!speciesA || !speciesB) return { save, error: "missing-species" };
  const offspring = previewOffspring(speciesA, speciesB, species);
  if (!offspring) return { save, error: "missing-species" };
  const quality = rollQuality(speciesA, speciesB, random);
  const egg: BreedingEgg = {
    id: idFactory(),
    parentUids: [parentAUid, parentBUid],
    speciesId: offspring.id,
    passiveSkillIds: inheritPassives(parentA.passiveSkillIds, parentB.passiveSkillIds, passivePool, random),
    quality,
    createdAt: now,
    hatchAt: now + INCUBATION_MS[quality],
  };
  return {
    egg,
    save: {
      ...save,
      base: {
        ...save.base,
        resources: { ...save.base.resources, food: save.base.resources.food - BREEDING_FOOD_COST },
      },
      breedingEggs: [...save.breedingEggs, egg],
    },
  };
}

export function hatchEgg(
  save: GameSave,
  eggId: string,
  species: readonly Pal[],
  now = Date.now(),
  idFactory?: () => string
): GameSave {
  const egg = save.breedingEggs.find((item) => item.id === eggId);
  if (!egg || now < egg.hatchAt) return save;
  const offspring = species.find((pal) => pal.id === egg.speciesId);
  if (!offspring) return save;
  const instance = createPalInstance(
    offspring,
    idFactory,
    () => new Date(now).toISOString(),
    egg.passiveSkillIds
  );
  const withoutEgg = { ...save, breedingEggs: save.breedingEggs.filter((item) => item.id !== eggId) };
  return addCapturedPal(withoutEgg, instance);
}
