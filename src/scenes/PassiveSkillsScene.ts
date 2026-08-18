import Phaser from "phaser";
import { passiveSkills } from "../data/loadPassiveSkills";
import {
  PASSIVE_CATEGORY_LABELS,
  PASSIVE_CATEGORY_COLORS,
  PASSIVE_TIER_COLORS,
  PASSIVE_TIER_LABELS,
  type PassiveCategory,
} from "../types/passiveSkill";
import { startScene } from "./sceneLoader";

const CATEGORIES: (PassiveCategory | "all")[] = [
  "all",
  "attack",
  "defense",
  "work",
  "move",
  "element",
  "resource",
  "other",
];
const ROW_H = 54;
const ROW_GAP = 8;
const LIST_TOP = 112;

export class PassiveSkillsScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private selected: PassiveCategory | "all" = "all";

  constructor() {
    super("PassiveSkillsScene");
  }

  create() {
    const width = this.scale.width;
    this.add
      .text(width / 2, 28, "被动技能（全局）", {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.makeBackButton();
    this.makeChips();

    this.list = this.add.container(0, 0);
    this.renderList();

    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const maxScroll = Math.min(0, this.scale.height - this.list.height - LIST_TOP);
      this.list.y = Phaser.Math.Clamp(this.list.y - dy * 0.5, maxScroll, 0);
    });
  }

  private makeBackButton() {
    const btn = this.add
      .text(16, 24, "← 返回图鉴", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#9aa0c0",
      })
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => void startScene(this, "DexScene"));
  }

  private makeChips() {
    const width = this.scale.width;
    const chipW = 84;
    const chipH = 30;
    const gap = 8;
    const totalW = CATEGORIES.length * (chipW + gap) - gap;
    let x = (width - totalW) / 2 + chipW / 2;
    const y = 78;
    CATEGORIES.forEach((cat) => {
      const label = cat === "all" ? "全部" : PASSIVE_CATEGORY_LABELS[cat];
      const bg = this.add
        .rectangle(x, y, chipW, chipH, cat === this.selected ? 0x0f3460 : 0x16213e)
        .setStrokeStyle(1, 0x0f3460)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(x, y, label, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: cat === this.selected ? "#ffffff" : "#9aa0c0",
        })
        .setOrigin(0.5);
      bg.on("pointerdown", () => {
        this.selected = cat;
        this.scene.restart();
      });
      x += chipW + gap;
    });
  }

  private renderList() {
    this.list.removeAll(true);
    const width = this.scale.width;
    const rowW = width - 60;
    const items = passiveSkills.filter((s) => this.selected === "all" || s.category === this.selected);
    items.forEach((s, i) => {
      const y = LIST_TOP + i * (ROW_H + ROW_GAP);
      const row = this.add.container(30, y);
      const bg = this.add.rectangle(0, 0, rowW, ROW_H, 0x16213e).setOrigin(0, 0.5);
      bg.setStrokeStyle(1, 0x0f3460);
      const stripe = this.add
        .rectangle(0, 0, 6, ROW_H, PASSIVE_CATEGORY_COLORS[s.category])
        .setOrigin(0, 0.5);
      const zh = this.add.text(20, -10, s.name.zh, {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#ffffff",
      });
      const en = this.add.text(20, 12, s.name.en, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#9aa0c0",
      });
      const cat = this.add.text(160, -10, PASSIVE_CATEGORY_LABELS[s.category], {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#" + PASSIVE_CATEGORY_COLORS[s.category].toString(16).padStart(6, "0"),
      });
      const desc = this.add.text(160, 12, s.description, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#c0c4e0",
        wordWrap: { width: rowW - 320 },
      });
      const tier = s.tier ?? "common";
      const tierColor = "#" + PASSIVE_TIER_COLORS[tier].toString(16).padStart(6, "0");
      const tierText = this.add
        .text(rowW - 16, 0, PASSIVE_TIER_LABELS[tier], {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: tierColor,
        })
        .setOrigin(1, 0.5);
      row.add([bg, stripe, zh, en, cat, desc, tierText]);
      this.list.add(row);
    });
  }
}
