import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave, addCoins } from "../src/player/playerState.ts";
import { ELITES, canRebattleElite, getElitesForRegion, recordEliteDefeat } from "../src/explore/elites.ts";

test("精英具有固定身份、明确奖励与可配置重战规则", () => {
  const elites = ELITES;
  assert.ok(elites.length >= 2);
  for (const elite of elites) {
    assert.ok(elite.name.length > 0);
    assert.ok(elite.speciesId > 0);
    assert.ok(elite.level > 0);
    assert.equal(typeof elite.replayCooldownMs, "number");
    assert.ok(elite.rewardLabel.length > 0);
  }
  assert.equal(getElitesForRegion("startide-archipelago").length, elites.length);
});

test("首次击败发放一次性奖励并记录，重战不重复发放", () => {
  const elite = ELITES[0];
  const save = addCoins(createEmptySave(), 0);
  const before = save.inventory.coins;
  const first = recordEliteDefeat(save, elite, 1000);
  assert.equal(first.firstDefeat, true);
  assert.equal(first.save.progress.defeatedEliteIds.includes(elite.id), true);
  assert.equal(first.save.inventory.coins, before + (elite.rewards.coins ?? 0));
  assert.equal(first.save.progress.eliteDefeatTimes[elite.id], 1000);

  const second = recordEliteDefeat(first.save, elite, 2000);
  assert.equal(second.firstDefeat, false);
  assert.equal(second.save.inventory.coins, first.save.inventory.coins);
  assert.equal(second.save.progress.eliteDefeatTimes[elite.id], 2000);
});

test("重战规则受冷却时间约束", () => {
  const elite = ELITES[0];
  let save = createEmptySave();
  const now = 10000;
  save = recordEliteDefeat(save, elite, now).save;
  assert.equal(canRebattleElite(save, elite, now), true);
  assert.equal(canRebattleElite(save, { ...elite, replayCooldownMs: 5000 }, now), false);
  assert.equal(canRebattleElite(save, { ...elite, replayCooldownMs: 5000 }, now + 5000), true);
});
