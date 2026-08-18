import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";
import type { Pal } from "../types/pal";

const STAT_ROWS: Array<[string, (pal: Pal) => number]> = [
  ["HP", (pal) => pal.stats.hp],
  ["攻击", (pal) => pal.stats.attack],
  ["防御", (pal) => pal.stats.defense],
  ["工作速度", (pal) => pal.stats.workSpeed],
  ["移动速度", (pal) => pal.stats.moveSpeed],
  ["骑行速度", (pal) => pal.stats.rideSprintSpeed],
  ["捕获率", (pal) => pal.catchRate ?? 0],
  ["稀有度", (pal) => pal.rarity],
];

export class CompareScene extends Phaser.Scene {
  private leftIndex = 0;
  private rightIndex = 1;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super("CompareScene");
  }

  preload() {
    preloadPalPortraits(this);
  }

  create(data: { palId?: number } = {}) {
    const initial = pals.findIndex((pal) => pal.id === data.palId);
    this.leftIndex = initial >= 0 ? initial : 0;
    this.rightIndex = (this.leftIndex + 1) % pals.length;
    this.add
      .text(18, 18, "< 返回图鉴", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#4fc3f7",
      })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("DexScene"));
    this.add
      .text(450, 28, "幻兽属性对比", {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.render();
  }

  private render() {
    this.content.removeAll(true);
    const left = pals[this.leftIndex];
    const right = pals[this.rightIndex];
    this.renderHeader(left, 250, "left");
    this.renderHeader(right, 650, "right");
    this.addContent(
      this.add
        .text(450, 260, "左侧相对差值", {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#68718e",
        })
        .setOrigin(0.5)
    );
    STAT_ROWS.forEach(([label, value], index) => {
      const y = 300 + index * 38;
      const leftValue = value(left);
      const rightValue = value(right);
      const max = Math.max(leftValue, rightValue, 1);
      this.addContent(
        this.add.text(72, y, label, { fontFamily: "sans-serif", fontSize: "15px", color: "#b8c0df" })
      );
      this.addContent(this.add.rectangle(145, y + 8, 210, 12, 0x17233e).setOrigin(0, 0.5));
      this.addContent(
        this.add.rectangle(145, y + 8, (210 * leftValue) / max, 12, 0x4fc3f7).setOrigin(0, 0.5)
      );
      this.addContent(
        this.add.text(365, y, String(leftValue), {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#ffffff",
        })
      );
      const difference = leftValue - rightValue;
      this.addContent(
        this.add
          .text(450, y, `${difference > 0 ? "+" : ""}${difference}`, {
            fontFamily: "sans-serif",
            fontSize: "14px",
            color: difference > 0 ? "#9ccc65" : difference < 0 ? "#ff8a80" : "#9aa0c0",
          })
          .setOrigin(0.5)
      );
      this.addContent(
        this.add.text(505, y, String(rightValue), {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#ffffff",
        })
      );
      this.addContent(this.add.rectangle(545, y + 8, 210, 12, 0x17233e).setOrigin(0, 0.5));
      this.addContent(
        this.add.rectangle(545, y + 8, (210 * rightValue) / max, 12, 0xff8a65).setOrigin(0, 0.5)
      );
    });
  }

  private renderHeader(pal: Pal, x: number, side: "left" | "right") {
    this.addContent(addPalPortrait(this, pal.id, x, 135, 145));
    this.addContent(
      this.add
        .text(x, 215, pal.name.zh, {
          fontFamily: "sans-serif",
          fontSize: "22px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
    );
    const element = pal.elements[0] ?? "neutral";
    this.addContent(
      this.add
        .text(x, 242, pal.elements.map((item) => ELEMENT_LABELS[item]).join("/"), {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: Phaser.Display.Color.IntegerToColor(ELEMENT_COLORS[element]).rgba,
        })
        .setOrigin(0.5)
    );
    this.addContent(this.makeButton(x - 120, 135, "‹", () => this.cycle(side, -1)));
    this.addContent(this.makeButton(x + 120, 135, "›", () => this.cycle(side, 1)));
  }

  private cycle(side: "left" | "right", delta: number) {
    if (side === "left") this.leftIndex = (this.leftIndex + delta + pals.length) % pals.length;
    else this.rightIndex = (this.rightIndex + delta + pals.length) % pals.length;
    this.render();
  }

  private makeButton(x: number, y: number, label: string, action: () => void) {
    const bg = this.add.circle(x, y, 25, 0x0f4660).setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, { fontFamily: "sans-serif", fontSize: "30px", color: "#ffffff" })
      .setOrigin(0.5);
    bg.on("pointerdown", action);
    return this.add.container(0, 0, [bg, text]);
  }

  private addContent(...objects: Phaser.GameObjects.GameObject[]) {
    this.content.add(objects);
  }
}
