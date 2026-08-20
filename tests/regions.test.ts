import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave } from "../src/player/playerState.ts";
import {
  getHighlandUnlockStatus,
  getStartideUnlockStatus,
  HIGHLAND_REGION,
  STARTIDE_REGION,
  unlockHighlandRegion,
  unlockStartideRegion,
} from "../src/world/regions.ts";

test("云脊高地会明确报告尚未满足的进度和资源", () => {
  const status = getHighlandUnlockStatus(createEmptySave());
  assert.equal(status.unlocked, false);
  assert.equal(status.eligible, false);
  assert.ok(status.missing.some((item) => item.startsWith("胜利")));
  assert.ok(status.missing.some((item) => item.startsWith("捕获")));
  assert.ok(status.missing.some((item) => item.startsWith("木材")));
  assert.ok(status.missing.some((item) => item.startsWith("石材")));
  assert.ok(status.missing.some((item) => item.startsWith("晶体")));
});

test("满足条件后解锁会消耗基地资源且不可重复扣费", () => {
  const save = createEmptySave();
  save.progress.battlesWon = 3;
  save.progress.captures = 2;
  save.base.resources.wood = 40;
  save.base.resources.stone = 30;
  save.base.resources.crystal = 8;
  const unlocked = unlockHighlandRegion(save);
  assert.notEqual(unlocked, save);
  assert.ok(unlocked.progress.unlockedRegions.includes(HIGHLAND_REGION));
  assert.equal(unlocked.base.resources.wood, 10);
  assert.equal(unlocked.base.resources.stone, 10);
  assert.equal(unlocked.base.resources.crystal, 3);
  assert.equal(getHighlandUnlockStatus(unlocked).unlocked, true);
  assert.equal(unlockHighlandRegion(unlocked), unlocked);
});

test("条件不足时不会解锁或消耗资源", () => {
  const save = createEmptySave();
  assert.equal(unlockHighlandRegion(save), save);
});

test("星潮群岛需要风暴任务能力、胜场和修复渡门资源", () => {
  const save = createEmptySave();
  const status = getStartideUnlockStatus(save);
  assert.equal(status.unlocked, false);
  assert.equal(status.eligible, false);
  assert.ok(status.missing.some((item) => item.includes("风暴领主")));
  assert.ok(status.missing.some((item) => item.startsWith("胜利")));
  assert.ok(status.missing.some((item) => item.startsWith("食物")));
  assert.ok(status.missing.some((item) => item.startsWith("石材")));
  assert.ok(status.missing.some((item) => item.startsWith("晶体")));
});

test("星潮群岛满足条件后只扣费一次并保持高地解锁", () => {
  const save = createEmptySave();
  save.progress.unlockedRegions.push(HIGHLAND_REGION);
  save.progress.unlockedAbilities.push("storm-forging");
  save.progress.battlesWon = 10;
  save.base.resources.food = 50;
  save.base.resources.stone = 45;
  save.base.resources.crystal = 25;
  const unlocked = unlockStartideRegion(save);
  assert.ok(unlocked.progress.unlockedRegions.includes(STARTIDE_REGION));
  assert.ok(unlocked.progress.unlockedRegions.includes(HIGHLAND_REGION));
  assert.equal(unlocked.base.resources.food, 10);
  assert.equal(unlocked.base.resources.stone, 10);
  assert.equal(unlocked.base.resources.crystal, 5);
  assert.equal(getStartideUnlockStatus(unlocked).unlocked, true);
  assert.equal(unlockStartideRegion(unlocked), unlocked);
});
