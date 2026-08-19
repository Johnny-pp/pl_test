import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const ajv = new Ajv2020({ allErrors: true });

function check(file, schemaFile, label, idKey) {
  const schema = JSON.parse(readFileSync(schemaFile, "utf-8"));
  const validate = ajv.compile(schema);
  const data = JSON.parse(readFileSync(file, "utf-8"));
  let ok = true;
  for (const item of data) {
    if (!validate(item)) {
      ok = false;
      console.error(`✗ ${label} ${item[idKey] ?? "?"} 校验失败:`);
      for (const e of validate.errors) {
        console.error(`   - 路径 ${e.instancePath || "/"}: ${e.message}`);
      }
    } else {
      console.log(`✓ ${label} ${item[idKey]} (${item.name.zh}) 通过校验`);
    }
  }
  return ok;
}

function checkUnique(items, key, label) {
  let ok = true;
  const seen = new Map();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) {
      ok = false;
      console.error(`✗ ${label}重复: ${value}`);
    } else {
      seen.set(value, item);
    }
  }
  return ok;
}

let ok = true;
ok = check("data/pals.json", "schema/pal.schema.json", "幻兽", "id") && ok;
ok = check("data/passive-skills.json", "schema/passive-skill.schema.json", "被动技能", "id") && ok;
ok = check("data/active-skills.json", "schema/active-skill.schema.json", "主动技能", "id") && ok;

const pals = JSON.parse(readFileSync("data/pals.json", "utf-8"));
const activeSkills = JSON.parse(readFileSync("data/active-skills.json", "utf-8"));
const passiveSkills = JSON.parse(readFileSync("data/passive-skills.json", "utf-8"));
const skillIds = new Set(activeSkills.map((skill) => skill.id));
const passiveIds = new Set(passiveSkills.map((skill) => skill.id));
const palReferences = new Set(pals.flatMap((pal) => [String(pal.id), pal.name.zh, pal.name.en]));
ok = checkUnique(pals, (pal) => pal.id, "幻兽 ID") && ok;
ok = checkUnique(pals, (pal) => pal.name.zh, "幻兽中文名") && ok;
ok = checkUnique(pals, (pal) => pal.name.en.toLowerCase(), "幻兽英文名") && ok;
ok = checkUnique(activeSkills, (skill) => skill.id, "主动技能 ID") && ok;
ok = checkUnique(activeSkills, (skill) => skill.name.zh, "主动技能中文名") && ok;
ok = checkUnique(passiveSkills, (skill) => skill.id, "被动技能 ID") && ok;
ok = checkUnique(passiveSkills, (skill) => skill.name.zh, "被动技能中文名") && ok;
for (const pal of pals) {
  for (const skillId of pal.activeSkills ?? []) {
    if (!skillIds.has(skillId)) {
      ok = false;
      console.error(`✗ 幻兽 ${pal.id} 引用了不存在的主动技能: ${skillId}`);
    }
  }
  for (const passiveId of pal.passiveSkills ?? []) {
    if (!passiveIds.has(passiveId)) {
      ok = false;
      console.error(`✗ 幻兽 ${pal.id} 引用了不存在的被动技能: ${passiveId}`);
    }
  }
  const workTypes = (pal.workSuitability ?? []).map((work) => work.type);
  if (new Set(workTypes).size !== workTypes.length) {
    ok = false;
    console.error(`✗ 幻兽 ${pal.id} 存在重复工作适性`);
  }
  for (const parents of pal.breeding?.parents ?? []) {
    for (const parent of parents) {
      if (!palReferences.has(parent)) {
        ok = false;
        console.error(`✗ 幻兽 ${pal.id} 的配种组合引用了不存在的父代: ${parent}`);
      }
    }
  }
}
process.exit(ok ? 0 : 1);
