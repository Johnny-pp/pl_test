import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPartyBattle,
  createCombatant,
  resolveTurn,
  switchPlayer,
  chooseEnemySkill,
  type BattleState,
  type Combatant,
  type CombatantBuildInput,
} from "../src/battle/battleEngine.ts";
import { chooseAutoBattleSkill, chooseAutoSwitchIndex } from "../src/battle/autoBattle.ts";
import { getProgressionStats } from "../src/progression/progression.ts";
import { TOWER_FLOORS } from "../src/endgame/tower.ts";
import { getRematchForBoss } from "../src/endgame/bossRematch.ts";
import { bossesById } from "../src/battle/bosses.ts";
import { BALANCE_BASELINE } from "../src/balance/balanceBaseline.ts";
import type { Pal } from "../src/types/pal.ts";
import type { ActiveSkill } from "../src/types/activeSkill.ts";
import type { PassiveSkill } from "../src/types/passiveSkill.ts";

const pals = JSON.parse(readFileSync(new URL("../data/pals.json", import.meta.url), "utf-8")) as Pal[];
const activeSkills = JSON.parse(
  readFileSync(new URL("../data/active-skills.json", import.meta.url), "utf-8")
) as ActiveSkill[];
const passiveSkills = JSON.parse(
  readFileSync(new URL("../data/passive-skills.json", import.meta.url), "utf-8")
) as PassiveSkill[];
const activeSkillsById = new Map(activeSkills.map((skill) => [skill.id, skill]));
const passiveById = new Map(passiveSkills.map((skill) => [skill.id, skill]));

function palById(speciesId: number): Pal {
  const pal = pals.find((entry) => entry.id === speciesId);
  if (!pal) throw new Error(`缺失物种 ${speciesId}`);
  return pal;
}

function zeroBonuses(): CombatantBuildInput["bonuses"] {
  return {
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
}

function fighter(pal: Pal, level: number, build: Partial<CombatantBuildInput> = {}): Combatant {
  const stats = getProgressionStats(pal, level);
  return createCombatant(pal, level, undefined, build.passiveSkillIds ?? [], {
    skillIds: build.skillIds ?? [...(pal.activeSkills ?? [])].slice(0, 4),
    stats: {
      maxHp: Math.round(stats.maxHp * (build.maxHpFactor ?? 1)),
      attack: Math.round(stats.attack * (build.attackFactor ?? 1)),
      defense: Math.round(stats.defense * (build.defenseFactor ?? 1)),
      speed: stats.moveSpeed * (build.speedFactor ?? 1),
      workSpeed: stats.workSpeed,
    },
    bonuses: {
      ...zeroBonuses(),
      attackPercent: build.attackPercent ?? 0,
      defensePercent: build.defensePercent ?? 0,
      damageTakenPercent: build.damageTakenPercent ?? 0,
      elementDamagePercent: build.elementDamage ?? {},
    },
    passiveSkillIds: build.passiveSkillIds ?? [],
  });
}

function simulateBattle(
  state: BattleState,
  random: () => number
): { victory: boolean; rounds: number; remainingHp: number; maxHp: number } {
  let guard = 0;
  while (state.phase === "choosing" || state.phase === "switching") {
    if (guard++ > 200) break;
    if (state.phase === "switching") {
      const index = chooseAutoSwitchIndex(state);
      if (index === undefined) break;
      state = switchPlayer(state, index, chooseEnemySkill(state.enemy, activeSkillsById), random);
      continue;
    }
    const playerSkill = chooseAutoBattleSkill(state.player, state.enemy, activeSkillsById);
    const enemySkill = chooseEnemySkill(state.enemy, activeSkillsById);
    if (!playerSkill || !enemySkill) break;
    state = resolveTurn(state, playerSkill, enemySkill, random);
  }
  return {
    victory: state.phase === "victory",
    rounds: state.round,
    remainingHp: state.playerParty.reduce((sum, entry) => sum + entry.hp, 0),
    maxHp: state.playerParty.reduce((sum, entry) => sum + entry.maxHp, 0),
  };
}

function runTowerFloors(members: Combatant[], random: () => number): { cleared: number; total: number } {
  let cleared = 0;
  for (const floor of TOWER_FLOORS) {
    const enemyPal = palById(floor.speciesId);
    const party = members.map((member) => ({
      pal: palById(member.id),
      level: member.level,
      build: {
        skillIds: member.skillIds,
        stats: {
          maxHp: member.maxHp,
          attack: member.attack,
          defense: member.defense,
          speed: member.speed,
          workSpeed: 20,
        },
        bonuses: member.passiveBonuses,
        passiveSkillIds: member.passiveSkillIds,
      },
    }));
    let state = createPartyBattle(party, enemyPal, floor.level, floor.bossRules);
    if (state.phase === "defeat") break;
    while (state.phase === "choosing" || state.phase === "switching") {
      if (state.phase === "switching") {
        const index = chooseAutoSwitchIndex(state);
        if (index === undefined) break;
        state = switchPlayer(state, index, chooseEnemySkill(state.enemy, activeSkillsById), random);
        continue;
      }
      const playerSkill = chooseAutoBattleSkill(state.player, state.enemy, activeSkillsById);
      const enemySkill = chooseEnemySkill(state.enemy, activeSkillsById);
      if (!playerSkill || !enemySkill) break;
      state = resolveTurn(state, playerSkill, enemySkill, random);
    }
    if (state.phase !== "victory") break;
    cleared += 1;
    members = state.playerParty.map((fighter, index) => ({ ...fighter, id: members[index].id }));
  }
  return { cleared, total: TOWER_FLOORS.length };
}

/** 强攻构筑：高攻击 + 攻击/元素增伤被动。 */
function makeAttackBuild(): Combatant[] {
  const species = palById(30);
  return [1, 2, 3].map(() =>
    fighter(species, 45, {
      attackFactor: 1.35,
      attackPercent: 30,
      elementDamage: { fire: 25, dragon: 15 },
      passiveSkillIds: ["sharp_focus", "overcharge", "flame_attuned"].filter((id) => passiveById.has(id)),
    })
  );
}

/** 坚守构筑：高防御 + 高血量 + 减伤被动。 */
function makeTankBuild(): Combatant[] {
  const species = palById(36);
  return [1, 2, 3].map(() =>
    fighter(species, 45, {
      defenseFactor: 1.5,
      maxHpFactor: 1.25,
      defensePercent: 35,
      damageTakenPercent: -25,
      passiveSkillIds: ["stonehide", "flexible_guard", "hearty_bite"].filter((id) => passiveById.has(id)),
    })
  );
}

test("至少两种不同构筑能够通过试炼塔基线", () => {
  const attackRun = runTowerFloors(makeAttackBuild(), () => 0.5);
  const tankRun = runTowerFloors(makeTankBuild(), () => 0.5);
  const baseline = BALANCE_BASELINE.endgame.towerFloors;
  assert.ok(attackRun.cleared >= baseline, `强攻构筑应通过至少 ${baseline} 层（实际 ${attackRun.cleared}）`);
  assert.ok(tankRun.cleared >= baseline, `坚守构筑应通过至少 ${baseline} 层（实际 ${tankRun.cleared}）`);
});

test("两种构筑属性方向不同，避免唯一解垄断", () => {
  const attackFighter = makeAttackBuild()[0];
  const tankFighter = makeTankBuild()[0];
  assert.ok(attackFighter.attack > tankFighter.attack, "强攻构筑攻击应更高");
  assert.ok(tankFighter.defense > attackFighter.defense, "坚守构筑防御应更高");
  assert.ok(tankFighter.maxHp > attackFighter.maxHp, "坚守构筑血量应更高");
});

test("两种构筑均能击败一个强化首领重战", () => {
  const rematch = getRematchForBoss("storm-lord");
  assert.ok(rematch);
  const boss = bossesById.get(rematch!.bossId);
  assert.ok(boss);
  const enemyPal = palById(boss!.speciesId);
  for (const [label, members] of [
    ["强攻", makeAttackBuild()],
    ["坚守", makeTankBuild()],
  ] as const) {
    const state = createPartyBattle(
      members.map((member) => ({
        pal: palById(member.id),
        level: member.level,
        build: {
          skillIds: member.skillIds,
          stats: {
            maxHp: member.maxHp,
            attack: member.attack,
            defense: member.defense,
            speed: member.speed,
            workSpeed: 20,
          },
          bonuses: member.passiveBonuses,
          passiveSkillIds: member.passiveSkillIds,
        },
      })),
      enemyPal,
      rematch!.level,
      rematch!.rules
    );
    const result = simulateBattle(state, () => 0.5);
    assert.equal(result.victory, true, `${label}构筑应击败风暴领主强化重战`);
  }
});

test("战斗评分可区分不同表现且失败为 0", () => {
  const attackFighter = makeAttackBuild()[0];
  const result = simulateBattle(
    createPartyBattle(
      [
        {
          pal: palById(attackFighter.id),
          level: attackFighter.level,
          build: {
            skillIds: attackFighter.skillIds,
            stats: {
              maxHp: attackFighter.maxHp,
              attack: attackFighter.attack,
              defense: attackFighter.defense,
              speed: attackFighter.speed,
              workSpeed: 20,
            },
            bonuses: attackFighter.passiveBonuses,
            passiveSkillIds: attackFighter.passiveSkillIds,
          },
        },
      ],
      palById(41),
      24
    ),
    () => 0.5
  );
  assert.equal(result.victory, true);
  assert.ok(result.remainingHp >= 0 && result.remainingHp <= result.maxHp);
});
