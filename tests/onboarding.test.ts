import test from "node:test";
import assert from "node:assert/strict";
import {
  completeOnboardingStep,
  getPendingOnboardingStep,
  isOnboardingSkipped,
  loadOnboarding,
  ONBOARDING_STEPS,
  skipOnboarding,
  triggerOnboardingStep,
  type StorageLike,
} from "../src/onboarding/onboarding.ts";

function memoryStorage(): StorageLike {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  };
}

test("引导步骤按触发顺序待展示", () => {
  const storage = memoryStorage();
  assert.equal(getPendingOnboardingStep(storage), undefined, "未触发任何引导时不展示");
  triggerOnboardingStep(storage, "capture");
  const pending = getPendingOnboardingStep(storage);
  assert.equal(pending?.id, "capture");
  assert.ok(pending?.text.includes("捕获"));
});

test("确认阅读后不再展示，跳过全部引导", () => {
  const storage = memoryStorage();
  triggerOnboardingStep(storage, "capture");
  triggerOnboardingStep(storage, "team");
  completeOnboardingStep(storage, "capture");
  assert.equal(getPendingOnboardingStep(storage)?.id, "team");

  skipOnboarding(storage);
  assert.equal(isOnboardingSkipped(storage), true);
  assert.equal(getPendingOnboardingStep(storage), undefined);
});

test("重复触发与损坏数据不报错", () => {
  const storage = memoryStorage();
  triggerOnboardingStep(storage, "capture");
  triggerOnboardingStep(storage, "capture");
  const state = loadOnboarding(storage);
  assert.deepEqual(state.triggeredIds, ["capture"]);

  const broken = memoryStorage();
  broken.setItem("pl_test_onboarding", "not-json");
  assert.equal(getPendingOnboardingStep(broken), undefined);
  assert.equal(isOnboardingSkipped(broken), false);
});

test("引导步骤覆盖全部核心系统且 id 唯一", () => {
  const ids = new Set(ONBOARDING_STEPS.map((step) => step.id));
  assert.equal(ids.size, ONBOARDING_STEPS.length);
  for (const required of ["capture", "team", "base", "breeding", "build", "quest", "endgame"]) {
    assert.ok(ids.has(required), `缺少引导步骤 ${required}`);
  }
});
