import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addCapturedPal,
  createEmptySave,
  createPalInstance,
  recordBattleWin,
} from "../src/player/playerState.ts";
import {
  claimQuestReward,
  getQuestViews,
  recordBossVictory,
  recordQuestEvent,
} from "../src/quests/questSystem.ts";
import { unlockHighlandRegion } from "../src/world/regions.ts";
import { craftItem } from "../src/base/baseSystem.ts";
import { BALANCE_BASELINE } from "../src/balance/balanceBaseline.ts";
import { awardBattleExperience } from "../src/progression/progression.ts";
import { INCUBATION_MS } from "../src/breeding/breedingSystem.ts";
import type { Pal } from "../src/types/pal.ts";

const pals = JSON.parse(readFileSync(new URL("../data/pals.json", import.meta.url), "utf-8")) as Pal[];

test("全新存档可按任务链走通高地解锁、制造和首领奖励", () => {
  let save = createEmptySave(0);
  for (let index = 0; index < BALANCE_BASELINE.highlandUnlock.battlesWon; index += 1) {
    save = recordBattleWin(save);
    save = recordQuestEvent(save, { type: "battle-win" });
  }
  for (let index = 0; index < BALANCE_BASELINE.highlandUnlock.captures; index += 1) {
    save = addCapturedPal(
      save,
      createPalInstance(pals[index], () => `loop-pal-${index}`)
    );
    save = recordQuestEvent(save, { type: "capture" });
  }
  assert.equal(getQuestViews(save)[0].status, "complete");
  save = claimQuestReward(save, "frontier-preparation");
  save = unlockHighlandRegion(save);
  assert.ok(save.progress.unlockedRegions.includes("cloudridge-highlands"));

  for (let index = 0; index < 3; index += 1)
    save = recordQuestEvent(save, { type: "gather", region: "cloudridge-highlands" });
  const crafted = craftItem(save, "healing-tonic");
  assert.notEqual(crafted, save);
  save = recordQuestEvent(crafted, { type: "craft" });
  save = claimQuestReward(save, "highland-survey");
  assert.equal(getQuestViews(save)[2].status, "active");

  save = recordBossVictory(save, "storm-lord");
  save = claimQuestReward(save, "storm-lord-challenge");
  assert.ok(save.progress.unlockedAbilities.includes("storm-forging"));
  assert.ok(save.base.resources.crystal >= 20);
  const claimedIds = getQuestViews(save)
    .filter((view) => view.status === "claimed")
    .map((view) => view.definition.id);
  assert.ok(
    ["frontier-preparation", "highland-survey", "storm-lord-challenge"].every((id) => claimedIds.includes(id))
  );
});

test("经验与孵化节奏处于长期循环基线内", () => {
  const species = pals.find((pal) => pal.growth.experienceCurve === "medium")!;
  let instance = createPalInstance(species, () => "training-pal");
  let battles = 0;
  while (
    instance.level < BALANCE_BASELINE.recommendedBossLevel &&
    battles < BALANCE_BASELINE.maximumTrainingBattles
  ) {
    instance = awardBattleExperience(instance, species, instance.level + 1, 2).instance;
    battles += 1;
  }
  assert.ok(instance.level >= BALANCE_BASELINE.recommendedBossLevel);
  assert.ok(battles <= BALANCE_BASELINE.maximumTrainingBattles);
  assert.ok(Math.max(...Object.values(INCUBATION_MS)) <= BALANCE_BASELINE.maximumIncubationMs);
});
