/** 将任意字符串稳定地散列为非负整数，用于日历/挑战种子。 */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32：由整数种子产生可复现的 [0,1) 伪随机序列。 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** 在 [min, max] 闭区间内生成一个可复现整数。 */
export function seededInt(random: () => number, min: number, max: number): number {
  return Math.floor(min + random() * (max - min + 1));
}

/** 从数组中按种子随机挑选一个元素。 */
export function seededPick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}
