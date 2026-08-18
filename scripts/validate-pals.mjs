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

let ok = true;
ok = check("data/pals.json", "schema/pal.schema.json", "帕鲁", "id") && ok;
ok = check("data/passive-skills.json", "schema/passive-skill.schema.json", "被动技能", "id") && ok;
process.exit(ok ? 0 : 1);

