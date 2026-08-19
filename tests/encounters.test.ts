import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ENCOUNTER_TABLES,
  getEncounterLevelFloor,
  getTimePeriod,
  getZoneAtTile,
  pickEncounter,
} from "../src/world/encounters.ts";
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
  assert.equal(
    pickEncounter("sunlit-meadow", "day", () => 0),
    1
  );
  assert.equal(
    pickEncounter("echo-ruins", "night", () => 0.999),
    30
  );
});

test("云脊高地拥有独立昼夜遭遇与等级下限", () => {
  assert.equal(getZoneAtTile(19, "cloudridge-highlands"), "mist-terrace");
  assert.equal(getZoneAtTile(20, "cloudridge-highlands"), "storm-ridge");
  assert.equal(
    pickEncounter("mist-terrace", "day", () => 0),
    34
  );
  assert.equal(
    pickEncounter("storm-ridge", "night", () => 0.999),
    36
  );
  assert.equal(getEncounterLevelFloor("mist-terrace"), 6);
  assert.equal(getEncounterLevelFloor("storm-ridge"), 9);
});

test("瓦片地图四周均为不可通行边界", () => {
  const map = createWorldMap();
  assert.equal(map.length, WORLD_ROWS);
  assert.equal(map[0].length, WORLD_COLS);
  assert.ok(map[0].every((tile) => tile === TILE_WALL));
  assert.ok(map[WORLD_ROWS - 1].every((tile) => tile === TILE_WALL));
  assert.ok(map.every((row) => row[0] === TILE_WALL && row[WORLD_COLS - 1] === TILE_WALL));
});

test("第二地区使用不同的障碍与遭遇区地图", () => {
  const frontier = createWorldMap("frontier");
  const highland = createWorldMap("cloudridge-highlands");
  assert.notDeepEqual(highland, frontier);
  assert.ok(highland[0].every((tile) => tile === TILE_WALL));
  assert.ok(highland[WORLD_ROWS - 1].every((tile) => tile === TILE_WALL));
  assert.ok(highland.every((row) => row[0] === TILE_WALL && row[WORLD_COLS - 1] === TILE_WALL));
});

test("所有遭遇表只引用存在的物种", () => {
  const species = JSON.parse(readFileSync(new URL("../data/pals.json", import.meta.url), "utf-8")) as Array<{
    id: number;
  }>;
  const ids = new Set(species.map((pal) => pal.id));
  for (const periods of Object.values(ENCOUNTER_TABLES)) {
    for (const entries of Object.values(periods)) {
      for (const entry of entries) assert.ok(ids.has(entry.speciesId), `不存在的物种 ${entry.speciesId}`);
    }
  }
});
