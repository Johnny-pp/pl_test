import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave } from "../src/player/playerState.ts";
import {
  claimSideQuestReward,
  getSideQuestViews,
  recordEliteVictory,
  recordNpcTalk,
  recordSideQuestEvent,
} from "../src/quests/sideQuests.ts";

function readySave() {
  const save = createEmptySave();
  save.progress.unlockedRegions.push("startide-archipelago");
  save.progress.quests[2].rewardClaimed = true;
  return save;
}

function repeat(
  save: ReturnType<typeof readySave>,
  type: Parameters<typeof recordSideQuestEvent>[1]["type"],
  times: number,
  region?: "startide-archipelago"
) {
  let next = save;
  for (let index = 0; index < times; index += 1) {
    next = recordSideQuestEvent(next, region ? { type, region } : { type });
  }
  return next;
}

test("支线任务按前置与地区解锁后自动激活", () => {
  const save = readySave();
  const views = getSideQuestViews(save);
  assert.equal(views.find((view) => view.definition.id === "side-reedlight-prayer")?.status, "active");
  assert.equal(views.find((view) => view.definition.id === "side-tide-memory")?.status, "locked");
  assert.equal(views.find((view) => view.definition.id === "side-herb-mist")?.status, "active");
});

test("NPC 对话与采集推进芦灯萤语支线", () => {
  let save = readySave();
  save = recordNpcTalk(save, "npc-tao");
  assert.equal(save.progress.talkedNpcIds.includes("npc-tao"), true);
  save = repeat(save, "gather", 3, "startide-archipelago");
  const view = getSideQuestViews(save).find((item) => item.definition.id === "side-reedlight-prayer")!;
  assert.equal(view.status, "complete");
  const claimed = claimSideQuestReward(save, "side-reedlight-prayer");
  assert.equal(claimed.inventory.coins, save.inventory.coins + 80);
  assert.equal(claimed.inventory.captureOrbs, save.inventory.captureOrbs + 1);
  assert.equal(claimSideQuestReward(claimed, "side-reedlight-prayer"), claimed);
});

test("不同目标类型的支线可独立完成", () => {
  let save = readySave();
  save = recordNpcTalk(save, "npc-tao");
  save = repeat(save, "gather", 3, "startide-archipelago");
  save = claimSideQuestReward(save, "side-reedlight-prayer");

  save = repeat(save, "sell", 2);
  save = repeat(save, "buy", 1);
  assert.equal(
    getSideQuestViews(save).find((item) => item.definition.id === "side-merchant-deal")?.status,
    "complete"
  );

  save = recordNpcTalk(save, "npc-ying");
  save = repeat(save, "collect", 3);
  assert.equal(
    getSideQuestViews(save).find((item) => item.definition.id === "side-herb-mist")?.status,
    "complete"
  );
});

test("精英击败、机关与宝箱推进更深层支线", () => {
  let save = readySave();
  save = recordNpcTalk(save, "npc-tao");
  save = repeat(save, "gather", 3, "startide-archipelago");
  save = claimSideQuestReward(save, "side-reedlight-prayer");
  for (let index = 0; index < 2; index += 1) {
    save = recordSideQuestEvent(save, { type: "discover", region: "startide-archipelago" });
  }
  save = repeat(save, "craft", 1);
  save = claimSideQuestReward(save, "side-tide-memory");

  save = recordEliteVictory(save, "elite-plumage-sentinel");
  for (let index = 0; index < 2; index += 1) {
    save = recordSideQuestEvent(save, { type: "battle-win", region: "startide-archipelago" });
  }
  const keeper = getSideQuestViews(save).find((item) => item.definition.id === "side-sunken-keeper")!;
  assert.equal(keeper.status, "complete");
  const claimed = claimSideQuestReward(save, "side-sunken-keeper");
  assert.equal(claimed.base.resources.crystal, save.base.resources.crystal + 10);

  save = repeat(claimed, "ability-use", 1);
  save = repeat(save, "open-chest", 1);
  assert.equal(
    getSideQuestViews(save).find((item) => item.definition.id === "side-shallow-secret")?.status,
    "complete"
  );
  const secretReward = claimSideQuestReward(save, "side-shallow-secret");
  assert.ok(
    secretReward.inventory.equipment.some((item) => item.equipmentId === "charm-ward-totem")
  );
});

test("不符合地区的采集事件不会推进支线", () => {
  let save = readySave();
  save = recordNpcTalk(save, "npc-tao");
  save = recordSideQuestEvent(save, { type: "gather", region: "frontier" });
  const view = getSideQuestViews(save).find((item) => item.definition.id === "side-reedlight-prayer")!;
  assert.equal(view.state.progress["gather-startide"], undefined);
});
