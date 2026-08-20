import type { ActiveSkill, StatusEffectType } from "../types/activeSkill";
import type { ElementType, Pal } from "../types/pal";
import { getProgressionStats } from "../progression/progression.ts";
import { getPassiveBonuses, type PassiveBonuses } from "../passives/passiveEffects.ts";

export const MAX_ENERGY = 100;
export const ROUND_ENERGY_RECOVERY = 14;

export type BattlePhase = "choosing" | "switching" | "resolving" | "victory" | "defeat";

export interface Combatant {
  id: number;
  name: string;
  level: number;
  elements: ElementType[];
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  energy: number;
  skillIds: string[];
  statuses: StatusInstance[];
  passiveSkillIds: string[];
  passiveBonuses: PassiveBonuses;
  boss?: BossCombatState;
}

export interface BossBattleRules {
  id: string;
  statusResistance: number;
  phaseThreshold: number;
  phaseAttackBoost: number;
  phaseDefenseBoost: number;
}

export interface BossCombatState extends BossBattleRules {
  phaseTriggered: boolean;
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
  playerParty: Combatant[];
  activePlayerIndex: number;
  enemy: Combatant;
  log: string[];
}

export interface CombatantBuildInput {
  /** Equipped active skill ids (max 4). */
  skillIds: string[];
  /** Final computed stats including skill tree, passives and equipment. */
  stats: { maxHp: number; attack: number; defense: number; speed: number; workSpeed: number };
  /** Combined percent bonuses (passives + equipment). */
  bonuses: PassiveBonuses;
  /** Passive ids used for display purposes. */
  passiveSkillIds: string[];
}

export interface PartyMemberInput {
  pal: Pal;
  level: number;
  currentHp?: number;
  passiveSkillIds?: string[];
  /** Optional build snapshot overriding stats and equipped skills. */
  build?: CombatantBuildInput;
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
  burn: "灼烧",
  poison: "中毒",
  freeze: "冻结",
  "attack-up": "攻击提升",
  "defense-up": "防御提升",
  "speed-up": "速度提升",
};

export function getStatusLabel(status: StatusEffectType): string {
  return STATUS_LABELS[status];
}

export function createCombatant(
  pal: Pal,
  level = 1,
  bossRules?: BossBattleRules,
  passiveSkillIds: string[] = [],
  build?: CombatantBuildInput
): Combatant {
  const passiveBonuses = build ? build.bonuses : getPassiveBonuses(passiveSkillIds);
  if (build) {
    return {
      id: pal.id,
      name: pal.name.zh,
      level: Math.max(1, Math.min(50, Math.floor(level))),
      elements: [...pal.elements],
      maxHp: build.stats.maxHp,
      hp: build.stats.maxHp,
      attack: build.stats.attack,
      defense: build.stats.defense,
      speed: build.stats.speed,
      energy: MAX_ENERGY,
      skillIds: [...build.skillIds],
      statuses: [],
      passiveSkillIds: [...new Set(build.passiveSkillIds)],
      passiveBonuses,
      boss: bossRules ? { ...bossRules, phaseTriggered: false } : undefined,
    };
  }
  const stats = getProgressionStats(pal, level);
  return {
    id: pal.id,
    name: pal.name.zh,
    level: Math.max(1, Math.min(50, Math.floor(level))),
    elements: [...pal.elements],
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    attack: Math.max(1, Math.round(stats.attack * (1 + passiveBonuses.attackPercent / 100))),
    defense: Math.max(1, Math.round(stats.defense * (1 + passiveBonuses.defensePercent / 100))),
    speed: Math.max(1, Math.round(pal.stats.moveSpeed * (1 + passiveBonuses.speedPercent / 100))),
    energy: MAX_ENERGY,
    skillIds: [...(pal.activeSkills ?? [])],
    statuses: [],
    passiveSkillIds: [...new Set(passiveSkillIds)],
    passiveBonuses,
    boss: bossRules ? { ...bossRules, phaseTriggered: false } : undefined,
  };
}

export function createBattle(
  playerPal: Pal,
  enemyPal: Pal,
  playerLevel = 1,
  enemyLevel = 1,
  enemyBoss?: BossBattleRules
): BattleState {
  return createPartyBattle([{ pal: playerPal, level: playerLevel }], enemyPal, enemyLevel, enemyBoss);
}

export function createPartyBattle(
  members: PartyMemberInput[],
  enemyPal: Pal,
  enemyLevel = 1,
  enemyBoss?: BossBattleRules
): BattleState {
  const playerParty = members.map((member) => {
    const fighter = createCombatant(
      member.pal,
      member.level,
      undefined,
      member.passiveSkillIds,
      member.build
    );
    if (member.currentHp !== undefined)
      fighter.hp = Math.max(0, Math.min(fighter.maxHp, Math.floor(member.currentHp)));
    return fighter;
  });
  const activePlayerIndex = Math.max(
    0,
    playerParty.findIndex((fighter) => fighter.hp > 0)
  );
  const player = playerParty[activePlayerIndex] ?? createCombatant(enemyPal, 1);
  const canBattle = playerParty.some((fighter) => fighter.hp > 0);
  return {
    phase: canBattle ? "choosing" : "defeat",
    round: 1,
    player,
    playerParty: playerParty.length > 0 ? playerParty : [player],
    activePlayerIndex,
    enemy: createCombatant(enemyPal, enemyLevel, enemyBoss),
    log: [`野生的${enemyPal.name.zh}出现了！`, ...(canBattle ? [] : ["队伍中没有可以战斗的幻兽。"])],
  };
}

export function getEffectiveness(attacking: ElementType, defending: ElementType[]): number {
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
  const elementBonus = 1 + (attacker.passiveBonuses.elementDamagePercent[skill.element] ?? 0) / 100;
  const elementResistance = 1 - (defender.passiveBonuses.elementResistancePercent[skill.element] ?? 0) / 100;
  const damageTaken = 1 + defender.passiveBonuses.damageTakenPercent / 100;
  const damage = Math.max(
    1,
    Math.floor(
      base * sameTypeBonus * effectiveness * variance * elementBonus * elementResistance * damageTaken
    )
  );
  const effectText = effectiveness > 1 ? "效果绝佳！" : effectiveness < 1 ? "效果不佳。" : "";

  return {
    hit: true,
    damage,
    effectiveness,
    message: `${attacker.name}使用${skill.name.zh}，造成 ${damage} 点伤害。${effectText}`,
  };
}

export function getSkillEnergyCost(fighter: Combatant, skill: ActiveSkill): number {
  return Math.max(0, Math.ceil(skill.energyCost * (1 + fighter.passiveBonuses.energyCostPercent / 100)));
}

function act(attacker: Combatant, defender: Combatant, skill: ActiveSkill, random: RandomSource): string[] {
  const frozen = attacker.statuses.find((status) => status.type === "freeze");
  if (frozen) {
    attacker.statuses = attacker.statuses.filter((status) => status !== frozen);
    return [`${attacker.name}被冻结，无法行动。`];
  }
  if (!attacker.skillIds.includes(skill.id)) {
    return [`${attacker.name}尚未学会${skill.name.zh}。`];
  }
  const energyCost = getSkillEnergyCost(attacker, skill);
  if (attacker.energy < energyCost) {
    return [`${attacker.name}的能量不足，行动失败。`];
  }

  attacker.energy -= energyCost;
  const result = calculateDamage(attacker, defender, skill, random);
  defender.hp = Math.max(0, defender.hp - result.damage);
  const messages = [result.message];
  const resistance = skill.effect?.target === "opponent" ? (defender.boss?.statusResistance ?? 0) : 0;
  if (result.hit && skill.effect && random() * 100 < skill.effect.chance * (1 - resistance / 100)) {
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

function triggerBossPhase(fighter: Combatant): string[] {
  const boss = fighter.boss;
  if (!boss || boss.phaseTriggered || fighter.hp <= 0 || fighter.hp / fighter.maxHp > boss.phaseThreshold)
    return [];
  boss.phaseTriggered = true;
  for (const boost of [
    { type: "attack-up" as const, magnitude: boss.phaseAttackBoost },
    { type: "defense-up" as const, magnitude: boss.phaseDefenseBoost },
  ]) {
    const existing = fighter.statuses.find((status) => status.type === boost.type);
    if (existing) {
      existing.turns = Math.max(existing.turns, 99);
      existing.magnitude = Math.max(existing.magnitude, boost.magnitude);
    } else {
      fighter.statuses.push({ ...boost, turns: 99 });
    }
  }
  return [`${fighter.name}引动山巅雷云，进入风暴阶段：攻击与防御提升！`];
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

function cloneCombatant(fighter: Combatant): Combatant {
  return {
    ...fighter,
    elements: [...fighter.elements],
    skillIds: [...fighter.skillIds],
    statuses: fighter.statuses.map((status) => ({ ...status })),
    passiveSkillIds: [...fighter.passiveSkillIds],
    passiveBonuses: {
      ...fighter.passiveBonuses,
      elementDamagePercent: { ...fighter.passiveBonuses.elementDamagePercent },
      elementResistancePercent: { ...fighter.passiveBonuses.elementResistancePercent },
    },
    boss: fighter.boss ? { ...fighter.boss } : undefined,
  };
}

function cloneBattleState(state: BattleState): BattleState {
  const playerParty = state.playerParty.map(cloneCombatant);
  return {
    ...state,
    playerParty,
    player: playerParty[state.activePlayerIndex],
    enemy: cloneCombatant(state.enemy),
    log: [...state.log],
  };
}

function finishRound(next: BattleState): BattleState {
  if (next.enemy.hp <= 0) {
    next.phase = "victory";
    next.log.push(`战斗胜利！${next.enemy.name}失去了战斗能力。`);
  } else if (next.player.hp <= 0) {
    next.log.push(`${next.player.name}失去了战斗能力。`);
    next.phase = next.playerParty.some((fighter) => fighter.hp > 0) ? "switching" : "defeat";
    if (next.phase === "switching") next.log.push("请选择一名仍可战斗的队员继续出战。");
  } else {
    next.phase = "choosing";
    next.round += 1;
    next.player.energy = Math.min(MAX_ENERGY, next.player.energy + ROUND_ENERGY_RECOVERY);
    next.enemy.energy = Math.min(MAX_ENERGY, next.enemy.energy + ROUND_ENERGY_RECOVERY);
  }
  return next;
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

  const next = cloneBattleState(state);
  next.phase = "resolving";
  next.log.push(`── 第 ${state.round} 回合 ──`);

  const playerFirst = goesFirst(next.player, next.enemy, playerSkill, enemySkill, random);
  const actions: Array<[Combatant, Combatant, ActiveSkill]> = playerFirst
    ? [
        [next.player, next.enemy, playerSkill],
        [next.enemy, next.player, enemySkill],
      ]
    : [
        [next.enemy, next.player, enemySkill],
        [next.player, next.enemy, playerSkill],
      ];

  for (const [attacker, defender, skill] of actions) {
    if (attacker.hp <= 0 || defender.hp <= 0) continue;
    next.log.push(...act(attacker, defender, skill, random));
  }

  next.log.push(...triggerBossPhase(next.enemy), ...triggerBossPhase(next.player));

  if (next.player.hp > 0 && next.enemy.hp > 0) {
    next.log.push(...tickStatuses(next.player), ...tickStatuses(next.enemy));
  }

  return finishRound(next);
}

export function switchPlayer(
  state: BattleState,
  nextIndex: number,
  enemySkill?: ActiveSkill,
  random: RandomSource = Math.random
): BattleState {
  if (state.phase !== "choosing" && state.phase !== "switching") return state;
  if (
    nextIndex === state.activePlayerIndex ||
    nextIndex < 0 ||
    nextIndex >= state.playerParty.length ||
    state.playerParty[nextIndex].hp <= 0
  )
    return state;
  const forced = state.phase === "switching";
  const next = cloneBattleState(state);
  const previousName = next.player.name;
  next.activePlayerIndex = nextIndex;
  next.player = next.playerParty[nextIndex];
  next.log.push(`${previousName}退回队伍，${next.player.name}上场！`);
  if (forced) {
    next.phase = "choosing";
    return next;
  }

  next.phase = "resolving";
  next.log.push(`── 第 ${state.round} 回合：更换队员 ──`);
  if (enemySkill && next.enemy.hp > 0) next.log.push(...act(next.enemy, next.player, enemySkill, random));
  next.log.push(...triggerBossPhase(next.enemy), ...triggerBossPhase(next.player));
  if (next.player.hp > 0 && next.enemy.hp > 0)
    next.log.push(...tickStatuses(next.player), ...tickStatuses(next.enemy));
  return finishRound(next);
}

export function chooseEnemySkill(
  enemy: Combatant,
  skillsById: ReadonlyMap<string, ActiveSkill>,
  random: RandomSource = Math.random
): ActiveSkill | undefined {
  const affordable = enemy.skillIds
    .map((id) => skillsById.get(id))
    .filter(
      (skill): skill is ActiveSkill => skill !== undefined && getSkillEnergyCost(enemy, skill) <= enemy.energy
    );
  const fallback = enemy.skillIds
    .map((id) => skillsById.get(id))
    .find((skill): skill is ActiveSkill => Boolean(skill));
  if (affordable.length === 0) return fallback;
  return affordable[Math.floor(random() * affordable.length)];
}
