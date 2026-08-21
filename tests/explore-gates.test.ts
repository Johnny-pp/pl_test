import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptySave } from "../src/player/playerState.ts";
import type { Pal } from "../src/types/pal.ts";
import type { ExploreAbility } from "../src/types/exploreAbility.ts";
import {
  canOpenGate,
  EXPLORE_GATES,
  getTeamExploreAbilityIds,
  HIDDEN_CHESTS,
  isHiddenChestAvailable,
  isGateOpened,
  openGate,
} from "../src/explore/gates.ts";

const pals = JSON.parse(
  readFileSync(new URL("../data/pals.json", import.meta.url), "utf-8")
) as Pal[];
const exploreAbilities = JSON.parse(
  readFileSync(new URL("../data/explore-abilities.json", import.meta.url), "utf-8")
) as ExploreAbility[];

const speciesById = new Map(pals.map((pal) => [pal.id, pal]));

test("探索能力数据与物种引用完整", () => {
  assert.equal(exploreAbilities.length >= 4, true);
  const ids = new Set(exploreAbilities.map((ability) => ability.id));
  for (const pal of pals) {
    for (const ability of pal.exploreAbilities ?? []) assert.ok(ids.has(ability));
  }
});

test("队伍中的物种提供对应探索能力", () => {
  const vineSpecies = speciesById.get(1)!;
  assert.ok(vineSpecies.exploreAbilities?.includes("vine-cut"));
  const save = createEmptySave();
  save.teamIds = ["a"];
  save.ownedPals = [{ uid: "a", speciesId: 1 } as never];
  const abilities = getTeamExploreAbilityIds(save, speciesById);
  assert.ok(abilities.has("vine-cut"));
});

test("机关门开启需要队伍具备对应探索能力，且状态持久化", () => {
  const vineGate = EXPLORE_GATES.find((gate) => gate.id === "startide-gate-vine")!;
  const wadeGate = EXPLORE_GATES.find((gate) => gate.id === "startide-gate-wade")!;

  const noAbility = createEmptySave();
  assert.equal(canOpenGate(noAbility, vineGate, speciesById), false);
  assert.equal(openGate(noAbility, vineGate, speciesById), noAbility);

  const withAbility = createEmptySave();
  withAbility.teamIds = ["a"];
  withAbility.ownedPals = [{ uid: "a", speciesId: 1 } as never];
  assert.equal(canOpenGate(withAbility, vineGate, speciesById), true);
  const opened = openGate(withAbility, vineGate, speciesById);
  assert.equal(isGateOpened(opened, vineGate.id), true);
  assert.equal(canOpenGate(opened, vineGate, speciesById), false);

  assert.equal(canOpenGate(opened, wadeGate, speciesById), false);
});

test("隐藏宝箱仅在对应机关开启后可见且不会重复领取", () => {
  const chest = HIDDEN_CHESTS.find((item) => item.id === "startide-chest-hidden-vine")!;
  const save = createEmptySave();
  save.teamIds = ["a"];
  save.ownedPals = [{ uid: "a", speciesId: 1 } as never];
  assert.equal(isHiddenChestAvailable(save, chest, []), false);
  const opened = openGate(save, EXPLORE_GATES.find((gate) => gate.id === chest.requiredGate)!, speciesById);
  assert.equal(isHiddenChestAvailable(opened, chest, []), true);
  assert.equal(isHiddenChestAvailable(opened, chest, [chest.id]), false);
});

test("每个探索能力都实际对应一个可开启机关", () => {
  const gateAbilities = new Set(EXPLORE_GATES.map((gate) => gate.requiredAbility));
  for (const ability of exploreAbilities) {
    assert.ok(gateAbilities.has(ability.id), `${ability.id} 没有对应的机关门`);
  }
});
