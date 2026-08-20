import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave, addCapturedPal } from "../src/player/playerState.ts";
import type { PalInstance } from "../src/player/playerState.ts";
import type { Pal } from "../src/types/pal.ts";
import type { ActiveSkill } from "../src/types/activeSkill.ts";
import type { PassiveSkill } from "../src/types/passiveSkill.ts";
import type { EquipmentDefinition } from "../src/types/skillTree.ts";
import {
  MAX_EQUIPPED_SKILLS,
  equipSkill,
  getAvailableSkillPoints,
  getEquippedSkillIds,
  getFinalBuildStats,
  getResetCost,
  getSkillPointTotal,
  getSpeciesSkillTree,
  isSkillEquipable,
  resetSkillTree,
  unequipSkill,
  unlockNode,
} from "../src/build/buildSystem.ts";
import { equipItem, grantEquipment, unequipItem } from "../src/build/equipment.ts";
import { createInstanceBuildSnapshot, type BuildDeps } from "../src/build/buildCombatant.ts";
import { createPartyBattle, resolveTurn, switchPlayer } from "../src/battle/battleEngine.ts";

const species: Pal = {
  id: 70,
  name: { zh: "构筑测试兽", en: "Build Test" },
  rarity: 2,
  elements: ["fire"],
  stats: { hp: 100, attack: 70, defense: 60, workSpeed: 100, moveSpeed: 300, rideSprintSpeed: 0 },
  growth: { hpPerLevel: 5, attackPerLevel: 4, defensePerLevel: 3, experienceCurve: "medium" },
  workSuitability: [],
  activeSkills: ["ember-dart", "flame-burst", "pulse-shot", "quick-strike", "dragon-comet"],
};

const enemySpecies: Pal = {
  id: 71,
  name: { zh: "对手", en: "Opponent" },
  rarity: 1,
  elements: ["grass"],
  stats: { hp: 100, attack: 60, defense: 60, workSpeed: 10, moveSpeed: 100, rideSprintSpeed: 0 },
  growth: { hpPerLevel: 4, attackPerLevel: 3, defensePerLevel: 3, experienceCurve: "medium" },
  workSuitability: [],
  activeSkills: ["leaf-cutter"],
};

const skills = new Map<string, ActiveSkill>([
  [
    "ember-dart",
    {
      id: "ember-dart",
      name: { zh: "烬火飞矢", en: "Ember Dart" },
      description: "",
      element: "fire",
      power: 50,
      accuracy: 95,
      energyCost: 20,
      priority: 0,
    },
  ],
  [
    "flame-burst",
    {
      id: "flame-burst",
      name: { zh: "焰环爆发", en: "Flame Burst" },
      description: "",
      element: "fire",
      power: 72,
      accuracy: 85,
      energyCost: 32,
      priority: 0,
    },
  ],
  [
    "pulse-shot",
    {
      id: "pulse-shot",
      name: { zh: "脉冲弹", en: "Pulse Shot" },
      description: "",
      element: "neutral",
      power: 46,
      accuracy: 95,
      energyCost: 18,
      priority: 0,
    },
  ],
  [
    "quick-strike",
    {
      id: "quick-strike",
      name: { zh: "迅捷冲撞", en: "Quick Strike" },
      description: "",
      element: "neutral",
      power: 34,
      accuracy: 100,
      energyCost: 12,
      priority: 1,
    },
  ],
  [
    "dragon-comet",
    {
      id: "dragon-comet",
      name: { zh: "星鳞彗击", en: "Scale Comet" },
      description: "",
      element: "dragon",
      power: 76,
      accuracy: 84,
      energyCost: 34,
      priority: 0,
    },
  ],
  [
    "leaf-cutter",
    {
      id: "leaf-cutter",
      name: { zh: "青叶回旋", en: "Leaf Cutter" },
      description: "",
      element: "grass",
      power: 52,
      accuracy: 95,
      energyCost: 20,
      priority: 0,
    },
  ],
]);

const passives = new Map<string, PassiveSkill>([
  [
    "flame_attuned",
    {
      id: "flame_attuned",
      name: { zh: "焰律共鸣", en: "Flame Attuned" },
      category: "element",
      description: "",
      tier: "rare",
    },
  ],
  [
    "sharp_focus",
    {
      id: "sharp_focus",
      name: { zh: "锐心", en: "Sharp Focus" },
      category: "attack",
      description: "",
      tier: "rare",
    },
  ],
]);

const equipment: EquipmentDefinition = {
  id: "core-test",
  name: { zh: "测试核心", en: "Test Core" },
  description: "",
  slot: "core",
  rarity: "rare",
  affixes: [
    { stat: "attackPercent", value: 10 },
    { stat: "maxHpPercent", value: 8 },
    { stat: "elementDamage", element: "fire", value: 12 },
  ],
};
const equipmentMap = new Map([[equipment.id, equipment]]);

const deps: BuildDeps = { activeSkills: skills, passiveSkills: passives, equipment: equipmentMap };

function instance(level = 1, overrides: Partial<PalInstance> = {}): PalInstance {
  return {
    uid: "build-pal",
    speciesId: species.id,
    level,
    experience: 0,
    currentHp: species.stats.hp,
    passiveSkillIds: [],
    capturedAt: "2026-01-01T00:00:00.000Z",
    unlockedNodeIds: [],
    equippedSkillIds: ["ember-dart", "flame-burst", "pulse-shot", "quick-strike"],
    equipment: {},
    ...overrides,
  };
}

test("技能点随等级增加，重置成本与等级相关", () => {
  assert.equal(getSkillPointTotal(1), 0);
  assert.equal(getSkillPointTotal(2), 1);
  assert.equal(getSkillPointTotal(50), 49);
  const low = instance(1);
  const high = instance(30);
  assert.ok(getResetCost(high) > getResetCost(low));
});

test("物种技能树由可学主动技能、属性和血脉节点构成", () => {
  const tree = getSpeciesSkillTree(species, skills, passives);
  assert.ok(tree.some((node) => node.type === "active" && node.skillId === "ember-dart"));
  assert.ok(tree.some((node) => node.type === "active" && node.skillId === "dragon-comet"));
  assert.ok(tree.some((node) => node.type === "attribute"));
  assert.ok(tree.some((node) => node.type === "passive" && node.passiveId === "flame_attuned"));
  for (const node of tree) {
    for (const requireId of node.requires) {
      assert.ok(
        tree.some((item) => item.id === requireId),
        `前置节点 ${requireId} 存在`
      );
    }
  }
});

test("基础技能无需解锁即可装备，非基础技能必须解锁节点才能装备", () => {
  const tree = getSpeciesSkillTree(species, skills, passives);
  assert.equal(isSkillEquipable(species, "ember-dart", tree), true, "基础技能可直接装备");
  assert.equal(isSkillEquipable(species, "dragon-comet", tree), false, "非基础技能需先解锁");
  assert.equal(
    isSkillEquipable(species, "dragon-comet", tree, ["skill-dragon-comet"]),
    true,
    "解锁节点后可装备"
  );
});

test("解锁节点遵循前置与点数限制，花费正确累积", () => {
  let save = addCapturedPal(createEmptySave(0), instance(10));
  save = unlockNode(save, "build-pal", "attr-power", species, skills, passives);
  assert.ok(save.ownedPals[0].unlockedNodeIds.includes("attr-power"));
  assert.equal(getAvailableSkillPoints(save.ownedPals[0], getSpeciesSkillTree(species, skills, passives)), 6);

  const before = save.ownedPals[0].unlockedNodeIds;
  save = unlockNode(save, "build-pal", "attr-power-2", species, skills, passives);
  assert.ok(save.ownedPals[0].unlockedNodeIds.includes("attr-power-2"));
  assert.ok(save.ownedPals[0].unlockedNodeIds.length > before.length);
  assert.equal(getAvailableSkillPoints(save.ownedPals[0], getSpeciesSkillTree(species, skills, passives)), 2);
});

test("解锁节点需要满足前置，且不能超出点数", () => {
  let save = addCapturedPal(createEmptySave(0), instance(10));
  save = unlockNode(save, "build-pal", "attr-power-2", species, skills, passives);
  assert.ok(!save.ownedPals[0].unlockedNodeIds.includes("attr-power-2"), "缺少前置不可解锁");
  save = unlockNode(save, "build-pal", "attr-power", species, skills, passives);
  save = unlockNode(save, "build-pal", "attr-power", species, skills, passives);
  assert.equal(save.ownedPals[0].unlockedNodeIds.length, 1, "重复解锁无效");
  let noPoints = addCapturedPal(createEmptySave(0), instance(1));
  noPoints = unlockNode(noPoints, "build-pal", "attr-power", species, skills, passives);
  noPoints = unlockNode(noPoints, "build-pal", "attr-power-2", species, skills, passives);
  noPoints = unlockNode(noPoints, "build-pal", "attr-guard", species, skills, passives);
  assert.equal(noPoints.ownedPals[0].unlockedNodeIds.length, 0, "点数不足不可解锁");
});

test("装备主动技能限制为 4 个，非法技能被拒绝", () => {
  const tree = getSpeciesSkillTree(species, skills, passives);
  let save = addCapturedPal(createEmptySave(0), instance(10, { equippedSkillIds: [] }));
  save = equipSkill(save, "build-pal", "ember-dart", species, tree);
  save = equipSkill(save, "build-pal", "flame-burst", species, tree);
  save = equipSkill(save, "build-pal", "pulse-shot", species, tree);
  save = equipSkill(save, "build-pal", "quick-strike", species, tree);
  assert.equal(save.ownedPals[0].equippedSkillIds.length, MAX_EQUIPPED_SKILLS);
  const rejected = equipSkill(save, "build-pal", "dragon-comet", species, tree);
  assert.equal(
    rejected.ownedPals[0].equippedSkillIds.length,
    MAX_EQUIPPED_SKILLS,
    "非基础技能未解锁不可装备"
  );
  const base = equipSkill(save, "build-pal", "not-a-skill", species, tree);
  assert.equal(base.ownedPals[0].equippedSkillIds.length, MAX_EQUIPPED_SKILLS, "未知技能被拒绝");
});

test("卸载技能并重新装备可恢复，非法配置回退到基础技能", () => {
  let save = addCapturedPal(createEmptySave(0), instance(10, { equippedSkillIds: [] }));
  const tree = getSpeciesSkillTree(species, skills, passives);
  save = equipSkill(save, "build-pal", "ember-dart", species, tree);
  save = unequipSkill(save, "build-pal", "ember-dart");
  assert.ok(!save.ownedPals[0].equippedSkillIds.includes("ember-dart"));
  const fallback = getEquippedSkillIds(species, { ...instance(), equippedSkillIds: ["unknown"] }, tree);
  assert.deepEqual(fallback, ["ember-dart", "flame-burst", "pulse-shot", "quick-strike"]);
});

test("重置技能树返还技能点并恢复基础技能，消耗晶体", () => {
  let save = addCapturedPal(createEmptySave(0), instance(20));
  save.base.resources.crystal = 10;
  save = unlockNode(save, "build-pal", "attr-power", species, skills, passives);
  save = unlockNode(save, "build-pal", "attr-power-2", species, skills, passives);
  const cost = getResetCost(save.ownedPals[0]);
  const before = save.base.resources.crystal;
  save = resetSkillTree(save, "build-pal", species);
  assert.equal(save.base.resources.crystal, before - cost);
  assert.deepEqual(save.ownedPals[0].unlockedNodeIds, []);
  assert.deepEqual(save.ownedPals[0].equippedSkillIds, [
    "ember-dart",
    "flame-burst",
    "pulse-shot",
    "quick-strike",
  ]);
});

test("晶体不足时不能重置技能树", () => {
  const save = addCapturedPal(createEmptySave(0), instance(20));
  save.base.resources.crystal = 0;
  const unchanged = resetSkillTree(save, "build-pal", species);
  assert.equal(unchanged, save);
});

test("同一物种可通过技能树形成至少两种有效培养方向", () => {
  const tree = getSpeciesSkillTree(species, skills, passives);
  const attackBuild = instance(30, {
    unlockedNodeIds: ["attr-power", "attr-power-2", "skill-dragon-comet", "skill-flame-burst"],
    equippedSkillIds: ["ember-dart", "flame-burst", "dragon-comet", "pulse-shot"],
  });
  const guardBuild = instance(30, {
    unlockedNodeIds: ["attr-guard", "attr-guard-2"],
    equippedSkillIds: ["quick-strike", "pulse-shot", "flame-burst", "ember-dart"],
  });
  const attackStats = getFinalBuildStats(species, attackBuild, tree, equipmentMap, createEmptySave(0));
  const guardStats = getFinalBuildStats(species, guardBuild, tree, equipmentMap, createEmptySave(0));
  assert.ok(attackStats.attack > guardStats.attack, "攻击方向攻击更高");
  assert.ok(guardStats.defense > attackStats.defense, "防御方向防御更高");
  const attackEquipped = getEquippedSkillIds(species, attackBuild, tree);
  const guardEquipped = getEquippedSkillIds(species, guardBuild, tree);
  assert.ok(attackEquipped.includes("dragon-comet"));
  assert.ok(!guardEquipped.includes("dragon-comet"));
  for (const skill of [...attackEquipped, ...guardEquipped]) {
    assert.equal(
      isSkillEquipable(species, skill, tree, attackBuild.unlockedNodeIds),
      true,
      "攻击方向技能可装备"
    );
  }
  for (const skill of guardEquipped) {
    assert.equal(
      isSkillEquipable(species, skill, tree, guardBuild.unlockedNodeIds),
      true,
      "防御方向技能可装备"
    );
  }
});

test("装备加成与技能树属性能合并进最终数值且存在叠加上限", () => {
  const tree = getSpeciesSkillTree(species, skills, passives);
  const baseSave = addCapturedPal(createEmptySave(0), instance(10));
  const base = getFinalBuildStats(species, baseSave.ownedPals[0], tree, equipmentMap, baseSave);
  let save = grantEquipment(baseSave, "core-test", () => "eq-1").save;
  save = equipItem(save, "build-pal", "eq-1", "core", equipmentMap);
  const boosted = getFinalBuildStats(species, save.ownedPals[0], tree, equipmentMap, save);
  assert.ok(boosted.attack > base.attack, "装备攻击加成生效");
  assert.ok(boosted.maxHp > base.maxHp, "装备生命加成生效");
  assert.equal(Object.values(save.ownedPals[0].equipment ?? {}).length, 1, "每槽位最多一件装备");
});

test("穿戴、替换、卸下和存档恢复不会复制或丢失物品", () => {
  let save = addCapturedPal(createEmptySave(0), instance(10));
  save = grantEquipment(save, "core-test", () => "eq-a").save;
  save = grantEquipment(save, "core-test", () => "eq-b").save;
  save = equipItem(save, "build-pal", "eq-a", "core", equipmentMap);
  assert.ok(
    save.inventory.equipment.some((item) => item.uid === "eq-a"),
    "装备后物品仍在背包"
  );
  assert.equal(save.ownedPals[0].equipment?.core, "eq-a");
  save = equipItem(save, "build-pal", "eq-b", "core", equipmentMap);
  assert.equal(save.ownedPals[0].equipment?.core, "eq-b", "替换后新装备占用槽位");
  assert.ok(
    save.inventory.equipment.some((item) => item.uid === "eq-a"),
    "旧装备仍在背包"
  );
  save = unequipItem(save, "build-pal", "core");
  assert.equal(save.ownedPals[0].equipment?.core, undefined, "卸下后清空槽位");
  assert.ok(
    save.inventory.equipment.some((item) => item.uid === "eq-b"),
    "卸下后物品保留"
  );
  const uids = save.inventory.equipment.map((item) => item.uid);
  assert.equal(new Set(uids).size, uids.length, "物品不重复");
  const slots = Object.values(save.ownedPals[0].equipment ?? {}).filter(Boolean);
  assert.equal(new Set(slots).size, slots.length, "已装备引用不重复");
});

test("战斗严格使用个体当前装备的主动技能", () => {
  let save = addCapturedPal(createEmptySave(0), instance(10));
  save = grantEquipment(save, "core-test", () => "eq-battle").save;
  save = equipItem(save, "build-pal", "eq-battle", "core", equipmentMap);
  const pal = save.ownedPals[0];
  const snapshot = createInstanceBuildSnapshot(save, species, pal, deps);
  const state = createPartyBattle(
    [{ pal: species, level: pal.level, currentHp: pal.currentHp, build: snapshot }],
    enemySpecies,
    1
  );
  const equipped = state.player.skillIds;
  assert.ok(
    equipped.every((id) => pal.equippedSkillIds.includes(id)),
    "战斗只用已装备技能"
  );
  assert.ok(equipped.length <= MAX_EQUIPPED_SKILLS);
  assert.ok(state.player.attack > 0 && state.player.maxHp > 0);
  const enemySkill = skills.get("leaf-cutter")!;
  const next = resolveTurn(state, skills.get("ember-dart")!, enemySkill, () => 0);
  assert.ok(next.phase === "choosing" || next.phase === "victory");
});

test("队伍换宠后新上场个体使用自身构筑", () => {
  const first = instance(10, { uid: "build-pal" });
  const second = instance(10, {
    uid: "second-pal",
    equippedSkillIds: ["pulse-shot", "ember-dart", "flame-burst", "quick-strike"],
  });
  let save = createEmptySave(0);
  save = addCapturedPal(save, first);
  save = addCapturedPal(save, second);
  const snapshots = [first, second].map((pal) => createInstanceBuildSnapshot(save, species, pal, deps));
  const state = createPartyBattle(
    [
      { pal: species, level: 10, build: snapshots[0] },
      { pal: species, level: 10, build: snapshots[1] },
    ],
    enemySpecies,
    1
  );
  const switched = switchPlayer(state, 1, skills.get("leaf-cutter")!, () => 0);
  assert.equal(switched.activePlayerIndex, 1);
  assert.ok(switched.player.skillIds.includes("pulse-shot"));
});
