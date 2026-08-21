import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptySave,
  createRestorePoint,
  copySaveSlot,
  deleteSaveSlot,
  getSaveSlotStorageKey,
  LEGACY_SAVE_KEY,
  listRestorePoints,
  listSaveSlots,
  loadAutoBackup,
  loadGame,
  restoreFromPoint,
  saveGame,
  type StorageLike,
} from "../src/player/playerState.ts";
import { loadSettings, updateSettings } from "../src/settings/settings.ts";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { keys: string[] } {
  const map = new Map(Object.entries(initial));
  return {
    keys: [...map.keys()],
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
  };
}

function currentSlotKey(storage: StorageLike): string {
  return getSaveSlotStorageKey(loadSettings(storage).saveSlot);
}

test("槽位 0 无新 key 时回退读取旧存档键并迁移", () => {
  const storage = memoryStorage();
  storage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ version: 1, ownedPals: [], teamIds: [] }));
  const save = loadGame(storage);
  assert.equal(save.version, 11);
  assert.deepEqual(save.ownedPals, []);
});

test("saveGame 写入当前槽位键并保留自动备份", () => {
  const storage = memoryStorage();
  const save = createEmptySave(0);
  save.progress.battlesWon = 3;
  assert.equal(saveGame(storage, save), true);
  const key = currentSlotKey(storage);
  assert.ok(storage.getItem(key) !== null, "存档应写入槽位键");
  assert.equal(storage.getItem("pl_test_game_save_auto_backup"), null, "首次保存无旧值不应生成备份");

  save.progress.battlesWon = 4;
  assert.equal(saveGame(storage, save), true);
  const backup = loadAutoBackup(storage);
  assert.ok(backup, "第二次保存应生成自动备份");
  assert.equal(backup?.progress.battlesWon, 3);
});

test("切换存档槽后各槽位独立读写", () => {
  const storage = memoryStorage();
  const save = createEmptySave(0);
  save.progress.battlesWon = 1;
  assert.equal(saveGame(storage, save), true);

  updateSettings(storage, { saveSlot: 1 });
  assert.equal(loadGame(storage).progress.battlesWon, 0, "槽位 1 应为空存档");
  save.progress.battlesWon = 2;
  assert.equal(saveGame(storage, save), true);

  updateSettings(storage, { saveSlot: 0 });
  assert.equal(loadGame(storage).progress.battlesWon, 1, "切回槽位 0 应恢复原进度");

  const slots = listSaveSlots(storage);
  assert.equal(slots.length, 3);
  assert.equal(slots[0].hasSave, true);
  assert.equal(slots[1].hasSave, true);
  assert.equal(slots[2].hasSave, false);
});

test("删除与复制存档槽", () => {
  const storage = memoryStorage();
  const save = createEmptySave(0);
  save.progress.battlesWon = 7;
  assert.equal(saveGame(storage, save), true);
  assert.equal(copySaveSlot(storage, 0, 1), true);
  updateSettings(storage, { saveSlot: 1 });
  assert.equal(loadGame(storage).progress.battlesWon, 7, "复制后目标槽位应包含相同进度");

  updateSettings(storage, { saveSlot: 0 });
  assert.equal(deleteSaveSlot(storage, 0), true);
  assert.equal(loadGame(storage).progress.battlesWon, 0, "删除后槽位回到空存档");
  assert.equal(listSaveSlots(storage)[0].hasSave, false);
});

test("命名恢复点可创建、列出与恢复，且不互相覆盖", () => {
  const storage = memoryStorage();
  const save = createEmptySave(0);
  save.progress.battlesWon = 5;
  assert.equal(saveGame(storage, save), true);
  assert.equal(createRestorePoint(storage, "决战前"), true);

  save.progress.battlesWon = 9;
  assert.equal(saveGame(storage, save), true);
  assert.deepEqual(listRestorePoints(storage), ["决战前"]);

  const restored = restoreFromPoint(storage, "决战前");
  assert.ok(restored, "应从恢复点恢复");
  assert.equal(restored?.progress.battlesWon, 5);
  assert.deepEqual(listRestorePoints(storage), ["决战前"], "恢复不应删除恢复点");
  assert.equal(restoreFromPoint(storage, "不存在"), undefined);
});

test("损坏的槽位数据会回退为空存档而不崩溃", () => {
  const storage = memoryStorage();
  storage.setItem(getSaveSlotStorageKey(0), "not-json");
  const save = loadGame(storage);
  assert.equal(save.ownedPals.length, 0);
  assert.equal(save.version, 11);
});

test("createRestorePoint 会拒绝空标签", () => {
  const storage = memoryStorage();
  assert.equal(createRestorePoint(storage, "   "), false);
});
