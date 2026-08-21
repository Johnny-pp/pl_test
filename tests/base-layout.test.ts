import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave } from "../src/player/playerState.ts";
import {
  canPlaceFacility,
  getAdjacentFacilityPairs,
  moveFacility,
  placeFacility,
  removeFacility,
} from "../src/base/baseLayout.ts";

function richSave() {
  const save = createEmptySave();
  save.base.resources.stone = 200;
  save.base.resources.wood = 200;
  save.base.resources.fiber = 200;
  save.base.resources.ore = 50;
  save.base.resources.crystal = 50;
  save.base.resources.metal = 20;
  return save;
}

test("初始存档提供确定的默认布局且不与网格冲突", () => {
  const save = createEmptySave();
  const placed = save.base.placedFacilities;
  assert.equal(placed.length, 3);
  const defs = new Set(placed.map((entry) => entry.facilityId));
  assert.deepEqual([...defs].sort(), ["farm", "warehouse", "workshop"]);
  assert.equal(canPlaceFacility(save, "warehouse", placed[0].gridX, placed[0].gridY), false);
});

test("未解锁科技时无法放置熔炉/装配台", () => {
  const save = richSave();
  assert.equal(canPlaceFacility(save, "forge", 2, 0), false);
  assert.equal(placeFacility(save, "forge", 2, 0).ok, false);
});

test("解锁科技后可放置、移动与移除设施且资源结算正确", () => {
  const save = richSave();
  save.base.techIds = ["tech-smelting"];
  const before = save.base.resources.stone;
  const placed = placeFacility(save, "forge", 4, 0);
  assert.equal(placed.ok, true);
  assert.equal(placed.save.base.resources.stone, before - 30);
  assert.equal(
    placed.save.base.placedFacilities.some((entry) => entry.facilityId === "forge"),
    true
  );

  const moved = moveFacility(placed.save, "forge", 4, 2);
  assert.equal(moved.ok, true);
  const forge = moved.save.base.placedFacilities.find((entry) => entry.facilityId === "forge")!;
  assert.equal(forge.gridX, 4);
  assert.equal(forge.gridY, 2);

  const removed = removeFacility(moved.save, "forge");
  assert.equal(
    removed.base.placedFacilities.some((entry) => entry.facilityId === "forge"),
    false
  );
});

test("设施重叠或越界时不可放置", () => {
  const save = richSave();
  save.base.techIds = ["tech-smelting"];
  assert.equal(placeFacility(save, "forge", 0, 0).ok, false, "与仓库重叠");
  assert.equal(placeFacility(save, "forge", 5, 3).ok, false, "越界");
  assert.equal(placeFacility(save, "forge", 4, 0).ok, true, "空位可放置");
});

test("相邻设施能识别邻接关系", () => {
  const save = richSave();
  save.base.techIds = ["tech-smelting", "tech-assembly"];
  const placed = placeFacility(placeFacility(save, "forge", 2, 2).save, "assembly", 4, 2).save;
  const pairs = getAdjacentFacilityPairs(placed);
  assert.ok(pairs.some(([a, b]) => a === "forge" && b === "assembly"));
});
