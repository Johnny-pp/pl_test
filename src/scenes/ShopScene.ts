import Phaser from "phaser";
import { loadGame, saveGame, type GameSave } from "../player/playerState";
import { startScene } from "./sceneLoader";
import { createBackButton, createTextButton } from "../ui/button";
import { addSceneTitle, installSceneTheme } from "../ui/theme";
import {
  buyShopItem,
  COIN_LABEL,
  getShopStock,
  isShopItemSoldOut,
  MATERIAL_PRICES,
  sellCraftable,
  sellMaterial,
  SHOP_STOCK,
} from "../shop/shopSystem";
import { equipmentDefinitionsById } from "../data/loadEquipment";
import { announceGameStatus } from "../ui/accessibility";

const ROW_Y = 150;

export class ShopScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private coinsText!: Phaser.GameObjects.Text;
  private message = "";

  constructor() {
    super("ShopScene");
  }

  create() {
    installSceneTheme(this);
    this.save = loadGame(localStorage);
    createBackButton(
      this,
      "返回芦灯港",
      () => void startScene(this, "WorldScene", { region: "startide-archipelago" })
    );
    addSceneTitle(this, "芦灯港商店");
    this.coinsText = this.add
      .text(450, 72, "", { fontFamily: "sans-serif", fontSize: "16px", color: "#ffd54f" })
      .setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.render();
  }

  private render() {
    this.content.removeAll(true);
    this.coinsText.setText(`持有 ${COIN_LABEL}：${this.save.inventory.coins}`);
    if (this.message) {
      this.content.add(
        this.add
          .text(450, 100, this.message, { fontFamily: "sans-serif", fontSize: "14px", color: "#9ccc65" })
          .setOrigin(0.5)
      );
    }

    this.content.add(
      this.add.text(40, ROW_Y - 22, "购入（用品与装备）", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#80deea",
      })
    );
    SHOP_STOCK.forEach((item, index) => this.makeShopRow(item, ROW_Y + 8 + index * 30));

    const sellStartY = ROW_Y + 8 + SHOP_STOCK.length * 30 + 24;
    this.content.add(
      this.add.text(40, sellStartY - 22, "出售（掉落物与制造品）", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#80deea",
      })
    );
    const materials = Object.entries(this.save.inventory.materials).filter(([, count]) => count > 0);
    materials.forEach(([name, count], index) =>
      this.makeMaterialRow(name, count, sellStartY + 8 + index * 26)
    );
    if (materials.length === 0) {
      this.content.add(
        this.add.text(40, sellStartY + 8, "暂无掉落物可供出售", {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#9aa0c0",
        })
      );
    }
    if (this.save.inventory.captureOrbs > 0) {
      this.makeCraftableRow(
        "capture-orb",
        "捕获器",
        this.save.inventory.captureOrbs,
        sellStartY + 8 + materials.length * 26 + 6
      );
    }
    if (this.save.inventory.healingTonics > 0) {
      this.makeCraftableRow(
        "healing-tonic",
        "治疗剂",
        this.save.inventory.healingTonics,
        sellStartY + 8 + materials.length * 26 + 36
      );
    }
  }

  private makeShopRow(item: (typeof SHOP_STOCK)[number], y: number) {
    const remaining = getShopStock(this.save, item);
    const soldOut = isShopItemSoldOut(this.save, item);
    const label =
      item.kind === "equipment" && item.equipmentId
        ? (equipmentDefinitionsById.get(item.equipmentId)?.name.zh ?? item.name)
        : item.name;
    const stockText = item.stockLimit > 0 ? `（余 ${remaining}）` : "";
    const text = this.add.text(40, y, `${label}  —  ${item.price} ${COIN_LABEL}${stockText}`, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: soldOut ? "#9aa0c0" : "#d8def8",
    });
    this.content.add(text);
    this.content.add(
      createTextButton(this, {
        x: 800,
        y,
        width: 96,
        height: 26,
        label: soldOut ? "售罄" : "购买",
        variant: "accent",
        fontSize: "13px",
        disabled: soldOut,
        onPress: () => this.doBuy(item.id),
      })
    );
  }

  private makeMaterialRow(name: string, count: number, y: number) {
    const price = MATERIAL_PRICES[name] ?? 0;
    this.content.add(
      this.add.text(40, y, `${name} ×${count}  —  ${price} ${COIN_LABEL}`, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#d8def8",
      })
    );
    this.content.add(
      createTextButton(this, {
        x: 800,
        y,
        width: 96,
        height: 24,
        label: "出售 ×1",
        variant: "primary",
        fontSize: "13px",
        onPress: () => this.doSellMaterial(name),
      })
    );
  }

  private makeCraftableRow(kind: "capture-orb" | "healing-tonic", name: string, count: number, y: number) {
    const price = kind === "capture-orb" ? 25 : 18;
    this.content.add(
      this.add.text(40, y, `${name} ×${count}  —  收购 ${price} ${COIN_LABEL}`, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#d8def8",
      })
    );
    this.content.add(
      createTextButton(this, {
        x: 800,
        y,
        width: 96,
        height: 24,
        label: "出售 ×1",
        variant: "primary",
        fontSize: "13px",
        onPress: () => this.doSellCraftable(kind),
      })
    );
  }

  doBuy(stockId: string) {
    const item = SHOP_STOCK.find((entry) => entry.id === stockId);
    if (!item) return;
    const result = buyShopItem(this.save, item, equipmentDefinitionsById);
    if (!result.ok) {
      this.message = result.reason ?? "无法购买";
      return this.render();
    }
    if (!saveGame(localStorage, result.save)) {
      this.message = "商店写入存档失败";
      return this.render();
    }
    this.save = result.save;
    this.message = `已购入 ${item.name}`;
    announceGameStatus(this.message);
    this.render();
  }

  doSellMaterial(material: string) {
    const result = sellMaterial(this.save, material);
    if (!result.ok) {
      this.message = result.reason ?? "无法出售";
      return this.render();
    }
    if (!saveGame(localStorage, result.save)) {
      this.message = "商店写入存档失败";
      return this.render();
    }
    this.save = result.save;
    this.message = `已出售 ${material}`;
    this.render();
  }

  doSellCraftable(kind: "capture-orb" | "healing-tonic") {
    const result = sellCraftable(this.save, kind);
    if (!result.ok) {
      this.message = result.reason ?? "无法出售";
      return this.render();
    }
    if (!saveGame(localStorage, result.save)) {
      this.message = "商店写入存档失败";
      return this.render();
    }
    this.save = result.save;
    this.message = `已出售 ${kind === "capture-orb" ? "捕获器" : "治疗剂"}`;
    this.render();
  }
}
