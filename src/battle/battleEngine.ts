import type { ActiveSkill, StatusEffectType } from "../types/activeSkill";
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
  statuses: StatusInstance[];
}

export interface StatusInstance {
  type: StatusEffectType;
  turns: number;
  magnitude: number;
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

export const ELEMENT_ADVANTAGES: Record<ElementType, ElementType[]> = {
  neutral: [],
  fire: ["grass", "ice"],
  water: ["fire", "ground", "rock"],
  grass: ["water", "ground", "rock"],
  electric: ["water", "wind"],
  ice: ["grass", "dragon", "wind"],
  ground: ["fire", "electric", "rock"],
  wind: ["grass", "ground"],
  dark: ["neutral", "normal"],
  dragon: ["dragon", "dark"],
  rock: ["fire", "ice", "wind"],
  normal: [],
};

const STATUS_LABELS: Record<StatusEffectType, string> = {
  burn: "灼烧", poison: "中毒", freeze: "冻结",
  "attack-up": "攻击提升", "defense-up": "防御提升", "speed-up": "速度提升",
};

export function getStatusLabel(status: StatusEffectType): string {
  return STATUS_LABELS[status];
}

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
    statuses: [],
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
    if (ELEMENT_ADVANTAGES[attacking].includes(element)) multiplier *= 2;
    if (ELEMENT_ADVANTAGES[element].includes(attacking)) multiplier *= 0.5;
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
  const attackBoost = attacker.statuses.find((status) => status.type === "attack-up")?.magnitude ?? 0;
  const defenseBoost = defender.statuses.find((status) => status.type === "defense-up")?.magnitude ?? 0;
  const attack = attacker.attack * (1 + attackBoost / 100);
  const defense = Math.max(1, defender.defense * (1 + defenseBoost / 100));
  const base = 2 + (attack * skill.power) / (defense * 2);
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
): string[] {
  const frozen = attacker.statuses.find((status) => status.type === "freeze");
  if (frozen) {
    attacker.statuses = attacker.statuses.filter((status) => status !== frozen);
    return [`${attacker.name}被冻结，无法行动。`];
  }
  if (!attacker.skillIds.includes(skill.id)) {
    return [`${attacker.name}尚未学会${skill.name.zh}。`];
  }
  if (attacker.energy < skill.energyCost) {
    return [`${attacker.name}的能量不足，行动失败。`];
  }

  attacker.energy -= skill.energyCost;
  const result = calculateDamage(attacker, defender, skill, random);
  defender.hp = Math.max(0, defender.hp - result.damage);
  const messages = [result.message];
  if (result.hit && skill.effect && random() * 100 < skill.effect.chance) {
    const target = skill.effect.target === "self" ? attacker : defender;
    const nextStatus: StatusInstance = {
      type: skill.effect.status,
      turns: skill.effect.duration,
      magnitude: skill.effect.magnitude,
    };
    const existing = target.statuses.find((status) => status.type === nextStatus.type);
    if (existing) {
      existing.turns = Math.max(existing.turns, nextStatus.turns);
      existing.magnitude = Math.max(existing.magnitude, nextStatus.magnitude);
    } else {
      target.statuses.push(nextStatus);
    }
    messages.push(`${target.name}获得状态：${STATUS_LABELS[nextStatus.type]}。`);
  }
  return messages;
}

function tickStatuses(fighter: Combatant): string[] {
  const messages: string[] = [];
  for (const status of fighter.statuses) {
    if (status.type === "burn" || status.type === "poison") {
      const damage = Math.max(1, Math.round(status.magnitude));
      fighter.hp = Math.max(0, fighter.hp - damage);
      messages.push(`${fighter.name}受到${STATUS_LABELS[status.type]}伤害 ${damage} 点。`);
    }
    if (status.type !== "freeze") status.turns -= 1;
  }
  fighter.statuses = fighter.statuses.filter((status) => status.turns > 0);
  return messages;
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
  const playerBoost = player.statuses.find((status) => status.type === "speed-up")?.magnitude ?? 0;
  const enemyBoost = enemy.statuses.find((status) => status.type === "speed-up")?.magnitude ?? 0;
  const playerSpeed = player.speed * (1 + playerBoost / 100);
  const enemySpeed = enemy.speed * (1 + enemyBoost / 100);
  if (playerSpeed !== enemySpeed) return playerSpeed > enemySpeed;
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
    player: { ...state.player, elements: [...state.player.elements], skillIds: [...state.player.skillIds], statuses: state.player.statuses.map((status) => ({ ...status })) },
    enemy: { ...state.enemy, elements: [...state.enemy.elements], skillIds: [...state.enemy.skillIds], statuses: state.enemy.statuses.map((status) => ({ ...status })) },
    log: [...state.log, `── 第 ${state.round} 回合 ──`],
  };

  const playerFirst = goesFirst(next.player, next.enemy, playerSkill, enemySkill, random);
  const actions: Array<[Combatant, Combatant, ActiveSkill]> = playerFirst
    ? [[next.player, next.enemy, playerSkill], [next.enemy, next.player, enemySkill]]
    : [[next.enemy, next.player, enemySkill], [next.player, next.enemy, playerSkill]];

  for (const [attacker, defender, skill] of actions) {
    if (attacker.hp <= 0 || defender.hp <= 0) continue;
    next.log.push(...act(attacker, defender, skill, random));
  }

  if (next.player.hp > 0 && next.enemy.hp > 0) {
    next.log.push(...tickStatuses(next.player), ...tickStatuses(next.enemy));
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
