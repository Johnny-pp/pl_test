/**
 * 数据维护辅助工具：输出内容统计报告并检查终局内容引用一致性。
 * 用法：
 *   node scripts/data-tools.mjs            # 输出统计与一致性报告
 *   node scripts/data-tools.mjs --json     # 以 JSON 输出机器可读摘要
 */
import { readFileSync } from "node:fs";

const read = (file) => JSON.parse(readFileSync(file, "utf-8"));

const pals = read("data/pals.json");
const activeSkills = read("data/active-skills.json");
const passiveSkills = read("data/passive-skills.json");
const equipment = read("data/equipment.json");
const exploreAbilities = read("data/explore-abilities.json");

const palIds = new Set(pals.map((pal) => pal.id));
const equipmentIds = new Set(equipment.map((item) => item.id));
const skillIds = new Set(activeSkills.map((skill) => skill.id));

const towerSpecies = [41, 37, 44, 46, 47, 35, 39, 49, 50, 51];
const rematchBossIds = ["storm-lord", "tidewarden", "mire-sovereign", "abyssal-colossus"];
const bossDefinitions = [
  { id: "storm-lord", speciesId: 39 },
  { id: "tidewarden", speciesId: 47 },
  { id: "mire-sovereign", speciesId: 49 },
  { id: "abyssal-colossus", speciesId: 51 },
];
const towerRewardEquipment = ["charm-tide-shadow", "armor-abyssal-plate"];
const rematchRewardEquipment = ["core-abyssal-heart", "armor-bulwark-mail", "charm-stormlord-horn"];

const problems = [];
const elementCount = {};
const rarityCount = {};
for (const pal of pals) {
  for (const element of pal.elements ?? []) elementCount[element] = (elementCount[element] ?? 0) + 1;
  rarityCount[pal.rarity] = (rarityCount[pal.rarity] ?? 0) + 1;
}

for (const speciesId of towerSpecies) {
  if (!palIds.has(speciesId)) problems.push(`试炼塔引用了不存在的物种: ${speciesId}`);
}
for (const speciesId of towerSpecies) {
  const pal = pals.find((entry) => entry.id === speciesId);
  if (pal && !pal.activeSkills?.length) problems.push(`试炼塔物种 ${speciesId} 缺少主动技能`);
}
for (const def of bossDefinitions) {
  if (!palIds.has(def.speciesId)) problems.push(`首领 ${def.id} 引用了不存在的物种: ${def.speciesId}`);
}
for (const bossId of rematchBossIds) {
  if (!bossDefinitions.some((def) => def.id === bossId))
    problems.push(`首领重战引用了未定义的首领: ${bossId}`);
}
for (const itemId of [...towerRewardEquipment, ...rematchRewardEquipment]) {
  if (!equipmentIds.has(itemId)) problems.push(`终局奖励引用了不存在的装备: ${itemId}`);
}
for (const item of equipment) {
  const affixElements = (item.affixes ?? [])
    .map((affix) => affix.element)
    .filter((element) => typeof element === "string");
  if (new Set(affixElements).size !== affixElements.length) {
    problems.push(`装备 ${item.id} 存在重复元素词条`);
  }
}
for (const pal of pals) {
  for (const skillId of pal.activeSkills ?? []) {
    if (!skillIds.has(skillId)) problems.push(`幻兽 ${pal.id} 引用了不存在的主动技能: ${skillId}`);
  }
}

const summary = {
  pals: pals.length,
  activeSkills: activeSkills.length,
  passiveSkills: passiveSkills.length,
  equipment: equipment.length,
  exploreAbilities: exploreAbilities.length,
  elements: elementCount,
  rarity: rarityCount,
  speciesWithSkills: pals.filter((pal) => (pal.activeSkills ?? []).length > 0).length,
  problems,
};

const isJson = process.argv.includes("--json");
if (isJson) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log("== 内容统计 ==");
  console.log(`物种 ${summary.pals} · 主动技能 ${summary.activeSkills} · 被动技能 ${summary.passiveSkills}`);
  console.log(`装备 ${summary.equipment} · 探索能力 ${summary.exploreAbilities}`);
  console.log(
    `元素分布: ${Object.entries(elementCount)
      .map(([key, value]) => `${key} ${value}`)
      .join(", ")}`
  );
  console.log(
    `稀有度分布: ${Object.entries(rarityCount)
      .map(([key, value]) => `${key}★ ${value}`)
      .join(", ")}`
  );
  console.log(`带主动技能的物种: ${summary.speciesWithSkills}/${summary.pals}`);
  console.log("\n== 终局内容引用一致性 ==");
  console.log(`试炼塔物种引用: ${towerSpecies.length} 个目标已检查`);
  console.log(`首领重战: ${rematchBossIds.length} 个首领已检查`);
  if (problems.length === 0) {
    console.log("✓ 未发现引用问题");
  } else {
    for (const problem of problems) console.log(`✗ ${problem}`);
  }
  console.log("\n提示: 使用 --json 输出机器可读摘要；新增物种/技能后运行本脚本与 npm run validate。");
}

process.exit(problems.length > 0 ? 1 : 0);
