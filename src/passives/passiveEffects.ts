import type { ElementType } from "../types/pal";

export interface PassiveContext {
  hour?: number;
}

export interface PassiveBonuses {
  attackPercent: number;
  defensePercent: number;
  speedPercent: number;
  damageTakenPercent: number;
  energyCostPercent: number;
  workSpeedPercent: number;
  resourceYieldPercent: number;
  elementDamagePercent: Partial<Record<ElementType, number>>;
  elementResistancePercent: Partial<Record<ElementType, number>>;
}

type PassiveEffect = (bonuses: PassiveBonuses, context: PassiveContext) => void;

function addElement(record: Partial<Record<ElementType, number>>, element: ElementType, amount: number) {
  record[element] = (record[element] ?? 0) + amount;
}

const EFFECTS: Record<string, PassiveEffect> = {
  windstep: (bonus) => (bonus.speedPercent += 15),
  sharp_focus: (bonus) => {
    bonus.attackPercent += 15;
    bonus.damageTakenPercent += 5;
  },
  balanced_frame: (bonus) => {
    bonus.attackPercent += 8;
    bonus.defensePercent += 8;
  },
  overcharge: (bonus) => {
    bonus.attackPercent += 22;
    bonus.energyCostPercent += 10;
  },
  stonehide: (bonus) => {
    bonus.defensePercent += 20;
    bonus.speedPercent -= 5;
  },
  flexible_guard: (bonus) => (bonus.damageTakenPercent -= 8),
  restless: (bonus) => (bonus.workSpeedPercent += 10),
  trail_sense: (bonus) => (bonus.resourceYieldPercent += 12),
  master_crafter: (bonus) => (bonus.workSpeedPercent += 40),
  diligent_rhythm: (bonus) => (bonus.workSpeedPercent += 18),
  prism_birth: (bonus) => {
    bonus.attackPercent += 12;
    bonus.workSpeedPercent += 12;
  },
  dawn_spirit: (bonus, context) => {
    if ((context.hour ?? 12) >= 6 && (context.hour ?? 12) < 18) bonus.workSpeedPercent += 12;
  },
  moon_worker: (bonus, context) => {
    if ((context.hour ?? 12) < 6 || (context.hour ?? 12) >= 18) bonus.workSpeedPercent += 12;
  },
  daydreamer: (bonus) => (bonus.workSpeedPercent -= 8),
  emberproof: (bonus) => addElement(bonus.elementResistancePercent, "fire", 12),
  frostproof: (bonus) => addElement(bonus.elementResistancePercent, "ice", 12),
  flame_attuned: (bonus) => addElement(bonus.elementDamagePercent, "fire", 12),
  tide_attuned: (bonus) => addElement(bonus.elementDamagePercent, "water", 12),
  grove_attuned: (bonus) => addElement(bonus.elementDamagePercent, "grass", 12),
  frost_attuned: (bonus) => addElement(bonus.elementDamagePercent, "ice", 12),
  spark_attuned: (bonus) => addElement(bonus.elementDamagePercent, "electric", 12),
  dusk_attuned: (bonus) => addElement(bonus.elementDamagePercent, "dark", 12),
  star_attuned: (bonus) => addElement(bonus.elementDamagePercent, "dragon", 12),
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function getPassiveBonuses(ids: readonly string[], context: PassiveContext = {}): PassiveBonuses {
  const bonuses: PassiveBonuses = {
    attackPercent: 0,
    defensePercent: 0,
    speedPercent: 0,
    damageTakenPercent: 0,
    energyCostPercent: 0,
    workSpeedPercent: 0,
    resourceYieldPercent: 0,
    elementDamagePercent: {},
    elementResistancePercent: {},
  };
  for (const id of new Set(ids)) EFFECTS[id]?.(bonuses, context);
  bonuses.attackPercent = clamp(bonuses.attackPercent, -40, 40);
  bonuses.defensePercent = clamp(bonuses.defensePercent, -40, 40);
  bonuses.speedPercent = clamp(bonuses.speedPercent, -40, 50);
  bonuses.damageTakenPercent = clamp(bonuses.damageTakenPercent, -30, 30);
  bonuses.energyCostPercent = clamp(bonuses.energyCostPercent, -30, 30);
  bonuses.workSpeedPercent = clamp(bonuses.workSpeedPercent, -30, 50);
  bonuses.resourceYieldPercent = clamp(bonuses.resourceYieldPercent, 0, 40);
  for (const element of Object.keys(bonuses.elementDamagePercent) as ElementType[]) {
    bonuses.elementDamagePercent[element] = clamp(bonuses.elementDamagePercent[element] ?? 0, 0, 30);
  }
  for (const element of Object.keys(bonuses.elementResistancePercent) as ElementType[]) {
    bonuses.elementResistancePercent[element] = clamp(bonuses.elementResistancePercent[element] ?? 0, 0, 30);
  }
  return bonuses;
}

export function describePassiveBonuses(ids: readonly string[], context: PassiveContext = {}): string[] {
  const bonus = getPassiveBonuses(ids, context);
  const labels: string[] = [];
  if (bonus.attackPercent) labels.push(`攻击 ${bonus.attackPercent > 0 ? "+" : ""}${bonus.attackPercent}%`);
  if (bonus.defensePercent)
    labels.push(`防御 ${bonus.defensePercent > 0 ? "+" : ""}${bonus.defensePercent}%`);
  if (bonus.speedPercent) labels.push(`速度 ${bonus.speedPercent > 0 ? "+" : ""}${bonus.speedPercent}%`);
  if (bonus.damageTakenPercent)
    labels.push(`承伤 ${bonus.damageTakenPercent > 0 ? "+" : ""}${bonus.damageTakenPercent}%`);
  if (bonus.energyCostPercent) labels.push(`能耗 +${bonus.energyCostPercent}%`);
  if (bonus.workSpeedPercent)
    labels.push(`工作 ${bonus.workSpeedPercent > 0 ? "+" : ""}${bonus.workSpeedPercent}%`);
  if (bonus.resourceYieldPercent) labels.push(`产量 +${bonus.resourceYieldPercent}%`);
  for (const [element, amount] of Object.entries(bonus.elementDamagePercent))
    labels.push(`${element}伤害 +${amount}%`);
  for (const [element, amount] of Object.entries(bonus.elementResistancePercent))
    labels.push(`${element}抗性 +${amount}%`);
  return labels;
}
