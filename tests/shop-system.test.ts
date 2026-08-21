import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptySave, addCoins, addMaterial } from "../src/player/playerState.ts";
import {
  buyShopItem,
  getShopStock,
  isShopItemSoldOut,
  sellCraftable,
  sellMaterial,
  SHOP_STOCK,
} from "../src/shop/shopSystem.ts";
import type { EquipmentDefinition } from "../src/types/skillTree.ts";

const equipmentDefinitionsById = new Map(
  (
    JSON.parse(
      readFileSync(new URL("../data/equipment.json", import.meta.url), "utf-8")
    ) as EquipmentDefinition[]
  ).map((definition) => [definition.id, definition])
);

const captureOrb = SHOP_STOCK.find((item) => item.id === "shop-capture-orb")!;
const healingTonic = SHOP_STOCK.find((item) => item.id === "shop-healing-tonic")!;
const reedPlate = SHOP_STOCK.find((item) => item.id === "shop-equip-reed-plate")!;

test("商店购买会扣除星币并结算货币、道具与限量库存", () => {
  const save = addCoins(createEmptySave(), 500);
  const before = save.inventory.coins;
  const bought = buyShopItem(save, captureOrb, equipmentDefinitionsById);
  assert.equal(bought.ok, true);
  assert.equal(bought.save.inventory.captureOrbs, save.inventory.captureOrbs + 1);
  assert.equal(bought.save.inventory.coins, before - captureOrb.price);

  const boughtTonic = buyShopItem(bought.save, healingTonic, equipmentDefinitionsById);
  assert.equal(boughtTonic.ok, true);
  assert.equal(boughtTonic.save.inventory.healingTonics, 1);
});

test("限量装备售罄后不可重复购买，库存持久化", () => {
  const save = addCoins(createEmptySave(), 1000);
  assert.equal(getShopStock(save, reedPlate), 1);
  const first = buyShopItem(save, reedPlate, equipmentDefinitionsById);
  assert.equal(first.ok, true);
  assert.equal(getShopStock(first.save, reedPlate), 0);
  assert.equal(isShopItemSoldOut(first.save, reedPlate), true);
  const equipment = first.save.inventory.equipment;
  assert.equal(equipment.length, 1);
  assert.equal(equipment[0].equipmentId, reedPlate.equipmentId);

  const second = buyShopItem(first.save, reedPlate, equipmentDefinitionsById);
  assert.equal(second.ok, false);
  assert.equal(second.save.inventory.equipment.length, 1);
});

test("星币不足时购买失败且不结算", () => {
  const save = createEmptySave();
  const result = buyShopItem(save, captureOrb, equipmentDefinitionsById);
  assert.equal(result.ok, false);
  assert.equal(result.save.inventory.captureOrbs, save.inventory.captureOrbs);
  assert.equal(result.save.inventory.coins, save.inventory.coins);
});

test("出售掉落物与制造品能获得星币且不可重复利用", () => {
  let save = addMaterial(createEmptySave(), "柔韧绒丝", 2);
  save = addCoins(save, 0);
  const coinsBefore = save.inventory.coins;
  const sold = sellMaterial(save, "柔韧绒丝");
  assert.equal(sold.ok, true);
  assert.equal(sold.save.inventory.materials["柔韧绒丝"], 1);
  assert.equal(sold.save.inventory.coins, coinsBefore + 8);
  const resold = sellMaterial(sold.save, "柔韧绒丝");
  assert.equal(resold.ok, true);
  assert.equal(resold.save.inventory.materials["柔韧绒丝"], 0);
  assert.equal(sellMaterial(resold.save, "柔韧绒丝").ok, false);

  const crafted = createEmptySave();
  crafted.inventory.captureOrbs = 2;
  const soldOrb = sellCraftable(crafted, "capture-orb");
  assert.equal(soldOrb.ok, true);
  assert.equal(soldOrb.save.inventory.captureOrbs, 1);
  assert.equal(soldOrb.save.inventory.coins, crafted.inventory.coins + 25);
});
