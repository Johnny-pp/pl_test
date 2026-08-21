import test from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultSettings,
  getActionKey,
  loadSettings,
  saveSettings,
  setActionKey,
  type StorageLike,
} from "../src/settings/settings.ts";

function memoryStorage(initial: string | null = null): StorageLike {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test("默认设置使用正常音量、动画与默认键位", () => {
  const settings = createDefaultSettings();
  assert.equal(settings.masterVolume, 0.8);
  assert.equal(settings.animationSpeed, "normal");
  assert.equal(settings.saveSlot, 0);
  assert.equal(getActionKey(settings, "interact"), "E");
  assert.equal(getActionKey(settings, "up"), "W");
});

test("设置可写入读取往返", () => {
  const storage = memoryStorage();
  const settings = createDefaultSettings();
  settings.masterVolume = 0.5;
  settings.highContrast = true;
  settings.saveSlot = 1;
  assert.equal(saveSettings(storage, settings), true);
  const restored = loadSettings(storage);
  assert.equal(restored.masterVolume, 0.5);
  assert.equal(restored.highContrast, true);
  assert.equal(restored.saveSlot, 1);
});

test("损坏设置回退到默认值", () => {
  assert.equal(loadSettings(memoryStorage("not-json")).masterVolume, 0.8);
  const bad = memoryStorage(JSON.stringify({ masterVolume: 99, saveSlot: -5, animationSpeed: "weird" }));
  const restored = loadSettings(bad);
  assert.equal(restored.masterVolume, 1);
  assert.equal(restored.animationSpeed, "normal");
  assert.equal(restored.saveSlot, 0);
});

test("键位可重绑定并回退到默认", () => {
  let settings = createDefaultSettings();
  settings = setActionKey(settings, "interact", "F");
  assert.equal(getActionKey(settings, "interact"), "F");
  assert.equal(getActionKey(settings, "up"), "W");
  settings = setActionKey(settings, "interact", "");
  assert.equal(getActionKey(settings, "interact"), "E");
});

test("存档槽位限制在合法范围内", () => {
  const storage = memoryStorage();
  const settings = createDefaultSettings();
  settings.saveSlot = 5;
  const saved = saveSettings(storage, settings);
  assert.equal(saved, true);
  assert.equal(loadSettings(storage).saveSlot, 2);
});
