import test from "node:test";
import assert from "node:assert/strict";
import { assignWorker, craftItem, simulateProduction, upgradeFacility } from "../src/base/baseSystem.ts";
import { addCapturedPal, createEmptySave, createPalInstance } from "../src/player/playerState.ts";
import type { Pal } from "../src/types/pal.ts";

const worker: Pal = {
  id: 9, name: { zh: "工兽", en: "Worker" }, rarity: 1, size: "small", elements: ["grass"], catchRate: 50, foodAmount: 2,
  stats: { hp: 80, attack: 60, defense: 60, workSpeed: 120, moveSpeed: 100, rideSprintSpeed: 0 },
  growth: { hpPerLevel: 4, attackPerLevel: 3, defensePerLevel: 3, experienceCurve: "medium" },
  workSuitability: [{ type: "planting", level: 2 }], activeSkills: ["quick-strike"],
};
const species = new Map([[worker.id, worker]]);

test("只有具备对应工作适性的幻兽才能分配岗位", () => {
  const instance = createPalInstance(worker, () => "worker-1");
  const save = addCapturedPal(createEmptySave(0), instance);
  assert.equal(assignWorker(save, instance.uid, "mining", species), save);
  assert.equal(assignWorker(save, instance.uid, "planting", species).base.assignments.length, 1);
});

test("时间生产受适性和工作速度影响并更新结算时间", () => {
  const instance = createPalInstance(worker, () => "worker-1");
  let save = addCapturedPal(createEmptySave(0), instance);
  save = assignWorker(save, instance.uid, "planting", species);
  const produced = simulateProduction(save, species, 60 * 60_000);
  assert.ok(produced.base.resources.food > save.base.resources.food);
  assert.equal(produced.base.lastUpdatedAt, 60 * 60_000);
});

test("制造物品会消耗资源并增加库存", () => {
  const save = createEmptySave(0);
  save.base.resources.crystal = 10;
  const crafted = craftItem(save, "capture-orb");
  assert.equal(crafted.inventory.captureOrbs, save.inventory.captureOrbs + 1);
  assert.ok(crafted.base.resources.wood < save.base.resources.wood);
});

test("设施资源不足时不会升级", () => {
  const save = createEmptySave(0);
  assert.equal(upgradeFacility(save, "warehouse"), save);
  save.base.resources.wood = 100;
  save.base.resources.stone = 100;
  assert.equal(upgradeFacility(save, "warehouse").base.facilities.warehouse, 2);
});
