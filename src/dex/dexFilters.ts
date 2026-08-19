import { ELEMENT_LABELS, WORK_LABELS } from "../types/elements.ts";
import type { ElementType, Pal, WorkType } from "../types/pal";

export type DexSortKey = "id" | "name" | "rarity" | "hp" | "attack";

export interface DexFilterOptions {
  searchText: string;
  elements: ReadonlySet<ElementType>;
  works: ReadonlySet<WorkType>;
  sortKey: DexSortKey;
}

export function filterAndSortPals(items: readonly Pal[], options: DexFilterOptions): Pal[] {
  const query = options.searchText.trim().toLowerCase();
  const filtered = items.filter((pal) => {
    if (query) {
      const haystack = [
        String(pal.id),
        pal.name.zh,
        pal.name.en,
        ...pal.elements.map((element) => ELEMENT_LABELS[element]),
        ...pal.workSuitability.map((work) => WORK_LABELS[work.type]),
        ...(pal.spawnLocations ?? []),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (options.elements.size > 0 && !pal.elements.some((element) => options.elements.has(element)))
      return false;
    if (options.works.size > 0 && !pal.workSuitability.some((work) => options.works.has(work.type)))
      return false;
    return true;
  });

  return [...filtered].sort((left, right) => {
    switch (options.sortKey) {
      case "id":
        return left.id - right.id;
      case "name":
        return left.name.zh.localeCompare(right.name.zh, "zh");
      case "rarity":
        return right.rarity - left.rarity;
      case "hp":
        return right.stats.hp - left.stats.hp;
      case "attack":
        return right.stats.attack - left.stats.attack;
    }
  });
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.max(0, Math.min(pageCount - 1, Math.floor(page)));
  return {
    page: safePage,
    pageCount,
    items: items.slice(safePage * pageSize, (safePage + 1) * pageSize),
  };
}
