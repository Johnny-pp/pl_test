export interface CaptureTarget {
  hp: number;
  maxHp: number;
  rarity: number;
  catchRate?: number;
}

export interface CaptureResult {
  success: boolean;
  chance: number;
  roll: number;
}

export function calculateCaptureChance(target: CaptureTarget): number {
  const maxHp = Math.max(1, target.maxHp);
  const hpRatio = Math.max(0, Math.min(1, target.hp / maxHp));
  const baseRate = target.catchRate ?? 58 - target.rarity * 7;
  const weakenedBonus = (1 - hpRatio) * 38;
  const chance = baseRate + weakenedBonus;
  return Math.round(Math.max(5, Math.min(95, chance)) * 10) / 10;
}

export function attemptCapture(
  target: CaptureTarget,
  random: () => number = Math.random
): CaptureResult {
  const chance = calculateCaptureChance(target);
  const roll = Math.max(0, Math.min(0.999999, random())) * 100;
  return { success: roll < chance, chance, roll };
}

export function rollWildPassiveSkills(
  passivePool: readonly string[],
  random: () => number = Math.random
): string[] {
  if (passivePool.length === 0 || random() >= 0.35) return [];
  const first = passivePool[Math.floor(random() * passivePool.length)];
  const result = [first];
  if (passivePool.length > 1 && random() < 0.08) {
    const remaining = passivePool.filter((id) => id !== first);
    result.push(remaining[Math.floor(random() * remaining.length)]);
  }
  return result;
}
