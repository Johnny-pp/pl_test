import test from "node:test";
import assert from "node:assert/strict";
import { BREEDING_FOOD_COST, breed, hatchEgg, previewOffspring } from "../src/breeding/breedingSystem.ts";
import { addCapturedPal, createEmptySave, createPalInstance } from "../src/player/playerState.ts";
import type { Pal } from "../src/types/pal.ts";

function species(id: number, power: number, rarity = 1): Pal {
  return {
    id,
    name: { zh: `幻兽${id}`, en: `Pal${id}` },
    rarity,
    size: "small",
    elements: ["neutral"],
    catchRate: 50,
    foodAmount: 2,
    stats: { hp: 80, attack: 60, defense: 60, workSpeed: 100, moveSpeed: 100, rideSprintSpeed: 0 },
    growth: { hpPerLevel: 4, attackPerLevel: 3, defensePerLevel: 3, experienceCurve: "medium" },
    workSuitability: [],
    activeSkills: ["quick-strike"],
    breeding: { power, parents: [] },
  };
}

const pool = [species(1, 10), species(2, 30), species(3, 50, 4)];

function parents() {
  let save = createEmptySave(0);
  save.base.resources.food = 100;
  save = addCapturedPal(
    save,
    createPalInstance(pool[0], () => "a", undefined, ["windstep"])
  );
  save = addCapturedPal(
    save,
    createPalInstance(pool[2], () => "b", undefined, ["stonehide"])
  );
  return save;
}

test("后代按父母共鸣力稳定匹配最接近物种", () => {
  assert.equal(previewOffspring(pool[0], pool[2], pool)?.id, 2);
});

test("配种消耗食物并将蛋加入队列", () => {
  const save = parents();
  const result = breed(
    save,
    "a",
    "b",
    pool,
    ["windstep"],
    () => 0,
    1000,
    () => "egg-1"
  );
  assert.equal(result.egg?.speciesId, 2);
  assert.equal(result.save.breedingEggs.length, 1);
  assert.equal(result.save.base.resources.food, save.base.resources.food - BREEDING_FOOD_COST);
  assert.deepEqual(result.egg?.passiveSkillIds, ["windstep", "stonehide"]);
});

test("未到时间不能孵化，到时生成带继承被动的新个体", () => {
  const bred = breed(
    parents(),
    "a",
    "b",
    pool,
    [],
    () => 0,
    1000,
    () => "egg-1"
  ).save;
  assert.equal(hatchEgg(bred, "egg-1", pool, 1001), bred);
  const hatched = hatchEgg(bred, "egg-1", pool, 999_999, () => "child");
  assert.equal(hatched.breedingEggs.length, 0);
  assert.ok(hatched.ownedPals.some((pal) => pal.uid === "child" && pal.speciesId === 2));
});

test("同一个体不能与自己配种", () => {
  assert.equal(breed(parents(), "a", "a", pool, [], () => 0).error, "same-parent");
});
