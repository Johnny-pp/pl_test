import type { GameSave } from "../player/playerState.ts";
import type { EquipmentDefinition } from "../types/skillTree.ts";

/** 通用货币名称。 */
export const COIN_LABEL = "星币";

/** 掉落物名称 -> 出售单价（星币）。 */
export const MATERIAL_PRICES: Record<string, number> = {
  柔韧绒丝: 8,
  斑纹软皮: 7,
  荧苔孢子: 9,
  净水囊: 7,
  蓄电尖针: 10,
  清霜结晶: 11,
  幽光铃片: 12,
  韧性枝冠: 14,
  酸甜野果: 5,
  温火角屑: 12,
  岩脊硬片: 13,
  暖焰绒: 9,
  星烬翼膜: 25,
  龙息晶核: 40,
  浮云软绒: 12,
  轻帆耳膜: 18,
  鸣振晶片: 16,
  湿润岩膜: 10,
  钟鸣角环: 22,
  致密黑岩: 14,
  雾纹翼粉: 13,
  冷光绡丝: 17,
  潮镜壳片: 15,
  回流水珠: 12,
  岚电角屑: 22,
  云纹硬绒: 14,
  长明芦籽: 12,
  防潮短绒: 10,
  浮泥鳍膜: 11,
  沼气泡囊: 9,
  测潮冠羽: 15,
  温萤粉: 12,
  感潮须珠: 18,
  夯实泥核: 12,
  净沼菌伞: 14,
  幽光鹿苔: 12,
  导流甲片: 18,
  缓涡水核: 26,
  锈鸣铜环: 16,
  吸音黑羽: 12,
  璨电尾膜: 22,
  潮导晶丝: 14,
  回流墨囊: 16,
  拒水狐毛: 13,
  星向苇冠: 26,
  潮纹龙鳞: 30,
  沉星翼晶: 34,
  深潮鳞膜: 20,
  晦曜星核: 50,
  古历岩板: 18,
};

/** 制造品的出售单价。 */
export const CRAFTABLE_SELL_PRICES: Record<"capture-orb" | "healing-tonic", number> = {
  "capture-orb": 25,
  "healing-tonic": 18,
};

export type ShopGoodKind = "capture-orb" | "healing-tonic" | "equipment";

export interface ShopStockItem {
  /** 商店库存条目标识，用于记录已售罄状态。 */
  id: string;
  kind: ShopGoodKind;
  /** kind 为 equipment 时对应的装备 id。 */
  equipmentId?: string;
  name: string;
  price: number;
  /** 限量商品的库存上限；0 表示无限量。 */
  stockLimit: number;
}

export const SHOP_STOCK: ShopStockItem[] = [
  { id: "shop-capture-orb", kind: "capture-orb", name: "捕获器", price: 60, stockLimit: 0 },
  { id: "shop-healing-tonic", kind: "healing-tonic", name: "治疗剂", price: 40, stockLimit: 0 },
  { id: "shop-equip-reed-plate", kind: "equipment", equipmentId: "armor-reed-plate", name: "苇编护甲", price: 90, stockLimit: 1 },
  { id: "shop-equip-bark-token", kind: "equipment", equipmentId: "charm-bark-token", name: "树皮护符", price: 70, stockLimit: 1 },
  { id: "shop-equip-grove-moss", kind: "equipment", equipmentId: "core-grove-moss", name: "林苔芯核", price: 80, stockLimit: 1 },
  { id: "shop-equip-tide-pearl", kind: "equipment", equipmentId: "core-tide-pearl", name: "潮汐珍珠核", price: 110, stockLimit: 1 },
  { id: "shop-equip-frost-seal", kind: "equipment", equipmentId: "charm-frost-seal", name: "霜印护符", price: 130, stockLimit: 1 },
  { id: "shop-equip-crystal-vein", kind: "equipment", equipmentId: "core-crystal-vein", name: "晶脉核心", price: 320, stockLimit: 1 },
  { id: "shop-equip-scale-mantle", kind: "equipment", equipmentId: "armor-scale-mantle", name: "鳞纹披甲", price: 360, stockLimit: 1 },
];

export function getShopStock(save: GameSave, item: ShopStockItem): number {
  if (item.stockLimit <= 0) return Number.POSITIVE_INFINITY;
  const remaining = save.progress.shopStock[item.id];
  if (remaining === undefined) return item.stockLimit;
  return Math.max(0, Math.min(item.stockLimit, remaining));
}

export function isShopItemSoldOut(save: GameSave, item: ShopStockItem): boolean {
  return getShopStock(save, item) <= 0;
}

export interface PurchaseResult {
  save: GameSave;
  ok: boolean;
  reason?: string;
}

export function buyShopItem(
  save: GameSave,
  item: ShopStockItem,
  equipmentDefinitions: ReadonlyMap<string, EquipmentDefinition>
): PurchaseResult {
  if (getShopStock(save, item) <= 0) return { save, ok: false, reason: "该商品已经售罄" };
  if (save.inventory.coins < item.price)
    return { save, ok: false, reason: `星币不足，需要 ${item.price}` };
  const equipmentItems = [...save.inventory.equipment];
  if (item.kind === "equipment") {
    if (!item.equipmentId || !equipmentDefinitions.has(item.equipmentId))
      return { save, ok: false, reason: "商品配置错误" };
    equipmentItems.push({ uid: `shop-${item.id}`, equipmentId: item.equipmentId });
  }
  const next: GameSave = {
    ...save,
    inventory: {
      ...save.inventory,
      coins: save.inventory.coins - item.price,
      captureOrbs: save.inventory.captureOrbs + (item.kind === "capture-orb" ? 1 : 0),
      healingTonics: save.inventory.healingTonics + (item.kind === "healing-tonic" ? 1 : 0),
      equipment: equipmentItems,
    },
  };
  if (item.stockLimit > 0) {
    next.progress = {
      ...next.progress,
      shopStock: {
        ...next.progress.shopStock,
        [item.id]: Math.max(0, getShopStock(save, item) - 1),
      },
    };
  }
  return { save: next, ok: true };
}

export function sellMaterial(save: GameSave, material: string): PurchaseResult {
  const count = save.inventory.materials[material] ?? 0;
  const price = MATERIAL_PRICES[material];
  if (count <= 0) return { save, ok: false, reason: "没有该掉落物" };
  if (price === undefined) return { save, ok: false, reason: "该物品没有收购价" };
  return {
    save: {
      ...save,
      inventory: {
        ...save.inventory,
        coins: save.inventory.coins + price,
        materials: {
          ...save.inventory.materials,
          [material]: count - 1,
        },
      },
    },
    ok: true,
  };
}

export function sellCraftable(save: GameSave, kind: "capture-orb" | "healing-tonic"): PurchaseResult {
  const price = CRAFTABLE_SELL_PRICES[kind];
  const count = kind === "capture-orb" ? save.inventory.captureOrbs : save.inventory.healingTonics;
  if (count <= 0) return { save, ok: false, reason: "没有可出售的制造品" };
  return {
    save: {
      ...save,
      inventory: {
        ...save.inventory,
        coins: save.inventory.coins + price,
        captureOrbs: kind === "capture-orb" ? count - 1 : save.inventory.captureOrbs,
        healingTonics: kind === "healing-tonic" ? count - 1 : save.inventory.healingTonics,
      },
    },
    ok: true,
  };
}
