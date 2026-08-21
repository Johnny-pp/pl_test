import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave } from "../src/player/playerState.ts";
import {
  canUnlockTech,
  getTechBonuses,
  TECH_TREE,
  unlockTech,
} from "../src/base/techTree.ts";
import {
  assembleAdvancedOrb,
  assembleEquipment,
  canAssembleEquipment,
  canAssembleOrb,
  canSmelt,
  smeltMetal,
} from "../src/base/processing.ts";
import {
  BASE_ORDERS,
  completeOrder,
  getOrderClaimed,
} from "../src/base/baseOrders.ts";

function richSave() {
  const save = createEmptySave();
  save.base.resources.stone = 500;
  save.base.resources.wood = 500;
  save.base.resources.fiber = 500;
  save.base.resources.ore = 100;
  save.base.resources.crystal = 100;
  save.base.resources.metal = 50;
  save.base.resources.food = 100;
  save.base.placedFacilities[0] = { facilityId: "warehouse", level: 3, gridX: 0, gridY: 0 };
  save.base.placedFacilities[2] = { facilityId: "workshop", level: 3, gridX: 0, gridY: 2 };
  return save;
}

test("科技树覆盖地区进度、首领素材与基地等级解锁条件", () => {
  const save = richSave();
  const smelting = TECH_TREE.find((tech) => tech.id === "tech-smelting")!;
  assert.equal(canUnlockTech(save, smelting), true, "工坊 2 级即可解锁冶炼");

  const assembly = TECH_TREE.find((tech) => tech.id === "tech-assembly")!;
  assert.equal(canUnlockTech(save, assembly), false, "未解锁冶炼/未到达星潮时装配不可用");
  save.base.techIds = ["tech-smelting"];
  save.progress.unlockedRegions.push("startide-archipelago");
  assert.equal(canUnlockTech(save, assembly), true);
});

test("解锁科技会消耗资源且重复解锁无效", () => {
  let save = richSave();
  const before = save.base.resources.stone;
  save = unlockTech(save, "tech-smelting");
  assert.equal(save.base.techIds.includes("tech-smelting"), true);
  assert.ok(save.base.resources.stone < before);
  assert.equal(unlockTech(save, "tech-smelting"), save);
});

test("科技加成真实作用于生产", () => {
  const save = richSave();
  save.base.techIds = ["tech-logistics", "tech-foundation", "tech-refining"];
  const bonuses = getTechBonuses(save);
  assert.equal(bonuses.workSpeedPercent, 10);
  assert.equal(bonuses.resourceYieldPercent, 10);
  assert.equal(bonuses.metalCostFactor, 0.8);
  assert.equal(bonuses.capacityMultiplier, 1.25);
});

test("加工链：熔炉把矿石熔炼为金属，装配台制造成品", () => {
  let save = richSave();
  save.base.techIds = ["tech-smelting", "tech-assembly"];
  save.base.placedFacilities.push({ facilityId: "forge", level: 1, gridX: 2, gridY: 2 });
  save.base.placedFacilities.push({ facilityId: "assembly", level: 1, gridX: 4, gridY: 2 });

  assert.equal(canSmelt(save), true);
  const oreBefore = save.base.resources.ore;
  save = smeltMetal(save);
  assert.equal(save.base.resources.metal, richSave().base.resources.metal + 1);
  assert.ok(save.base.resources.ore < oreBefore);

  assert.equal(canAssembleOrb(save), true);
  const orbBefore = save.inventory.advancedCaptureOrbs;
  save = assembleAdvancedOrb(save);
  assert.equal(save.inventory.advancedCaptureOrbs, orbBefore + 1);

  assert.equal(canAssembleEquipment(save), true);
  const equipBefore = save.inventory.equipment.length;
  save = assembleEquipment(save);
  assert.equal(save.inventory.equipment.length, equipBefore + 1);
  assert.equal(save.inventory.equipment.at(-1)?.equipmentId, "armor-reinforced-mail");
});

test("精炼科技降低熔炼资源消耗", () => {
  let normal = richSave();
  let refined = richSave();
  normal.base.techIds = ["tech-smelting"];
  refined.base.techIds = ["tech-smelting", "tech-refining"];
  normal.base.placedFacilities.push({ facilityId: "forge", level: 1, gridX: 2, gridY: 2 });
  refined.base.placedFacilities.push({ facilityId: "forge", level: 1, gridX: 2, gridY: 2 });
  const normalStone = normal.base.resources.stone;
  const refinedStone = refined.base.resources.stone;
  normal = smeltMetal(normal);
  refined = smeltMetal(refined);
  assert.ok(normalStone - normal.base.resources.stone > refinedStone - refined.base.resources.stone);
});

test("订单是可重复消耗资源的补偿目标", () => {
  let save = richSave();
  assert.ok(BASE_ORDERS.length >= 3);
  const order = BASE_ORDERS[0];
  assert.equal(getOrderClaimed(save, order.id), 0);
  assert.equal(completeOrder(save, "missing"), save);
  const coinsBefore = save.inventory.coins;
  save = completeOrder(save, order.id);
  assert.equal(getOrderClaimed(save, order.id), 1);
  assert.equal(save.inventory.coins, coinsBefore + (order.rewards.coins ?? 0));
  const resave = completeOrder(save, order.id);
  assert.equal(getOrderClaimed(resave, order.id), 2, "订单可重复领取");
});

test("资源不足时订单与加工都不会扣除", () => {
  const save = richSave();
  save.base.resources.metal = 0;
  save.base.resources.ore = 0;
  const order = BASE_ORDERS.find((entry) => entry.cost.metal && entry.cost.metal > 0)!;
  assert.equal(completeOrder(save, order.id), save);
  save.base.techIds = ["tech-smelting"];
  save.base.placedFacilities.push({ facilityId: "forge", level: 1, gridX: 2, gridY: 2 });
  assert.equal(canSmelt(save), false);
  assert.equal(smeltMetal(save), save);
});
