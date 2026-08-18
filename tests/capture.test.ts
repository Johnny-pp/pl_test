import test from "node:test";
import assert from "node:assert/strict";
import { attemptCapture, calculateCaptureChance, rollWildPassiveSkills } from "../src/capture/capture.ts";

test("目标生命值越低，捕获概率越高", () => {
  const full = calculateCaptureChance({ hp: 100, maxHp: 100, rarity: 2, catchRate: 30 });
  const weak = calculateCaptureChance({ hp: 10, maxHp: 100, rarity: 2, catchRate: 30 });
  assert.ok(weak > full);
});

test("捕获概率始终限制在 5% 到 95%", () => {
  assert.equal(calculateCaptureChance({ hp: 0, maxHp: 100, rarity: 1, catchRate: 100 }), 95);
  assert.equal(calculateCaptureChance({ hp: 100, maxHp: 100, rarity: 5, catchRate: 0 }), 5);
});

test("捕获结果可通过随机源稳定复现", () => {
  const target = { hp: 50, maxHp: 100, rarity: 2, catchRate: 30 };
  assert.equal(attemptCapture(target, () => 0).success, true);
  assert.equal(attemptCapture(target, () => 0.99).success, false);
});

test("野生个体会按概率获得不重复被动", () => {
  const rolls = [0, 0, 0, 0.99];
  const result = rollWildPassiveSkills(["a", "b"], () => rolls.shift() ?? 0.99);
  assert.deepEqual(result, ["a", "b"]);
  assert.deepEqual(
    rollWildPassiveSkills(["a"], () => 0.99),
    []
  );
});
