import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { ELEMENT_COLORS, ELEMENT_LABELS, WORK_LABELS } from "../types/elements";
import type { Pal } from "../types/pal";

export class DetailScene extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super("DetailScene");
  }

  create(data: { palId: number }) {
    const pal = pals.find((p) => p.id === data.palId);
    const width = this.scale.width;

    const back = this.add
      .text(20, 18, "< 返回", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#4fc3f7",
      })
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("DexScene"));

    if (!pal) {
      this.add
        .text(width / 2, 200, "未找到该帕鲁", { fontSize: "24px", color: "#fff" })
        .setOrigin(0.5);
      return;
    }

    this.content = this.add.container(0, 0);
    let y = 70;
    const x = 40;

    const head = this.add.text(x, y, `${pal.name.zh}  (${pal.name.en})`, {
      fontFamily: "sans-serif",
      fontSize: "30px",
      color: "#ffffff",
    });
    this.content.add(head);
    y += 40;

    const elemStr = pal.elements.map((e) => ELEMENT_LABELS[e]).join(" / ");
    this.content.add(this.line(x, y, `属性：${elemStr}`, ELEMENT_COLORS[pal.elements[0] ?? "neutral"]));
    y += 26;
    if (pal.description) {
      this.content.add(this.line(x, y, `描述：${pal.description}`, 0xcccccc, 16, 760));
      y += 48;
    }

    y = this.section(x, y, "基础属性");
    y = this.statsBlock(x, y, pal);

    y = this.section(x, y, "工作适性");
    if (pal.workSuitability.length === 0) {
      this.content.add(this.line(x, y, "—", 0x888888));
      y += 24;
    } else {
      for (const w of pal.workSuitability) {
        this.content.add(this.line(x, y, `${WORK_LABELS[w.type]}：Lv.${w.level}`, 0x9ccc65));
        y += 24;
      }
    }

    if (pal.partnerSkill) {
      y = this.section(x, y, "伙伴技能");
      this.content.add(this.line(x, y, pal.partnerSkill.name, 0xffd54f, 18));
      y += 26;
      this.content.add(this.line(x, y, pal.partnerSkill.description, 0xcccccc, 15, 760));
      y += 44;
      if (pal.partnerSkill.ranks) {
        for (const r of pal.partnerSkill.ranks) {
          this.content.add(this.line(x + 12, y, r, 0xaaaaaa, 14, 740));
          y += 22;
        }
        y += 8;
      }
    }

    y = this.section(x, y, "技能");
    this.content.add(this.line(x, y, `主动：${(pal.activeSkills ?? []).join("、") || "—"}`, 0x80deea));
    y += 26;
    this.content.add(
      this.line(x, y, "被动（全局特性）：任意帕鲁均可随机携带，捕获/孵化时概率获得。", 0x80deea, 15, 760)
    );
    y += 26;
    const link = this.line(x, y, "→ 查看全部被动技能", 0xffd54f, 15, 0);
    link.setInteractive({ useHandCursor: true });
    link.on("pointerdown", () => this.scene.start("PassiveSkillsScene"));
    this.content.add(link);
    y += 34;

    y = this.section(x, y, "掉落物");
    for (const d of pal.drops ?? []) {
      this.content.add(this.line(x, y, `${d.item}：${d.rate}%`, 0xff8a65));
      y += 24;
    }
    if (!pal.drops || pal.drops.length === 0) {
      this.content.add(this.line(x, y, "—", 0x888888));
      y += 24;
    }

    y = this.section(x, y, "刷新位置");
    this.content.add(this.line(x, y, (pal.spawnLocations ?? []).join("、") || "—", 0xb39ddb));
    y += 30;

    if (pal.breeding) {
      y = this.section(x, y, "配种");
      this.content.add(this.line(x, y, `配种力：${pal.breeding.power}`, 0xf48fb1));
      y += 24;
    }

    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        this.content.y = Phaser.Math.Clamp(this.content.y - dy * 0.5, -y + this.scale.height - 40, 0);
      }
    );
  }

  private line(
    x: number,
    y: number,
    text: string,
    color: number,
    size = 16,
    wrap = 0
  ): Phaser.GameObjects.Text {
    const t = this.add.text(x, y, text, {
      fontFamily: "sans-serif",
      fontSize: `${size}px`,
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
    });
    if (wrap > 0) t.setWordWrapWidth(wrap);
    return t;
  }

  private section(x: number, y: number, title: string): number {
    this.content.add(
      this.add.text(x, y, `▍${title}`, {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#ffffff",
      })
    );
    return y + 30;
  }

  private statsBlock(x: number, y: number, pal: Pal): number {
    const s = pal.stats;
    const rows: [string, number][] = [
      ["HP", s.hp],
      ["攻击", s.attack],
      ["防御", s.defense],
      ["工作速度", s.workSpeed],
      ["移动速度", s.moveSpeed],
      ["骑行速度", s.rideSprintSpeed],
      ["售价", s.price ?? 0],
    ];
    const maxVal = Math.max(...rows.map((r) => r[1]), 1);
    const barW = 320;
    for (const [label, val] of rows) {
      this.content.add(this.line(x, y, label, 0xcccccc, 15));
      const bg = this.add.rectangle(x + 70, y + 8, barW, 12, 0x0f3460).setOrigin(0, 0.5);
      const fill = this.add
        .rectangle(x + 70, y + 8, (barW * val) / maxVal, 12, 0x4fc3f7)
        .setOrigin(0, 0.5);
      this.content.add([bg, fill]);
      this.content.add(this.line(x + 70 + barW + 10, y, `${val}`, 0xffffff, 14));
      y += 24;
    }
    return y + 10;
  }
}
