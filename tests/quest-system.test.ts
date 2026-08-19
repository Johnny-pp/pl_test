import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave } from "../src/player/playerState.ts";
import {
  canChallengeBoss,
  claimQuestReward,
  getQuestViews,
  recordBossVictory,
  recordQuestEvent,
} from "../src/quests/questSystem.ts";
import { unlockHighlandRegion } from "../src/world/regions.ts";

function record(save: ReturnType<typeof createEmptySave>, type: "battle-win" | "capture", times: number) {
  let next = save;
  for (let index = 0; index < times; index += 1) next = recordQuestEvent(next, { type });
  return next;
}

test("任务按前置条件自动激活并正确累计事件", () => {
  let save = createEmptySave();
  assert.equal(getQuestViews(save)[0].status, "active");
  assert.equal(getQuestViews(save)[1].status, "locked");
  save = record(save, "battle-win", 3);
  save = record(save, "capture", 2);
  const first = getQuestViews(save)[0];
  assert.equal(first.status, "complete");
  assert.equal(first.state.progress["battle-win"], 3);
  assert.equal(first.state.progress.capture, 2);
});

test("任务奖励只能领取一次且会连接高地解锁", () => {
  let save = createEmptySave();
  save.progress.battlesWon = 3;
  save.progress.captures = 2;
  save = record(save, "battle-win", 3);
  save = record(save, "capture", 2);
  const rewarded = claimQuestReward(save, "frontier-preparation");
  assert.equal(rewarded.base.resources.wood, 50);
  assert.equal(rewarded.base.resources.stone, 30);
  assert.equal(rewarded.base.resources.crystal, 5);
  assert.equal(claimQuestReward(rewarded, "frontier-preparation"), rewarded);

  const unlocked = unlockHighlandRegion(rewarded);
  assert.equal(getQuestViews(unlocked)[1].status, "active");
});

test("高地踏勘完成后才能挑战首领，首领奖励持久且幂等", () => {
  let save = createEmptySave();
  save.progress.unlockedRegions.push("cloudridge-highlands");
  save.progress.quests[0].rewardClaimed = true;
  for (let index = 0; index < 3; index += 1) {
    save = recordQuestEvent(save, { type: "gather", region: "cloudridge-highlands" });
  }
  save = recordQuestEvent(save, { type: "craft" });
  save = claimQuestReward(save, "highland-survey");
  assert.equal(canChallengeBoss(save, "storm-lord"), true);

  const defeated = recordBossVictory(save, "storm-lord");
  assert.equal(defeated.progress.defeatedBossIds.filter((id) => id === "storm-lord").length, 1);
  assert.equal(getQuestViews(defeated)[2].status, "complete");
  assert.equal(recordBossVictory(defeated, "storm-lord"), defeated);

  const rewarded = claimQuestReward(defeated, "storm-lord-challenge");
  assert.ok(rewarded.progress.unlockedAbilities.includes("storm-forging"));
  assert.equal(rewarded.base.resources.crystal, defeated.base.resources.crystal + 20);
  assert.equal(claimQuestReward(rewarded, "storm-lord-challenge"), rewarded);
});

test("不匹配地区和首领的事件不会推进任务", () => {
  const save = createEmptySave();
  save.progress.unlockedRegions.push("cloudridge-highlands");
  save.progress.quests[0].rewardClaimed = true;
  const next = recordQuestEvent(save, { type: "gather", region: "frontier" });
  assert.equal(next, save);
  assert.equal(recordBossVictory(save, "unknown-boss").progress.quests[2].progress["storm-lord"], undefined);
});
