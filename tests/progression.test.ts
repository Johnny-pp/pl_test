import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PAL_LEVEL,
  awardBattleExperience,
  getBattleExperience,
  getLevelForExperience,
  getProgressionStats,
  getTotalExperienceForLevel,
} from "../src/progression/progression.ts";
import type { PalInstance } from "../src/player/playerState.ts";
import type { Pal } from "../src/types/pal.ts";

const species: Pal = {
  id: 7,
  name: { zh: "成长测试兽", en: "Growth Test" },
  rarity: 2,
  elements: ["neutral"],
  stats: { hp: 80, attack: 60, defense: 50, workSpeed: 10, moveSpeed: 100, rideSprintSpeed: 0 },
  growth: { hpPerLevel: 4.4, attackPerLevel: 3.2, defensePerLevel: 2.6, experienceCurve: "medium" },
  workSuitability: [],
};

function instance(overrides: Partial<PalInstance> = {}): PalInstance {
  return {
    uid: "growth-pal",
    speciesId: species.id,
    level: 1,
    experience: 0,
    currentHp: species.stats.hp,
    passiveSkillIds: [],
    capturedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("快速、标准和缓慢经验曲线具有不同升级节奏", () => {
  const fast = getTotalExperienceForLevel(10, "fast");
  const medium = getTotalExperienceForLevel(10, "medium");
  const slow = getTotalExperienceForLevel(10, "slow");
  assert.ok(fast < medium);
  assert.ok(medium < slow);
  assert.ok(getLevelForExperience(fast, "fast") > getLevelForExperience(fast, "slow"));
});

test("刚好达到阈值会升级，且高额奖励可连续提升多级", () => {
  const levelTwoThreshold = getTotalExperienceForLevel(2, "medium");
  assert.equal(getLevelForExperience(levelTwoThreshold - 1, "medium"), 1);
  assert.equal(getLevelForExperience(levelTwoThreshold, "medium"), 2);

  const result = awardBattleExperience(instance(), species, 50, 5);
  assert.ok(result.levelsGained >= 3);
  assert.equal(result.gained, getBattleExperience(50, 5, true));
});

test("升级按成长值提高属性并按最大 HP 增量补充当前 HP", () => {
  const result = awardBattleExperience(instance({ currentHp: 40 }), species, 1, 2);
  assert.equal(result.newLevel, 2);
  assert.deepEqual(getProgressionStats(species, 2), { maxHp: 84, attack: 63, defense: 53 });
  assert.equal(result.instance.currentHp, 44);
});

test("满级不会继续获得经验，已倒下个体不会因升级复活", () => {
  const maxExperience = getTotalExperienceForLevel(MAX_PAL_LEVEL, "medium");
  const capped = awardBattleExperience(
    instance({ level: MAX_PAL_LEVEL, experience: maxExperience, currentHp: 1 }),
    species,
    50,
    5
  );
  assert.equal(capped.gained, 0);
  assert.equal(capped.newLevel, MAX_PAL_LEVEL);
  assert.equal(capped.nextLevelExperience, undefined);

  const fainted = awardBattleExperience(instance({ currentHp: 0 }), species, 50, 5);
  assert.equal(fainted.instance.currentHp, 0);
});

test("损坏经验和生命值会安全回退到合法范围", () => {
  const result = awardBattleExperience(
    instance({ level: 3, experience: Number.NaN, currentHp: Number.POSITIVE_INFINITY }),
    species,
    0,
    Number.NaN
  );
  assert.ok(Number.isFinite(result.instance.experience));
  assert.ok(result.instance.experience >= getTotalExperienceForLevel(3, "medium"));
  assert.ok(result.instance.currentHp <= result.newStats.maxHp);
});
