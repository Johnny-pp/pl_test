import assert from "node:assert/strict";
import test from "node:test";
import { createPatrolPath } from "../src/world/autoExploration.ts";
import { TILE_ENCOUNTER, TILE_GROUND, TILE_WALL, createWorldMap } from "../src/world/worldMap.ts";

test("自动巡逻会绕开墙体并抵达遭遇区", () => {
  const map = [
    [TILE_WALL, TILE_WALL, TILE_WALL, TILE_WALL, TILE_WALL],
    [TILE_WALL, TILE_GROUND, TILE_WALL, TILE_ENCOUNTER, TILE_WALL],
    [TILE_WALL, TILE_GROUND, TILE_GROUND, TILE_GROUND, TILE_WALL],
    [TILE_WALL, TILE_WALL, TILE_WALL, TILE_WALL, TILE_WALL],
  ];
  const path = createPatrolPath(map, { x: 1, y: 1 }, () => 0);
  assert.deepEqual(path, [
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 3, y: 1 },
  ]);
  assert.ok(path.every((point) => map[point.y][point.x] !== TILE_WALL));
});

test("自动巡逻拒绝墙内起点和不可达遭遇区", () => {
  const blocked = [
    [TILE_WALL, TILE_WALL, TILE_WALL],
    [TILE_WALL, TILE_GROUND, TILE_WALL],
    [TILE_WALL, TILE_WALL, TILE_ENCOUNTER],
  ];
  assert.deepEqual(createPatrolPath(blocked, { x: 0, y: 0 }), []);
  assert.deepEqual(createPatrolPath(blocked, { x: 1, y: 1 }), []);
});

test("两张正式地图都能从出生点规划巡逻路线", () => {
  for (const region of ["frontier", "cloudridge-highlands"] as const) {
    const path = createPatrolPath(createWorldMap(region), { x: 3, y: 14 }, () => 0.5);
    assert.ok(path.length > 0);
    const target = path.at(-1)!;
    assert.equal(createWorldMap(region)[target.y][target.x], TILE_ENCOUNTER);
  }
});
