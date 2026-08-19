import test from "node:test";
import assert from "node:assert/strict";
import { getPassiveBonuses } from "../src/passives/passiveEffects.ts";

test("重复被动不会叠加且多种攻击被动受统一上限约束", () => {
  const duplicate = getPassiveBonuses(["sharp_focus", "sharp_focus"]);
  assert.equal(duplicate.attackPercent, 15);
  const capped = getPassiveBonuses(["sharp_focus", "balanced_frame", "overcharge", "prism_birth"]);
  assert.equal(capped.attackPercent, 40);
});

test("冲突被动按加减合并且结果与输入顺序无关", () => {
  const first = getPassiveBonuses(["windstep", "stonehide"]);
  const second = getPassiveBonuses(["stonehide", "windstep"]);
  assert.equal(first.speedPercent, 10);
  assert.deepEqual(first, second);
});

test("元素、工作和昼夜被动只影响声明的范围", () => {
  const day = getPassiveBonuses(["flame_attuned", "emberproof", "dawn_spirit"], { hour: 10 });
  const night = getPassiveBonuses(["flame_attuned", "emberproof", "dawn_spirit"], { hour: 22 });
  assert.equal(day.elementDamagePercent.fire, 12);
  assert.equal(day.elementResistancePercent.fire, 12);
  assert.equal(day.workSpeedPercent, 12);
  assert.equal(night.workSpeedPercent, 0);
});
