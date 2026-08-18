import test from "node:test";
import assert from "node:assert/strict";
import {
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
  assert.equal(migrated.version, 3);
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
  assert.equal(importSaveBackup(oldBackup)?.version, 3);
  assert.equal(importSaveBackup('{"hello":"world"}'), undefined);
  assert.equal(importSaveBackup("not-json"), undefined);
});
