import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave } from "../src/player/playerState.ts";
import {
  claimTowerReward,
  getTowerFloor,
  getTowerNextFloor,
  getTowerRestrictions,
  getTowerReward,
  getTowerView,
  recordTowerVictory,
  TOWER_FLOORS,
  TOWER_TOTAL_FLOORS,
} from "../src/endgame/tower.ts";
import { computeBattleScore, recordBestScore } from "../src/endgame/battleScore.ts";
import {
  BOSS_REMATCHES,
  claimRematchFirstReward,
  getRematchViews,
  isRematchFirstRewardClaimed,
} from "../src/endgame/bossRematch.ts";
import { hashString, mulberry32 } from "../src/endgame/seededRandom.ts";

test("试炼塔定义了 10 层递增强敌", () => {
  assert.equal(TOWER_FLOORS.length, TOWER_TOTAL_FLOORS);
  const levels = TOWER_FLOORS.map((floor) => floor.level);
  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(levels[index] > levels[index - 1], "塔层等级应递增");
  }
  const floors = new Set(TOWER_FLOORS.map((floor) => floor.floor));
  assert.equal(floors.size, TOWER_TOTAL_FLOORS, "层号应唯一且连续");
});

test("塔层 4 与 7 起生效的限制可累计合并", () => {
  const floor4 = getTowerRestrictions(4);
  assert.deepEqual(floor4?.elementWhitelist, ["fire", "water", "grass", "electric"]);
  const floor7 = getTowerRestrictions(7);
  assert.equal(floor7?.maxTeamSize, 4);
  assert.ok(floor7?.elementWhitelist?.includes("ice"));
  const floor1 = getTowerRestrictions(1);
  assert.equal(floor1, undefined, "前 3 层不应有限制");
});

test("通过塔层推进进度且阶段奖励幂等领取", () => {
  let save = createEmptySave(0);
  assert.equal(getTowerNextFloor(save), 1);
  save = recordTowerVictory(save, 3);
  assert.equal(save.endgame.towerFloorsCleared, 3);
  assert.equal(getTowerNextFloor(save), 4);

  const before = save.inventory.coins;
  save = claimTowerReward(save, 3);
  assert.ok(save.inventory.coins > before, "第 3 层奖励应发放星币");
  const afterFirst = save.inventory.coins;
  save = claimTowerReward(save, 3);
  assert.equal(save.inventory.coins, afterFirst, "重复领取不应重复发放");
  const view = getTowerView(save);
  assert.ok(!view.pendingRewards.includes(3), "已领取楼层不应再出现在待领列表");
});

test("未达到的楼层无法领取阶段奖励", () => {
  const save = createEmptySave(0);
  const result = claimTowerReward(save, 9);
  assert.equal(result.inventory.coins, save.inventory.coins);
  assert.deepEqual(result.endgame.towerRewardsClaimed, []);
});

test("通关全部 10 层后塔视为完成", () => {
  let save = createEmptySave(0);
  for (const floor of TOWER_FLOORS) save = recordTowerVictory(save, floor.floor);
  assert.equal(save.endgame.towerFloorsCleared, TOWER_TOTAL_FLOORS);
  assert.equal(getTowerNextFloor(save), null);
  const view = getTowerView(save);
  assert.equal(view.complete, true);
  assert.ok(view.pendingRewards.length > 0, "通关后应可领取剩余阶段奖励");
});

test("战斗评分：胜利按剩余 HP 计分，回合与换宠为负项，失败为 0", () => {
  const defeat = computeBattleScore({
    victory: false,
    rounds: 3,
    totalRemainingHp: 100,
    totalMaxHp: 300,
    switchCount: 0,
    baseLevel: 30,
  });
  assert.equal(defeat, 0);

  const clean = computeBattleScore({
    victory: true,
    rounds: 3,
    totalRemainingHp: 300,
    totalMaxHp: 300,
    switchCount: 0,
    baseLevel: 30,
  });
  const swapped = computeBattleScore({
    victory: true,
    rounds: 8,
    totalRemainingHp: 100,
    totalMaxHp: 300,
    switchCount: 2,
    baseLevel: 30,
  });
  assert.ok(clean > swapped, "高剩余 HP、少回合与少换宠应获得更高评分");
  assert.ok(clean > 0);
});

test("最佳纪录只在分数提升时更新", () => {
  const scores: Record<string, number> = {};
  const first = recordBestScore(scores, "tower-1", 500);
  const second = recordBestScore(first, "tower-1", 700);
  const third = recordBestScore(second, "tower-1", 600);
  assert.equal(third["tower-1"], 700);
});

test("首领重战需先击败主线首领，首次奖励幂等", () => {
  let save = createEmptySave(0);
  const views = getRematchViews(save);
  assert.equal(views.length, BOSS_REMATCHES.length);
  assert.ok(
    views.every((view) => !view.unlocked),
    "未击败首领时重战应锁定"
  );

  save = {
    ...save,
    progress: { ...save.progress, defeatedBossIds: ["storm-lord"] },
  };
  assert.equal(isRematchFirstRewardClaimed(save, "storm-lord"), false);
  const before = save.inventory.coins;
  save = claimRematchFirstReward(save, "storm-lord");
  assert.ok(save.inventory.coins > before);
  const after = save.inventory.coins;
  save = claimRematchFirstReward(save, "storm-lord");
  assert.equal(save.inventory.coins, after, "首次奖励只能领取一次");
  assert.equal(
    getRematchViews(save).find((view) => view.rematch.bossId === "storm-lord")?.firstRewardClaimed,
    true
  );
});

test("种子随机序列可复现且可散列", () => {
  assert.equal(hashString("daily-2026-08-21"), hashString("daily-2026-08-21"));
  assert.notEqual(hashString("daily-2026-08-21"), hashString("daily-2026-08-22"));
  const first = mulberry32(42);
  const second = mulberry32(42);
  const sample = Array.from({ length: 20 }, () => first());
  assert.deepEqual(
    sample,
    Array.from({ length: 20 }, () => second())
  );
});

test("试炼塔每层都有可用的物种与奖励定义", () => {
  for (const floor of TOWER_FLOORS) {
    assert.ok(Number.isInteger(floor.speciesId));
    assert.ok(floor.level > 0);
    assert.equal(getTowerFloor(floor.floor)?.floor, floor.floor);
  }
  assert.ok(getTowerReward(3) && getTowerReward(6) && getTowerReward(9) && getTowerReward(10));
  assert.equal(getTowerReward(1), undefined);
});
