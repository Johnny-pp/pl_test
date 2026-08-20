import assert from "node:assert/strict";
import test from "node:test";
import { chooseAutoBattleSkill, chooseAutoSwitchIndex } from "../src/battle/autoBattle.ts";
import { createPartyBattle } from "../src/battle/battleEngine.ts";
import type { ActiveSkill } from "../src/types/activeSkill.ts";
import type { Pal } from "../src/types/pal.ts";

function pal(id: number, element: Pal["elements"][number], skills = ["plain"]): Pal {
  return {
    id,
    name: { zh: `测试${id}`, en: `Test ${id}` },
    rarity: 1,
    elements: [element],
    stats: { hp: 100, attack: 80, defense: 80, workSpeed: 10, moveSpeed: 100, rideSprintSpeed: 0 },
    growth: { hpPerLevel: 4, attackPerLevel: 3, defensePerLevel: 3, experienceCurve: "medium" },
    workSuitability: [],
    activeSkills: skills,
  };
}

const skills: ActiveSkill[] = [
  {
    id: "plain",
    name: { zh: "平击", en: "Plain" },
    description: "test",
    element: "neutral",
    power: 70,
    accuracy: 100,
    energyCost: 20,
    priority: 0,
  },
  {
    id: "flame",
    name: { zh: "焰击", en: "Flame" },
    description: "test",
    element: "fire",
    power: 50,
    accuracy: 100,
    energyCost: 30,
    priority: 0,
  },
];
const skillsById = new Map(skills.map((skill) => [skill.id, skill]));

test("自动战斗优先选择可用且克制伤害更高的技能", () => {
  const attackerPal = pal(1, "fire", ["plain", "flame"]);
  const defenderPal = pal(2, "grass");
  const state = createPartyBattle([{ pal: attackerPal, level: 10 }], defenderPal, 10);
  const skill = chooseAutoBattleSkill(state.player, state.enemy, skillsById);
  assert.equal(skill?.id, "flame");
});

test("没有足够能量时选择最低实际能耗技能", () => {
  const attackerPal = pal(1, "fire", ["plain", "flame"]);
  const defenderPal = pal(2, "grass");
  const state = createPartyBattle([{ pal: attackerPal }], defenderPal);
  state.player.energy = 0;
  const skill = chooseAutoBattleSkill(state.player, state.enemy, skillsById);
  assert.equal(skill?.id, "plain");
});

test("强制换宠按队伍顺序选择首个存活替补", () => {
  const state = createPartyBattle(
    [
      { pal: pal(1, "fire"), currentHp: 0 },
      { pal: pal(2, "water"), currentHp: 1 },
      { pal: pal(3, "grass"), currentHp: 1 },
    ],
    pal(4, "neutral")
  );
  state.activePlayerIndex = 0;
  state.player = state.playerParty[0];
  assert.equal(chooseAutoSwitchIndex(state), 1);
  state.playerParty[1].hp = 0;
  assert.equal(chooseAutoSwitchIndex(state), 2);
  state.playerParty[2].hp = 0;
  assert.equal(chooseAutoSwitchIndex(state), undefined);
});
