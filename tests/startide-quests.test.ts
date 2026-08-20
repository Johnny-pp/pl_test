import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave } from "../src/player/playerState.ts";
import {
  getQuestViews,
  claimQuestReward,
  recordQuestEvent,
  recordBossVictory,
  canChallengeBoss,
} from "../src/quests/questSystem.ts";

function withPriorChainClaimed() {
  const save = createEmptySave();
  save.progress.unlockedRegions.push("startide-archipelago");
  save.progress.quests = save.progress.quests.map((quest) => ({
    ...quest,
    rewardClaimed:
      quest.id === "frontier-preparation" ||
      quest.id === "highland-survey" ||
      quest.id === "storm-lord-challenge",
  }));
  return save;
}

test("星潮远航在解锁前处于锁定，解锁后转为可接取", () => {
  const locked = createEmptySave();
  assert.equal(getQuestViews(locked).find((v) => v.definition.id === "startide-voyage")?.status, "locked");
  const unlocked = withPriorChainClaimed();
  assert.equal(getQuestViews(unlocked).find((v) => v.definition.id === "startide-voyage")?.status, "active");
});

test("星潮远航进度可由群岛采集与战斗推进并幂等领奖", () => {
  let save = withPriorChainClaimed();
  for (let i = 0; i < 3; i++)
    save = recordQuestEvent(save, { type: "gather", region: "startide-archipelago" });
  for (let i = 0; i < 4; i++)
    save = recordQuestEvent(save, { type: "battle-win", region: "startide-archipelago" });
  const view = getQuestViews(save).find((v) => v.definition.id === "startide-voyage");
  assert.equal(view?.status, "complete");
  const before = save.base.resources.crystal;
  const claimed = claimQuestReward(save, "startide-voyage");
  assert.equal(claimed.inventory.captureOrbs, save.inventory.captureOrbs + 2);
  assert.equal(claimed.inventory.healingTonics, save.inventory.healingTonics + 3);
  assert.equal(claimQuestReward(claimed, "startide-voyage"), claimed);
  assert.equal(claimed.base.resources.crystal, before);
});

test("沉星终章首领需先完成星潮远航方可挑战，胜利后奖励不可重复领取", () => {
  let save = withPriorChainClaimed();
  assert.equal(canChallengeBoss(save, "abyssal-colossus"), false);
  for (let i = 0; i < 3; i++)
    save = recordQuestEvent(save, { type: "gather", region: "startide-archipelago" });
  for (let i = 0; i < 4; i++)
    save = recordQuestEvent(save, { type: "battle-win", region: "startide-archipelago" });
  save = claimQuestReward(save, "startide-voyage");
  assert.equal(canChallengeBoss(save, "abyssal-colossus"), true);
  const defeated = recordBossVictory(save, "abyssal-colossus");
  assert.ok(defeated.progress.defeatedBossIds.includes("abyssal-colossus"));
  assert.equal(recordBossVictory(defeated, "abyssal-colossus"), defeated);
  const rewarded = claimQuestReward(defeated, "abyssal-colossus-challenge");
  assert.ok(rewarded.progress.unlockedAbilities.includes("tide-navigation"));
  assert.equal(rewarded.base.resources.crystal, defeated.base.resources.crystal + 30);
  assert.equal(claimQuestReward(rewarded, "abyssal-colossus-challenge"), rewarded);
});
