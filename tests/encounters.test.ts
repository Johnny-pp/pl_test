import test from "node:test";
import assert from "node:assert/strict";
import { getTimePeriod, getZoneAtTile, pickEncounter } from "../src/world/encounters.ts";
import { TILE_WALL, WORLD_COLS, WORLD_ROWS, createWorldMap } from "../src/world/worldMap.ts";

test("昼夜边界按 6 点和 18 点切换", () => {
  assert.equal(getTimePeriod(5), "night");
  assert.equal(getTimePeriod(6), "day");
  assert.equal(getTimePeriod(17), "day");
  assert.equal(getTimePeriod(18), "night");
});

test("地图左右区域使用不同遭遇表", () => {
  assert.equal(getZoneAtTile(19), "sunlit-meadow");
  assert.equal(getZoneAtTile(20), "echo-ruins");
  assert.equal(pickEncounter("sunlit-meadow", "day", () => 0), 1);
  assert.equal(pickEncounter("echo-ruins", "night", () => 0.999), 30);
});

test("瓦片地图四周均为不可通行边界", () => {
  const map = createWorldMap();
  assert.equal(map.length, WORLD_ROWS);
  assert.equal(map[0].length, WORLD_COLS);
  assert.ok(map[0].every((tile) => tile === TILE_WALL));
  assert.ok(map[WORLD_ROWS - 1].every((tile) => tile === TILE_WALL));
  assert.ok(map.every((row) => row[0] === TILE_WALL && row[WORLD_COLS - 1] === TILE_WALL));
});
