import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

const ajv = new Ajv2020({ allErrors: true });
const schema = JSON.parse(readFileSync("schema/pal.schema.json", "utf-8"));
const validate = ajv.compile(schema);

const data = JSON.parse(readFileSync("data/pals.json", "utf-8"));
let ok = true;
for (const pal of data) {
  if (!validate(pal)) {
    ok = false;
    console.error(`✗ 帕鲁 #${pal.id} (${pal.name?.zh ?? "?"}) 校验失败:`);
    for (const e of validate.errors) {
      console.error(`   - 路径 ${e.instancePath || "/"}: ${e.message}`);
    }
  } else {
    console.log(`✓ 帕鲁 #${pal.id} (${pal.name.zh}) 通过校验`);
  }
}
process.exit(ok ? 0 : 1);
