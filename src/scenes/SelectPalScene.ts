import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import type { Pal } from "../types/pal";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";

const CARD_W = 190;
const CARD_H = 105;
const GAP = 18;
const COLS = 4;

export class SelectPalScene extends Phaser.Scene {
  constructor() {
    super("SelectPalScene");
  }

  preload() {
    preloadPalPortraits(this);
  }

  create() {
    const width = this.scale.width;
    this.add.text(18, 18, "< 返回图鉴", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#4fc3f7",
    }).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("DexScene"));

    this.add.text(width / 2, 28, "选择出战幻兽", {
      fontFamily: "sans-serif",
      fontSize: "30px",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.add.text(width / 2, 66, "选择后将随机遭遇一只野生幻兽", {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#9aa0c0",
    }).setOrigin(0.5);

    const totalW = COLS * CARD_W + (COLS - 1) * GAP;
    const startX = (width - totalW) / 2 + CARD_W / 2;
    pals.forEach((pal, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      this.makeCard(
        pal,
        startX + col * (CARD_W + GAP),
        135 + row * (CARD_H + GAP)
      );
    });
  }

  private makeCard(pal: Pal, x: number, y: number) {
    const element = pal.elements[0] ?? "neutral";
    const bg = this.add.rectangle(x, y, CARD_W, CARD_H, 0x16213e)
      .setStrokeStyle(2, ELEMENT_COLORS[element])
      .setInteractive({ useHandCursor: true });
    addPalPortrait(this, pal.id, x - 62, y, 74);
    this.add.text(x - 20, y - 35, `#${pal.id}  ${pal.name.zh}`, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#ffffff",
    });
    this.add.text(x - 20, y - 8, pal.elements.map((e) => ELEMENT_LABELS[e]).join(" / "), {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#9aa0c0",
    });
    this.add.text(x - 20, y + 19, `HP ${pal.stats.hp}  攻 ${pal.stats.attack}`, {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#80deea",
    });

    bg.on("pointerover", () => bg.setFillStyle(0x20345c));
    bg.on("pointerout", () => bg.setFillStyle(0x16213e));
    bg.on("pointerdown", () => this.startBattle(pal));
  }

  private startBattle(player: Pal) {
    const candidates = pals.filter((pal) => pal.id !== player.id);
    const enemy = candidates[Math.floor(Math.random() * candidates.length)];
    if (!enemy) return;
    this.scene.start("BattleScene", { playerId: player.id, enemyId: enemy.id });
  }
}
