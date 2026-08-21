import test from "node:test";
import assert from "node:assert/strict";
import { createEmptySave, type GameSave } from "../src/player/playerState.ts";
import {
  claimPeriodChallengeReward,
  getPeriodChallenges,
  getPeriodChallengeViews,
  periodKeyFor,
  recordEndgameEvent,
} from "../src/endgame/dailyChallenges.ts";
import {
  ACHIEVEMENTS,
  equipTitle,
  evaluateAchievements,
  getOwnedTitles,
  recordEndgameStat,
  refreshAchievements,
} from "../src/endgame/achievements.ts";
import {
  applyPermadeath,
  canUseCaptureOrb,
  isNgpEnabled,
  ngpCaptureOrbKind,
  ngpEncounterLevel,
  toggleNgpOption,
} from "../src/endgame/newGamePlus.ts";
import {
  describeRestrictions,
  filterTeamForRestrictions,
  validateChallengeTeam,
} from "../src/endgame/challengeRules.ts";
import type { Pal } from "../src/types/pal.ts";

const DAILY = new Date(2026, 7, 21, 12);
const NEXT_DAY = new Date(2026, 7, 22, 12);

function withNga(save: GameSave): GameSave {
  return {
    ...save,
    ownedPals: [
      {
        uid: "nga-fire",
        speciesId: 29,
        level: 10,
        experience: 0,
        currentHp: 100,
        passiveSkillIds: [],
        capturedAt: "2026-08-21T00:00:00.000Z",
        unlockedNodeIds: [],
        equippedSkillIds: [],
        equipment: {},
      },
      {
        uid: "nga-water",
        speciesId: 11,
        level: 10,
        experience: 0,
        currentHp: 100,
        passiveSkillIds: [],
        capturedAt: "2026-08-21T00:00:00.000Z",
        unlockedNodeIds: [],
        equippedSkillIds: [],
        equipment: {},
      },
      {
        uid: "nga-dark",
        speciesId: 22,
        level: 10,
        experience: 0,
        currentHp: 100,
        passiveSkillIds: [],
        capturedAt: "2026-08-21T00:00:00.000Z",
        unlockedNodeIds: [],
        equippedSkillIds: [],
        equipment: {},
      },
    ],
    teamIds: ["nga-fire", "nga-water", "nga-dark"],
  };
}

const species: Pal[] = [
  {
    id: 29,
    name: { zh: "火尾狸", en: "Firetail" },
    rarity: 2,
    elements: ["fire"],
    stats: { hp: 80, attack: 40, defense: 30, workSpeed: 20, moveSpeed: 60, rideSprintSpeed: 60 },
    growth: { hpPerLevel: 6, attackPerLevel: 3, defensePerLevel: 2, experienceCurve: "medium" },
    workSuitability: [],
  },
  {
    id: 11,
    name: { zh: "泉壶兽", en: "Springpot" },
    rarity: 1,
    elements: ["water"],
    stats: { hp: 90, attack: 35, defense: 35, workSpeed: 20, moveSpeed: 55, rideSprintSpeed: 55 },
    growth: { hpPerLevel: 7, attackPerLevel: 2, defensePerLevel: 3, experienceCurve: "medium" },
    workSuitability: [],
  },
  {
    id: 22,
    name: { zh: "暮铃魅", en: "Duskbell" },
    rarity: 2,
    elements: ["dark"],
    stats: { hp: 75, attack: 42, defense: 28, workSpeed: 20, moveSpeed: 65, rideSprintSpeed: 65 },
    growth: { hpPerLevel: 5, attackPerLevel: 4, defensePerLevel: 2, experienceCurve: "medium" },
    workSuitability: [],
  },
];

test("每日/每周委托按日历种子生成且同周期可复现", () => {
  const first = getPeriodChallenges(DAILY, "daily");
  const second = getPeriodChallenges(DAILY, "daily");
  assert.deepEqual(first, second, "同一天应生成相同委托");
  assert.equal(first.length, 3);
  const nextDay = getPeriodChallenges(NEXT_DAY, "daily");
  assert.notDeepEqual(
    first.map((c) => c.id),
    nextDay.map((c) => c.id),
    "不同日期应生成不同委托"
  );
  assert.equal(getPeriodChallenges(DAILY, "weekly").length, 2);
  assert.equal(periodKeyFor(DAILY, "daily"), "daily-2026-08-21");
  assert.match(periodKeyFor(DAILY, "weekly"), /^weekly-\d{4}-W\d+$/);
});

test("周期委托事件记录、完成判定与奖励幂等", () => {
  let save = withNga(createEmptySave(0));
  const views = getPeriodChallengeViews(save, DAILY.getTime());
  assert.ok(views.every((view) => view.status === "active"));
  const firstChallenge = views[0];
  const goal = firstChallenge.challenge.goals[0];

  const target = goal.target;
  const coinsBefore = save.inventory.coins;
  for (let index = 0; index < target; index += 1) {
    save = recordEndgameEvent(save, { type: goal.type }, DAILY.getTime());
  }
  const completed = getPeriodChallengeViews(save, DAILY.getTime()).find(
    (view) => view.challenge.id === firstChallenge.challenge.id
  );
  assert.equal(completed?.status, "complete");
  save = claimPeriodChallengeReward(save, firstChallenge.challenge.id, DAILY.getTime());
  assert.ok(save.inventory.coins > coinsBefore, "完成委托应发放奖励");
  const claimed = getPeriodChallengeViews(save, DAILY.getTime()).find(
    (view) => view.challenge.id === firstChallenge.challenge.id
  );
  assert.equal(claimed?.status, "claimed");
  const afterClaim = save.inventory.coins;
  save = claimPeriodChallengeReward(save, firstChallenge.challenge.id, DAILY.getTime());
  assert.equal(save.inventory.coins, afterClaim, "已领取的委托不能重复领奖");
});

test("跨天自动切换周期，旧周期记录不会污染新周期", () => {
  let save = withNga(createEmptySave(0));
  const todayViews = getPeriodChallengeViews(save, DAILY.getTime());
  assert.ok(
    todayViews.every((view) => view.status === "active"),
    "初始应全部为进行中"
  );
  const firstGoalType = todayViews[0].challenge.goals[0].type;
  save = recordEndgameEvent(save, { type: firstGoalType, amount: 99 }, DAILY.getTime());
  const completedToday = getPeriodChallengeViews(save, DAILY.getTime()).filter(
    (view) => view.status === "complete"
  );
  assert.ok(completedToday.length > 0, "今日事件应推进今日委托");
  const nextViews = getPeriodChallengeViews(save, NEXT_DAY.getTime());
  assert.notEqual(nextViews[0].challenge.id, todayViews[0].challenge.id, "跨日后应进入新的周期委托");
  assert.ok(
    nextViews.every((view) => view.status === "active"),
    "昨日事件不应使明日委托提前完成"
  );
});

test("成就可计算、解锁与授予称号，称号可装备", () => {
  let save = withNga(createEmptySave(0));
  save = recordEndgameStat(save, "incubated", 10);
  save = recordEndgameStat(save, "crafted", 20);
  save = {
    ...save,
    progress: {
      ...save.progress,
      battlesWon: 50,
      defeatedBossIds: ["a", "b", "c", "d"],
      defeatedEliteIds: ["e1", "e2"],
      discoveredLocationIds: Array.from({ length: 10 }, (_, i) => `loc-${i}`),
      unlockedRegions: ["frontier", "cloudridge-highlands", "startide-archipelago"],
      claimedWorldRewardIds: ["c1", "c2", "c3"],
    },
    base: {
      ...save.base,
      techIds: ["t1", "t2", "t3", "t4", "t5"],
      placedFacilities: [
        { facilityId: "warehouse", level: 5, gridX: 0, gridY: 0 },
        { facilityId: "forge", level: 4, gridX: 2, gridY: 0 },
        { facilityId: "assembly", level: 3, gridX: 4, gridY: 0 },
      ],
    },
  };
  const met = evaluateAchievements(save, species);
  assert.ok(met.includes("battle-fifty"));
  assert.ok(met.includes("craft-twenty"));
  assert.ok(met.includes("hatch-ten"));
  assert.ok(met.includes("discover-ten"));
  assert.ok(met.includes("base-expand"));

  const refreshed = refreshAchievements(save, species);
  assert.ok(refreshed.endgame.unlockedAchievementIds.includes("battle-fifty"));
  const battleTitle = ACHIEVEMENTS.find((a) => a.id === "battle-fifty");
  assert.ok(battleTitle?.titles);
  assert.ok(getOwnedTitles(refreshed).includes(battleTitle!.titles![0]), "成就应授予称号");

  const equipped = equipTitle(refreshed, battleTitle!.titles![0]);
  assert.equal(equipped.endgame.equippedTitleId, battleTitle!.titles![0]);
  const invalid = equipTitle(refreshed, "不存在的称号");
  assert.equal(invalid.endgame.equippedTitleId, null, "未拥有的称号不能装备");
});

test("成就刷新幂等：重复调用不重复解锁", () => {
  let save = withNga(createEmptySave(0));
  save = {
    ...save,
    progress: { ...save.progress, battlesWon: 60 },
  };
  const once = refreshAchievements(save, species);
  const twice = refreshAchievements(once, species);
  assert.deepEqual(twice.endgame.unlockedAchievementIds, once.endgame.unlockedAchievementIds);
  assert.deepEqual(twice.endgame.unlockedTitles, once.endgame.unlockedTitles);
});

test("新周目选项可组合开关并影响捕获与遭遇", () => {
  let save = withNga(createEmptySave(0));
  assert.equal(isNgpEnabled(save, "randomEncounters"), false);
  save = toggleNgpOption(save, "randomEncounters");
  assert.equal(isNgpEnabled(save, "randomEncounters"), true);
  save = toggleNgpOption(save, "restrictedCapture");
  assert.equal(ngpCaptureOrbKind(save), "advanced");
  assert.equal(canUseCaptureOrb(save), false, "无高级捕获器时限制捕获下不能捕获");

  const level30 = ngpEncounterLevel(30, save, () => 0);
  assert.ok(level30 >= 24 && level30 <= 30, "随机遭遇应在基础值 ±20% 内");
  const disabled = ngpEncounterLevel(30, withNga(createEmptySave(0)), () => 0);
  assert.equal(disabled, 30);
});

test("永久倒下移除个体与队伍引用并记录", () => {
  let save = withNga(createEmptySave(0));
  save = {
    ...save,
    base: { ...save.base, assignments: [{ palUid: "nga-fire", job: "lumbering" }] },
  };
  save = applyPermadeath(save, ["nga-fire", "不存在"]);
  assert.ok(!save.ownedPals.some((pal) => pal.uid === "nga-fire"));
  assert.ok(!save.teamIds.includes("nga-fire"));
  assert.ok(!save.base.assignments.some((a) => a.palUid === "nga-fire"));
  assert.ok(save.endgame.permadeathLostUids.includes("nga-fire"));
  assert.equal(save.ownedPals.length, 2, "只移除倒下的个体");
});

test("挑战限制描述、校验与队伍过滤", () => {
  const save = withNga(createEmptySave(0));
  const fireOnly = { elementWhitelist: ["fire" as const] };
  const description = describeRestrictions(fireOnly);
  assert.ok(description[0].includes("火"));

  const valid = validateChallengeTeam(save, species, { maxTeamSize: 5 });
  assert.equal(valid.valid, true);
  const invalid = validateChallengeTeam(save, species, { maxTeamSize: 2 });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.missing.length > 0);

  const fireFiltered = filterTeamForRestrictions(save, species, fireOnly);
  assert.deepEqual(
    fireFiltered.map((pal) => pal.uid),
    ["nga-fire"]
  );
  const noRestriction = filterTeamForRestrictions(save, species);
  assert.equal(noRestriction.length, 3);
});
