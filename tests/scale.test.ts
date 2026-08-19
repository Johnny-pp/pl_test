import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { filterAndSortPals, paginate } from "../src/dex/dexFilters.ts";
import {
  createEmptySave,
  createPalInstance,
  exportSaveBackup,
  importSaveBackup,
} from "../src/player/playerState.ts";
import { BALANCE_BASELINE } from "../src/balance/balanceBaseline.ts";
import type { Pal } from "../src/types/pal.ts";

const pals = JSON.parse(readFileSync(new URL("../data/pals.json", import.meta.url), "utf-8")) as Pal[];

function simulatedPals(count: number): Pal[] {
  return Array.from({ length: count }, (_, index) => {
    const source = pals[index % pals.length];
    return {
      ...source,
      id: 1_000 + index,
      name: { zh: `模拟幻兽${index}`, en: `Simulated Pal ${index}` },
      stats: { ...source.stats, hp: source.stats.hp + index },
      growth: { ...source.growth },
      workSuitability: source.workSuitability.map((work) => ({ ...work })),
    };
  });
}

test("500 条模拟图鉴可稳定筛选、排序和分页", () => {
  const items = simulatedPals(BALANCE_BASELINE.simulatedDexEntries);
  const started = performance.now();
  let result: Pal[] = [];
  for (let index = 0; index < 100; index += 1) {
    result = filterAndSortPals(items, {
      searchText: "模拟幻兽4",
      elements: new Set(),
      works: new Set(),
      sortKey: "hp",
    });
  }
  const elapsed = performance.now() - started;
  assert.ok(result.length > 0);
  assert.ok(result[0].stats.hp >= result[result.length - 1].stats.hp);
  const page = paginate(items, 20, 24);
  assert.equal(page.items.length, 20);
  assert.equal(page.pageCount, 21);
  assert.ok(elapsed < 1_000, `筛选耗时 ${elapsed.toFixed(1)}ms`);
});

test("500 个个体的存档可在容量基线内导出并完整恢复", () => {
  const species = simulatedPals(BALANCE_BASELINE.simulatedDexEntries);
  const save = createEmptySave(0);
  save.ownedPals = species.map((pal, index) => createPalInstance(pal, () => `scale-pal-${index}`));
  save.teamIds = save.ownedPals.slice(0, 6).map((pal) => pal.uid);
  const backup = exportSaveBackup(save);
  assert.ok(Buffer.byteLength(backup) < BALANCE_BASELINE.maximumBackupBytes);
  const restored = importSaveBackup(backup);
  assert.equal(restored?.ownedPals.length, BALANCE_BASELINE.simulatedDexEntries);
  assert.deepEqual(restored?.teamIds, save.teamIds);
});
