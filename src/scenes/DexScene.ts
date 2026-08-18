import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import type { Pal } from "../types/pal";

const CARD_W = 200;
const CARD_H = 96;
const GAP = 16;
const COLS = 4;

export class DexScene extends Phaser.Scene {
  private grid!: Phaser.GameObjects.Container;

  constructor() {
    super("DexScene");
  }

  create() {
    const width = this.scale.width;
    this.add
      .text(width / 2, 28, "帕鲁图鉴", {
        fontFamily: "sans-serif",
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.grid = this.add.container(0, 0);
    const totalW = COLS * (CARD_W + GAP) - GAP;
    const startX = (width - totalW) / 2 + CARD_W / 2;
    const startY = 80;

    this.makePassiveButton(width);

    pals.forEach((pal, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const card = this.makeCard(pal);
      card.setPosition(startX + col * (CARD_W + GAP), startY + row * (CARD_H + GAP));
      this.grid.add(card);
    });

    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const maxScroll = Math.min(0, this.scale.height - this.grid.height - startY);
        this.grid.y = Phaser.Math.Clamp(this.grid.y - dy * 0.5, maxScroll, 0);
      }
    );
  }

  private makeCard(pal: Pal): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const bg = this.add
      .rectangle(0, 0, CARD_W, CARD_H, 0x16213e)
      .setStrokeStyle(2, 0x0f3460);
    const elem = pal.elements[0] ?? "neutral";
    const dot = this.add.circle(-CARD_W / 2 + 22, 0, 10, ELEMENT_COLORS[elem]);
    const idText = this.add.text(-CARD_W / 2 + 42, -CARD_H / 2 + 10, `#${pal.id}`, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#8a8aa0",
    });
    const nameText = this.add.text(-CARD_W / 2 + 42, -CARD_H / 2 + 30, pal.name.zh, {
      fontFamily: "sans-serif",
      fontSize: "20px",
      color: "#ffffff",
    });
    const enText = this.add.text(-CARD_W / 2 + 42, CARD_H / 2 - 24, pal.name.en, {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#9aa0c0",
    });
    const elemText = this.add
      .text(CARD_W / 2 - 12, CARD_H / 2 - 22, ELEMENT_LABELS[elem], {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffffff",
      })
      .setOrigin(1, 0);
    c.add([bg, dot, idText, nameText, enText, elemText]);

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.scene.start("DetailScene", { palId: pal.id }));
    return c;
  }

  private makePassiveButton(width: number) {
    const btn = this.add
      .text(width - 16, 28, "被动技能", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#9aa0c0",
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.scene.start("PassiveSkillsScene"));
  }
}
