import test from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_VERSION,
  TEAM_LIMIT,
  addCapturedPal,
  createEmptySave,
  createPalInstance,
  exportSaveBackup,
  importSaveBackup,
  loadGame,
  saveGame,
  toggleTeamMember,
  type StorageLike,
} from "../src/player/playerState.ts";
import type { Pal } from "../src/types/pal.ts";

const species: Pal = {
  id: 7,
  name: { zh: "测试幻兽", en: "Test Pal" },
  rarity: 1,
  elements: ["neutral"],
  stats: { hp: 80, attack: 70, defense: 60, workSpeed: 10, moveSpeed: 100, rideSprintSpeed: 0 },
  growth: { hpPerLevel: 4, attackPerLevel: 3, defensePerLevel: 3, experienceCurve: "medium" },
  workSuitability: [],
  activeSkills: ["quick-strike"],
};

function memoryStorage(initial: string | null = null): StorageLike {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test("捕获个体会自动加入未满的队伍", () => {
  const instance = createPalInstance(
    species,
    () => "pal-1",
    () => "2026-01-01T00:00:00.000Z"
  );
  const save = addCapturedPal(createEmptySave(), instance);
  assert.equal(save.ownedPals.length, 1);
  assert.deepEqual(save.teamIds, ["pal-1"]);
  assert.equal(save.progress.captures, 1);
});

test("队伍不会超过容量限制", () => {
  let save = createEmptySave();
  for (let index = 0; index < TEAM_LIMIT + 1; index += 1) {
    save = addCapturedPal(
      save,
      createPalInstance(species, () => `pal-${index}`)
    );
  }
  assert.equal(save.ownedPals.length, TEAM_LIMIT + 1);
  assert.equal(save.teamIds.length, TEAM_LIMIT);
  assert.equal(toggleTeamMember(save, `pal-${TEAM_LIMIT}`).teamIds.length, TEAM_LIMIT);
});

test("损坏存档回退为空存档，旧字段会迁移并清理无效队伍成员", () => {
  assert.equal(loadGame(memoryStorage("not-json")).ownedPals.length, 0);
  const old = JSON.stringify({ version: 0, ownedPals: [], teamIds: ["missing"] });
  const migrated = loadGame(memoryStorage(old));
  assert.equal(migrated.version, SAVE_VERSION);
  assert.deepEqual(migrated.progress.unlockedRegions, ["frontier"]);
  assert.deepEqual(migrated.teamIds, []);
});

test("存档可完成写入和读取往返", () => {
  const storage = memoryStorage();
  const instance = createPalInstance(species, () => "pal-1");
  const save = addCapturedPal(createEmptySave(), instance);
  save.base.resources.food = 20.5;
  assert.equal(saveGame(storage, save), true);
  assert.deepEqual(loadGame(storage), save);
});

test("存档备份可导出、迁移后导入，并拒绝无关 JSON", () => {
  const save = addCapturedPal(
    createEmptySave(100),
    createPalInstance(species, () => "backup-pal")
  );
  const restored = importSaveBackup(exportSaveBackup(save));
  assert.deepEqual(restored, save);

  const oldBackup = JSON.stringify({ version: 1, ownedPals: [], teamIds: [] });
  assert.equal(importSaveBackup(oldBackup)?.version, SAVE_VERSION);
  assert.equal(importSaveBackup('{"hello":"world"}'), undefined);
  assert.equal(importSaveBackup("not-json"), undefined);
});

test("旧存档迁移会修复损坏的等级、经验和生命值", () => {
  const damaged = createPalInstance(species, () => "damaged-pal");
  damaged.level = -8;
  damaged.experience = -100;
  damaged.currentHp = -20;
  const migrated = loadGame(
    memoryStorage(JSON.stringify({ version: 3, ownedPals: [damaged], teamIds: [damaged.uid] }))
  );
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.ownedPals[0].level, 1);
  assert.equal(migrated.ownedPals[0].experience, 0);
  assert.equal(migrated.ownedPals[0].currentHp, 0);
});

test("v5 存档迁移会补齐任务、首领和能力进度", () => {
  const old = JSON.stringify({
    version: 5,
    ownedPals: [],
    teamIds: [],
    progress: { battlesWon: 8, captures: 4, unlockedRegions: ["frontier"] },
  });
  const migrated = loadGame(memoryStorage(old));
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.progress.quests.length, 5);
  assert.equal(migrated.progress.quests[0].progress["battle-win"], 3);
  assert.equal(migrated.progress.quests[0].progress.capture, 2);
  assert.deepEqual(migrated.progress.defeatedBossIds, []);
  assert.deepEqual(migrated.progress.unlockedAbilities, []);
  assert.deepEqual(migrated.progress.discoveredLocationIds, []);
  assert.deepEqual(migrated.progress.claimedWorldRewardIds, []);
  assert.deepEqual(migrated.progress.activatedWaypointIds, []);
  assert.deepEqual(migrated.progress.revealedSectorIds, []);
});

test("v6 存档保留第三地区并清理重复或损坏的探索进度", () => {
  const old = JSON.stringify({
    version: 6,
    ownedPals: [],
    teamIds: [],
    progress: {
      unlockedRegions: ["frontier", "cloudridge-highlands", "startide-archipelago", "unknown"],
      discoveredLocationIds: ["startide-haven", "startide-haven", 3, ""],
      claimedWorldRewardIds: ["startide-chest-1", null],
      activatedWaypointIds: ["startide-waypoint"],
      revealedSectorIds: ["startide-west", "startide-west"],
    },
  });
  const migrated = loadGame(memoryStorage(old));
  assert.equal(migrated.version, SAVE_VERSION);
  assert.deepEqual(migrated.progress.unlockedRegions, [
    "frontier",
    "cloudridge-highlands",
    "startide-archipelago",
  ]);
  assert.deepEqual(migrated.progress.discoveredLocationIds, ["startide-haven"]);
  assert.deepEqual(migrated.progress.claimedWorldRewardIds, ["startide-chest-1"]);
  assert.deepEqual(migrated.progress.activatedWaypointIds, ["startide-waypoint"]);
  assert.deepEqual(migrated.progress.revealedSectorIds, ["startide-west"]);
});

test("v8 存档迁移会补齐货币、掉落物、支线、NPC 与机关状态", () => {
  const old = JSON.stringify({
    version: 8,
    ownedPals: [],
    teamIds: [],
    progress: {
      discoveredLocationIds: ["startide-haven"],
      defeatedEliteIds: [],
      openedGateIds: [],
    },
    inventory: { captureOrbs: 2, healingTonics: 1, equipment: [] },
  });
  const migrated = loadGame(memoryStorage(old));
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.inventory.coins, 30);
  assert.deepEqual(migrated.inventory.materials, {});
  assert.deepEqual(migrated.progress.sideQuests, []);
  assert.deepEqual(migrated.progress.talkedNpcIds, []);
  assert.deepEqual(migrated.progress.defeatedEliteIds, []);
  assert.deepEqual(migrated.progress.openedGateIds, []);
  assert.deepEqual(migrated.progress.shopStock, {});
  assert.deepEqual(migrated.progress.eliteDefeatTimes, {});

  const damaged = JSON.stringify({
    version: 8,
    ownedPals: [],
    teamIds: [],
    inventory: { coins: -5, materials: { 柔韧绒丝: 3, 空: "x" } },
    progress: { shopStock: { "shop-equip-reed-plate": -2 }, eliteDefeatTimes: { "elite-x": "bad" } },
  });
  const repaired = loadGame(memoryStorage(damaged));
  assert.equal(repaired.inventory.coins, 0);
  assert.equal(repaired.inventory.materials["柔韧绒丝"], 3);
  assert.equal(repaired.progress.shopStock["shop-equip-reed-plate"], 0);
});

test("v9 存档迁移会补齐基地布局、科技、订单与新资源字段", () => {
  const old = JSON.stringify({
    version: 9,
    ownedPals: [],
    teamIds: [],
    inventory: { captureOrbs: 2, healingTonics: 1, equipment: [], coins: 30, materials: {} },
    base: {
      resources: { wood: 20, stone: 10, food: 20, fiber: 10, crystal: 0 },
      assignments: [],
      facilities: { warehouse: 1, farm: 1, workshop: 1 },
      lastUpdatedAt: 0,
    },
  });
  const migrated = loadGame(memoryStorage(old));
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.inventory.advancedCaptureOrbs, 0);
  assert.equal(migrated.base.resources.ore, 0);
  assert.equal(migrated.base.resources.metal, 0);
  assert.deepEqual(migrated.base.techIds, []);
  assert.deepEqual(migrated.base.orders, []);
  const ids = migrated.base.placedFacilities.map((entry) => entry.facilityId);
  assert.deepEqual([...ids].sort(), ["farm", "warehouse", "workshop"]);
  assert.equal(
    migrated.base.placedFacilities.every((entry) => entry.level >= 1),
    true
  );
});

test("v10 存档迁移会补齐终局进度字段", () => {
  const old = JSON.stringify({
    version: 10,
    ownedPals: [],
    teamIds: [],
    progress: { battlesWon: 12, captured: 0 },
    inventory: { captureOrbs: 2, healingTonics: 1, equipment: [], coins: 30, materials: {} },
  });
  const migrated = loadGame(memoryStorage(old));
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.endgame.towerFloorsCleared, 0);
  assert.deepEqual(migrated.endgame.towerRewardsClaimed, []);
  assert.deepEqual(migrated.endgame.bestScores, {});
  assert.deepEqual(migrated.endgame.periodChallenges, []);
  assert.deepEqual(migrated.endgame.rematchRewardsClaimed, []);
  assert.deepEqual(migrated.endgame.unlockedAchievementIds, []);
  assert.deepEqual(migrated.endgame.unlockedTitles, []);
  assert.equal(migrated.endgame.equippedTitleId, null);
  assert.deepEqual(migrated.endgame.newGamePlus, {
    randomEncounters: false,
    restrictedCapture: false,
    permadeath: false,
  });
  assert.deepEqual(migrated.endgame.permadeathLostUids, []);
  assert.deepEqual(migrated.endgame.stats, {});
});

test("损坏的终局进度字段会被清理而非崩溃", () => {
  const old = JSON.stringify({
    version: 10,
    ownedPals: [],
    teamIds: [],
    endgame: {
      towerFloorsCleared: "坏数据",
      towerRewardsClaimed: [1, null, "floor-3"],
      bestScores: { "tower-1": -5 },
      periodChallenges: [
        { periodKey: "daily-2026-08-21", events: { "battle-win": "x" }, claimedRewardIds: [3] },
        { periodKey: 123 },
      ],
      newGamePlus: { randomEncounters: "yes", permadeath: true },
      equippedTitleId: 42,
    },
  });
  const migrated = loadGame(memoryStorage(old));
  assert.equal(migrated.endgame.towerFloorsCleared, 0);
  assert.deepEqual(migrated.endgame.towerRewardsClaimed, ["floor-3"]);
  assert.deepEqual(migrated.endgame.bestScores, { "tower-1": 0 });
  assert.deepEqual(migrated.endgame.periodChallenges, [
    {
      periodKey: "daily-2026-08-21",
      events: { "battle-win": 0 },
      claimedRewardIds: [],
    },
  ]);
  assert.equal(migrated.endgame.newGamePlus.randomEncounters, false);
  assert.equal(migrated.endgame.newGamePlus.permadeath, true);
  assert.equal(migrated.endgame.equippedTitleId, null);
  assert.deepEqual(migrated.endgame.stats, {});
});
