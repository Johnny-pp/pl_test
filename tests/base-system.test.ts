import test from "node:test";
import assert from "node:assert/strict";
import {
  assignWorker,
  consumeCaptureOrb,
  craftItem,
  simulateProduction,
  upgradeFacility,
  useHealingTonic,
} from "../src/base/baseSystem.ts";
import { addCapturedPal, createEmptySave, createPalInstance } from "../src/player/playerState.ts";
import type { Pal } from "../src/types/pal.ts";

const worker: Pal = {
  id: 9,
  name: { zh: "工兽", en: "Worker" },
  rarity: 1,
  size: "small",
  elements: ["grass"],
  catchRate: 50,
  foodAmount: 2,
  stats: { hp: 80, attack: 60, defense: 60, workSpeed: 120, moveSpeed: 100, rideSprintSpeed: 0 },
  growth: { hpPerLevel: 4, attackPerLevel: 3, defensePerLevel: 3, experienceCurve: "medium" },
  workSuitability: [{ type: "planting", level: 2 }],
  activeSkills: ["quick-strike"],
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

test("工作与资源被动会按统一规则提高基地实际产量", () => {
  const normalInstance = createPalInstance(worker, () => "normal-worker");
  const passiveInstance = createPalInstance(worker, () => "passive-worker", undefined, [
    "master_crafter",
    "trail_sense",
  ]);
  let normal = addCapturedPal(createEmptySave(0), normalInstance);
  let boosted = addCapturedPal(createEmptySave(0), passiveInstance);
  normal = assignWorker(normal, normalInstance.uid, "planting", species);
  boosted = assignWorker(boosted, passiveInstance.uid, "planting", species);
  const normalFood = simulateProduction(normal, species, 60 * 60_000).base.resources.food;
  const boostedFood = simulateProduction(boosted, species, 60 * 60_000).base.resources.food;
  assert.ok(boostedFood > normalFood);
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

test("捕获器与治疗剂会实际消耗库存", () => {
  let save = createEmptySave(0);
  const consumed = consumeCaptureOrb(save);
  assert.equal(consumed.consumed, true);
  assert.equal(consumed.save.inventory.captureOrbs, save.inventory.captureOrbs - 1);

  const instance = { ...createPalInstance(worker, () => "worker-1"), currentHp: 1 };
  save = addCapturedPal(save, instance);
  save.inventory.healingTonics = 1;
  const healed = useHealingTonic(save, instance.uid, worker.stats.hp);
  assert.equal(healed.ownedPals[0].currentHp, worker.stats.hp);
  assert.equal(healed.inventory.healingTonics, 0);
});
