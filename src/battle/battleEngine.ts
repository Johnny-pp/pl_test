import type { ActiveSkill } from "../types/activeSkill";
import type { ElementType, Pal } from "../types/pal";

export const MAX_ENERGY = 100;
export const ROUND_ENERGY_RECOVERY = 14;

export type BattlePhase = "choosing" | "resolving" | "victory" | "defeat";

export interface Combatant {
  id: number;
  name: string;
  elements: ElementType[];
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  skillIds: string[];
}

export interface BattleState {
  phase: BattlePhase;
  round: number;
  player: Combatant;
  enemy: Combatant;
  log: string[];
}

export interface SkillResult {
  hit: boolean;
  damage: number;
  effectiveness: number;
  message: string;
}

export type RandomSource = () => number;

const ADVANTAGES: Partial<Record<ElementType, ElementType[]>> = {
  fire: ["grass", "ice"],
  water: ["fire", "ground", "rock"],
  grass: ["water", "ground", "rock"],
  electric: ["water"],
  ice: ["grass", "dragon"],
  ground: ["fire", "electric"],
  rock: ["fire", "ice"],
  dragon: ["dragon"],
};

export function createCombatant(pal: Pal): Combatant {
  return {
    id: pal.id,
    name: pal.name.zh,
    elements: [...pal.elements],
    maxHp: pal.stats.hp,
    hp: pal.stats.hp,
    attack: pal.stats.attack,
    defense: pal.stats.defense,
    speed: pal.stats.moveSpeed,
    energy: MAX_ENERGY,
    skillIds: [...(pal.activeSkills ?? [])],
  };
}

export function createBattle(playerPal: Pal, enemyPal: Pal): BattleState {
  return {
    phase: "choosing",
    round: 1,
    player: createCombatant(playerPal),
    enemy: createCombatant(enemyPal),
    log: [`野生的${enemyPal.name.zh}出现了！`],
  };
}

export function getEffectiveness(
  attacking: ElementType,
  defending: ElementType[]
): number {
  let multiplier = 1;
  for (const element of defending) {
    if (ADVANTAGES[attacking]?.includes(element)) multiplier *= 2;
    if (ADVANTAGES[element]?.includes(attacking)) multiplier *= 0.5;
  }
  return multiplier;
}

export function calculateDamage(
  attacker: Combatant,
  defender: Combatant,
  skill: ActiveSkill,
  random: RandomSource = Math.random
): SkillResult {
  if (random() * 100 >= skill.accuracy) {
    return {
      hit: false,
      damage: 0,
      effectiveness: 1,
      message: `${attacker.name}的${skill.name.zh}没有命中。`,
    };
  }

  const effectiveness = getEffectiveness(skill.element, defender.elements);
  const sameTypeBonus = attacker.elements.includes(skill.element) ? 1.2 : 1;
  const variance = 0.9 + random() * 0.1;
  const defense = Math.max(1, defender.defense);
  const base = 2 + (attacker.attack * skill.power) / (defense * 2);
  const damage = Math.max(
    1,
    Math.floor(base * sameTypeBonus * effectiveness * variance)
  );
  const effectText = effectiveness > 1
    ? "效果绝佳！"
    : effectiveness < 1
      ? "效果不佳。"
      : "";

  return {
    hit: true,
    damage,
    effectiveness,
    message: `${attacker.name}使用${skill.name.zh}，造成 ${damage} 点伤害。${effectText}`,
  };
}

function act(
  attacker: Combatant,
  defender: Combatant,
  skill: ActiveSkill,
  random: RandomSource
): string {
  if (!attacker.skillIds.includes(skill.id)) {
    return `${attacker.name}尚未学会${skill.name.zh}。`;
  }
  if (attacker.energy < skill.energyCost) {
    return `${attacker.name}的能量不足，行动失败。`;
  }

  attacker.energy -= skill.energyCost;
  const result = calculateDamage(attacker, defender, skill, random);
  defender.hp = Math.max(0, defender.hp - result.damage);
  return result.message;
}

function goesFirst(
  player: Combatant,
  enemy: Combatant,
  playerSkill: ActiveSkill,
  enemySkill: ActiveSkill,
  random: RandomSource
): boolean {
  if (playerSkill.priority !== enemySkill.priority) {
    return playerSkill.priority > enemySkill.priority;
  }
  if (player.speed !== enemy.speed) return player.speed > enemy.speed;
  return random() < 0.5;
}

export function resolveTurn(
  state: BattleState,
  playerSkill: ActiveSkill,
  enemySkill: ActiveSkill,
  random: RandomSource = Math.random
): BattleState {
  if (state.phase !== "choosing") return state;

  const next: BattleState = {
    ...state,
    phase: "resolving",
    player: { ...state.player, elements: [...state.player.elements], skillIds: [...state.player.skillIds] },
    enemy: { ...state.enemy, elements: [...state.enemy.elements], skillIds: [...state.enemy.skillIds] },
    log: [...state.log, `── 第 ${state.round} 回合 ──`],
  };

  const playerFirst = goesFirst(next.player, next.enemy, playerSkill, enemySkill, random);
  const actions: Array<[Combatant, Combatant, ActiveSkill]> = playerFirst
    ? [[next.player, next.enemy, playerSkill], [next.enemy, next.player, enemySkill]]
    : [[next.enemy, next.player, enemySkill], [next.player, next.enemy, playerSkill]];

  for (const [attacker, defender, skill] of actions) {
    if (attacker.hp <= 0 || defender.hp <= 0) continue;
    next.log.push(act(attacker, defender, skill, random));
  }

  if (next.enemy.hp <= 0) {
    next.phase = "victory";
    next.log.push(`战斗胜利！${next.enemy.name}失去了战斗能力。`);
  } else if (next.player.hp <= 0) {
    next.phase = "defeat";
    next.log.push(`${next.player.name}失去了战斗能力。`);
  } else {
    next.phase = "choosing";
    next.round += 1;
    next.player.energy = Math.min(MAX_ENERGY, next.player.energy + ROUND_ENERGY_RECOVERY);
    next.enemy.energy = Math.min(MAX_ENERGY, next.enemy.energy + ROUND_ENERGY_RECOVERY);
  }

  return next;
}

export function chooseEnemySkill(
  enemy: Combatant,
  skillsById: ReadonlyMap<string, ActiveSkill>,
  random: RandomSource = Math.random
): ActiveSkill | undefined {
  const affordable = enemy.skillIds
    .map((id) => skillsById.get(id))
    .filter((skill): skill is ActiveSkill => Boolean(skill) && skill.energyCost <= enemy.energy);
  const fallback = enemy.skillIds
    .map((id) => skillsById.get(id))
    .find((skill): skill is ActiveSkill => Boolean(skill));
  if (affordable.length === 0) return fallback;
  return affordable[Math.floor(random() * affordable.length)];
}
