import test from "node:test";
import assert from "node:assert/strict";
import {
  getTidePhase,
  isSporeActive,
  isSporeHazardActive,
  getFogSectorAtTile,
  startideExplorationCompletion,
  isStartideRegion,
  STARTIDE_DISCOVERIES,
  STARTIDE_CHESTS,
  STARTIDE_WAYPOINTS,
  STARTIDE_FOG_SECTORS,
} from "../src/world/startideContent.ts";

test("潮汐按白昼/夜晚划分为退潮与涨潮", () => {
  assert.equal(getTidePhase(10), "ebb");
  assert.equal(getTidePhase(17), "ebb");
  assert.equal(getTidePhase(20), "flood");
  assert.equal(getTidePhase(3), "flood");
});

test("孢雾只在沉星遗迹夜间活跃，且可在观测台信标处规避", () => {
  assert.equal(isSporeActive("sunken-observatory", "night"), true);
  assert.equal(isSporeActive("sunken-observatory", "day"), false);
  assert.equal(isSporeActive("glowmire-wilds", "night"), false);
  assert.equal(isSporeHazardActive("sunken-observatory", "night", 200, 200, []), true);
  assert.equal(
    isSporeHazardActive("sunken-observatory", "night", 200, 200, ["startide-discovery-observatory"]),
    false
  );
});

test("迷雾扇区按象限正确划分", () => {
  assert.equal(getFogSectorAtTile(2, 20), "startide-sector-haven");
  assert.equal(getFogSectorAtTile(20, 20), "startide-sector-mire");
  assert.equal(getFogSectorAtTile(30, 20), "startide-sector-observatory");
  assert.equal(getFogSectorAtTile(30, 5), "startide-sector-observatory");
  assert.equal(getFogSectorAtTile(20, 5), "startide-sector-mire");
});

test("探索完成度覆盖发现、宝箱、传送点与迷雾", () => {
  assert.equal(startideExplorationCompletion([], [], [], []), 0);
  const full = startideExplorationCompletion(
    STARTIDE_DISCOVERIES.map((d) => d.id),
    STARTIDE_CHESTS.map((c) => c.id),
    STARTIDE_WAYPOINTS.map((w) => w.id),
    STARTIDE_FOG_SECTORS.map((s) => s.id)
  );
  assert.equal(full, 100);
  const partial = startideExplorationCompletion([STARTIDE_DISCOVERIES[0].id], [], [], []);
  assert.ok(partial > 0 && partial < 100);
});

test("isStartideRegion 仅对星潮群岛返回真", () => {
  assert.equal(isStartideRegion("startide-archipelago"), true);
  assert.equal(isStartideRegion("frontier"), false);
  assert.equal(isStartideRegion("cloudridge-highlands"), false);
});
