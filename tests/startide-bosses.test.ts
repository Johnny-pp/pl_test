import test from "node:test";
import assert from "node:assert/strict";
import { BOSSES, bossesById, getBossesForRegion } from "../src/battle/bosses.ts";

test("星潮群岛包含 2 个精英与 1 个多阶段终章首领", () => {
  const startide = getBossesForRegion("startide-archipelago");
  assert.equal(startide.length, 3);
  const elites = startide.filter((boss) => boss.rules.phaseThreshold === 0);
  const finalBoss = startide.filter((boss) => boss.rules.phaseThreshold > 0);
  assert.equal(elites.length, 2);
  assert.equal(finalBoss.length, 1);
});

test("终章首领具备半血强化的多阶段规则", () => {
  const boss = bossesById.get("abyssal-colossus");
  assert.ok(boss);
  assert.equal(boss!.region, "startide-archipelago");
  assert.equal(boss!.level, 22);
  assert.equal(boss!.rules.statusResistance, 60);
  assert.equal(boss!.rules.phaseThreshold, 0.5);
  assert.equal(boss!.rules.phaseAttackBoost, 30);
  assert.equal(boss!.rules.phaseDefenseBoost, 25);
});

test("精英首领关联正确物种且不具备阶段机制", () => {
  const tidewarden = bossesById.get("tidewarden");
  const mire = bossesById.get("mire-sovereign");
  assert.ok(tidewarden && tidewarden.speciesId === 47);
  assert.ok(mire && mire.speciesId === 49);
  assert.equal(tidewarden!.rules.phaseThreshold, 0);
  assert.equal(mire!.rules.phaseThreshold, 0);
});

test("所有首领均可在索引中按 id 检索", () => {
  for (const boss of BOSSES) {
    assert.equal(bossesById.get(boss.id), boss);
  }
});
