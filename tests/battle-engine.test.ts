import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDamage,
  createBattle,
  createCombatant,
  ELEMENT_ADVANTAGES,
  getEffectiveness,
  resolveTurn,
} from "../src/battle/battleEngine.ts";
import type { ActiveSkill } from "../src/types/activeSkill.ts";
import type { Pal } from "../src/types/pal.ts";

function pal(id: number, name: string, element: Pal["elements"][number], speed = 100): Pal {
  return {
    id,
    name: { zh: name, en: name },
    rarity: 1,
    elements: [element],
    stats: { hp: 100, attack: 80, defense: 80, workSpeed: 10, moveSpeed: speed, rideSprintSpeed: 0 },
    growth: { hpPerLevel: 4, attackPerLevel: 3, defensePerLevel: 3, experienceCurve: "medium" },
    workSuitability: [],
    activeSkills: ["test-skill"],
  };
}

const skill: ActiveSkill = {
  id: "test-skill",
  name: { zh: "测试技能", en: "Test Skill" },
  description: "test",
  element: "fire",
  power: 50,
  accuracy: 100,
  energyCost: 20,
  priority: 0,
};

test("元素克制同时支持优势与抗性", () => {
  assert.equal(Object.keys(ELEMENT_ADVANTAGES).length, 12);
  assert.equal(getEffectiveness("fire", ["grass"]), 2);
  assert.equal(getEffectiveness("grass", ["fire"]), 0.5);
  assert.equal(getEffectiveness("neutral", ["fire"]), 1);
});

test("冻结会阻止目标本回合行动", () => {
  const freezeSkill: ActiveSkill = {
    ...skill,
    effect: { status: "freeze", target: "opponent", chance: 100, duration: 1, magnitude: 0 },
  };
  const state = resolveTurn(
    createBattle(pal(1, "玩家", "ice", 200), pal(2, "敌人", "grass", 100)),
    freezeSkill,
    freezeSkill,
    () => 0
  );
  assert.ok(state.log.some((line) => line.includes("被冻结，无法行动")));
  assert.equal(state.player.hp, state.player.maxHp);
});

test("攻击增益会提高后续伤害", () => {
  const attacker = createCombatant(pal(1, "攻击方", "fire"));
  const defender = createCombatant(pal(2, "防守方", "neutral"));
  const normal = calculateDamage(attacker, defender, skill, () => 0).damage;
  attacker.statuses.push({ type: "attack-up", turns: 2, magnitude: 25 });
  const boosted = calculateDamage(attacker, defender, skill, () => 0).damage;
  assert.ok(boosted > normal);
});

test("伤害不会为负且会受元素克制影响", () => {
  const attacker = createCombatant(pal(1, "攻击方", "fire"));
  const weak = createCombatant(pal(2, "弱点方", "grass"));
  const resistant = createCombatant(pal(3, "抗性方", "water"));
  const weakDamage = calculateDamage(attacker, weak, skill, () => 0).damage;
  const resistedDamage = calculateDamage(attacker, resistant, skill, () => 0).damage;
  assert.ok(weakDamage > resistedDamage);
  assert.ok(resistedDamage >= 1);
});

test("速度较快者先行动且击倒后不会重复攻击", () => {
  const player = pal(1, "玩家", "fire", 200);
  const enemy = pal(2, "敌人", "grass", 100);
  enemy.stats.hp = 1;
  const state = resolveTurn(createBattle(player, enemy), skill, skill, () => 0);
  assert.equal(state.phase, "victory");
  assert.equal(state.enemy.hp, 0);
  assert.equal(state.player.hp, state.player.maxHp);
});

test("回合结算不会修改传入状态", () => {
  const initial = createBattle(pal(1, "玩家", "fire"), pal(2, "敌人", "grass"));
  const next = resolveTurn(initial, skill, skill, () => 0);
  assert.equal(initial.round, 1);
  assert.equal(initial.player.hp, 100);
  assert.notEqual(next, initial);
});

test("个体等级成长会真实影响战斗属性", () => {
  const species = pal(1, "成长兽", "neutral");
  const levelOne = createCombatant(species, 1);
  const levelTen = createCombatant(species, 10);
  assert.equal(levelTen.level, 10);
  assert.ok(levelTen.maxHp > levelOne.maxHp);
  assert.ok(levelTen.attack > levelOne.attack);
  assert.ok(levelTen.defense > levelOne.defense);
});

test("区域首领会抵抗状态并在半血时进入强化阶段", () => {
  const bossRules = {
    id: "test-boss",
    statusResistance: 55,
    phaseThreshold: 0.5,
    phaseAttackBoost: 28,
    phaseDefenseBoost: 22,
  };
  const statusSkill: ActiveSkill = {
    ...skill,
    effect: { status: "freeze", target: "opponent", chance: 100, duration: 1, magnitude: 0 },
  };
  const resisted = resolveTurn(
    createBattle(pal(1, "玩家", "fire", 200), pal(2, "首领", "wind", 100), 1, 1, bossRules),
    statusSkill,
    statusSkill,
    () => 0.5
  );
  assert.equal(
    resisted.enemy.statuses.some((status) => status.type === "freeze"),
    false
  );

  const initial = createBattle(pal(1, "玩家", "fire", 200), pal(2, "首领", "wind", 100), 1, 1, bossRules);
  initial.enemy.hp = Math.floor(initial.enemy.maxHp / 2);
  const phased = resolveTurn(initial, skill, skill, () => 0);
  assert.equal(phased.enemy.boss?.phaseTriggered, true);
  assert.ok(phased.enemy.statuses.some((status) => status.type === "attack-up"));
  assert.ok(phased.enemy.statuses.some((status) => status.type === "defense-up"));
  assert.ok(phased.log.some((line) => line.includes("风暴阶段")));
});
