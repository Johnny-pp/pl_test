import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { ELEMENT_COLORS, ELEMENT_LABELS, WORK_LABELS } from "../types/elements";
import type { ElementType, WorkType, Pal } from "../types/pal";

const CARD_W = 200;
const CARD_H = 96;
const GAP = 16;
const COLS = 4;

const ELEMENTS = Object.keys(ELEMENT_LABELS) as ElementType[];
const WORKS = Object.keys(WORK_LABELS) as WorkType[];

interface SortOpt {
  key: "id" | "name" | "rarity" | "hp" | "attack";
  label: string;
}

const SORTS: SortOpt[] = [
  { key: "id", label: "编号" },
  { key: "name", label: "名称" },
  { key: "rarity", label: "稀有" },
  { key: "hp", label: "HP" },
  { key: "attack", label: "攻击" },
];

interface Chip {
  bg: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
}

const GRID_TOP = 170;
const STORAGE_KEY = "pl_test_filter_state";

interface SavedState {
  searchText: string;
  sortKey: SortOpt["key"];
  elements: ElementType[];
  works: WorkType[];
  scrollY: number;
}

export class DexScene extends Phaser.Scene {
  private grid!: Phaser.GameObjects.Container;
  private countText!: Phaser.GameObjects.Text;
  private emptyText!: Phaser.GameObjects.Text;
  private searchInput?: HTMLInputElement;

  private searchText = "";
  private activeElements = new Set<ElementType>();
  private activeWorks = new Set<WorkType>();
  private sortKey: SortOpt["key"] = "id";
  private scrollY = 0;

  private elementChips = new Map<ElementType, Chip>();
  private workChips = new Map<WorkType, Chip>();
  private sortButtons = new Map<SortOpt["key"], Chip>();

  constructor() {
    super("DexScene");
  }

  create() {
    const width = this.scale.width;
    this.loadState();
    this.elementChips.clear();
    this.workChips.clear();
    this.sortButtons.clear();

    this.add
      .text(width / 2, 22, "帕鲁图鉴", {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.makePassiveButton(width);

    this.buildSearchInput();
    this.buildSortButtons();
    this.buildChips(width);
    this.buildClearButton(width);

    this.applyStateToUI();

    this.countText = this.add.text(280, 60, "", {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#9aa0c0",
    }).setOrigin(0, 0.5);

    this.emptyText = this.add
      .text(width / 2, GRID_TOP + 80, "未找到匹配的帕鲁", {
        fontFamily: "sans-serif",
        fontSize: "22px",
        color: "#9aa0c0",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.grid = this.add.container(0, 0);
    this.renderGrid();

    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const maxScroll = Math.min(
          0,
          this.scale.height - this.grid.height - GRID_TOP
        );
        this.scrollY = Phaser.Math.Clamp(
          this.grid.y - dy * 0.5,
          maxScroll,
          0
        );
        this.grid.y = this.scrollY;
        this.saveState();
      }
    );
  }

  // ---- 搜索框（DOM，支持中文输入法） ----
  private buildSearchInput() {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "搜索 名称/编号/属性/工作/地点";
    Object.assign(input.style, {
      width: "240px",
      height: "30px",
      padding: "0 8px",
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#0f1830",
      border: "1px solid #0f3460",
      borderRadius: "6px",
      outline: "none",
      fontFamily: "sans-serif",
      pointerEvents: "auto",
    });
    this.add.dom(16, 60, input).setOrigin(0, 0.5);
    input.addEventListener("input", () => {
      this.searchText = input.value;
      this.renderGrid();
    });
    this.searchInput = input;
  }

  // ---- 排序按钮 ----
  private buildSortButtons() {
    const startX = 420;
    const y = 60;
    const w = 60;
    const gap = 6;
    let x = startX;
    SORTS.forEach((s) => {
      const chip = this.makeChip(x, y, w, 28, s.label, () => {
        this.sortKey = s.key;
        this.sortButtons.forEach((c, key) =>
          this.refreshChip(c, key === s.key, 0x4fc3f7)
        );
        this.renderGrid();
      });
      this.sortButtons.set(s.key, chip);
      x += w + gap;
    });
  }

  // ---- 元素 / 工作 筛选标签 ----
  private buildChips(width: number) {
    const eTotal = ELEMENTS.length * (64 + 6) - 6;
    let ex = (width - eTotal) / 2 + 32;
    ELEMENTS.forEach((e) => {
      const chip = this.makeChip(ex, 102, 64, 26, ELEMENT_LABELS[e], () => {
        if (this.activeElements.has(e)) this.activeElements.delete(e);
        else this.activeElements.add(e);
        this.refreshChip(
          this.elementChips.get(e)!,
          this.activeElements.has(e),
          ELEMENT_COLORS[e]
        );
        this.renderGrid();
      });
      this.elementChips.set(e, chip);
      ex += 70;
    });

    const wTotal = WORKS.length * (54 + 6) - 6;
    let wx = (width - wTotal) / 2 + 27;
    WORKS.forEach((w) => {
      const chip = this.makeChip(wx, 138, 54, 24, WORK_LABELS[w], () => {
        if (this.activeWorks.has(w)) this.activeWorks.delete(w);
        else this.activeWorks.add(w);
        this.refreshChip(
          this.workChips.get(w)!,
          this.activeWorks.has(w),
          0x4fc3f7
        );
        this.renderGrid();
      });
      this.workChips.set(w, chip);
      wx += 60;
    });
  }

  private buildClearButton(width: number) {
    const btn = this.add
      .text(width - 16, 60, "清除", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#9aa0c0",
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.clearFilters());
  }

  private clearFilters() {
    this.searchText = "";
    if (this.searchInput) this.searchInput.value = "";
    this.activeElements.clear();
    this.activeWorks.clear();
    this.elementChips.forEach((c) => this.refreshChip(c, false, 0));
    this.workChips.forEach((c) => this.refreshChip(c, false, 0));
    this.sortKey = "id";
    this.sortButtons.forEach((c, key) =>
      this.refreshChip(c, key === "id", 0x4fc3f7)
    );
    this.renderGrid();
  }

  private makeChip(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void
  ): Chip {
    const bg = this.add
      .rectangle(x, y, w, h, 0x16213e)
      .setStrokeStyle(1, 0x0f3460)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#9aa0c0",
      })
      .setOrigin(0.5);
    bg.on("pointerdown", onClick);
    return { bg, txt };
  }

  private refreshChip(chip: Chip, active: boolean, color: number) {
    if (active) {
      chip.bg.setFillStyle(color, 0.85);
      chip.bg.setStrokeStyle(1, color);
      chip.txt.setColor("#ffffff");
    } else {
      chip.bg.setFillStyle(0x16213e, 1);
      chip.bg.setStrokeStyle(1, 0x0f3460);
      chip.txt.setColor("#9aa0c0");
    }
  }

  // ---- 本地存储（localStorage）持久化筛选状态 ----
  private loadState() {
    this.searchText = "";
    this.activeElements.clear();
    this.activeWorks.clear();
    this.sortKey = "id";
    this.scrollY = 0;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SavedState>;
      if (typeof saved.searchText === "string") this.searchText = saved.searchText;
      if (typeof saved.sortKey === "string" && SORTS.some((s) => s.key === saved.sortKey))
        this.sortKey = saved.sortKey;
      (saved.elements ?? []).forEach((e) => {
        if (ELEMENTS.includes(e)) this.activeElements.add(e);
      });
      (saved.works ?? []).forEach((w) => {
        if (WORKS.includes(w)) this.activeWorks.add(w);
      });
      if (typeof saved.scrollY === "number" && Number.isFinite(saved.scrollY))
        this.scrollY = saved.scrollY;
    } catch {
      // 忽略损坏/不可用的本地存储，回退到默认状态
    }
  }

  private saveState() {
    const data: SavedState = {
      searchText: this.searchText,
      sortKey: this.sortKey,
      elements: [...this.activeElements],
      works: [...this.activeWorks],
      scrollY: this.scrollY,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 忽略写入失败（如隐私模式）
    }
  }

  private applyStateToUI() {
    if (this.searchInput) this.searchInput.value = this.searchText;
    this.sortButtons.forEach((c, key) =>
      this.refreshChip(c, key === this.sortKey, 0x4fc3f7)
    );
    this.elementChips.forEach((c, e) =>
      this.refreshChip(c, this.activeElements.has(e), ELEMENT_COLORS[e])
    );
    this.workChips.forEach((c, w) =>
      this.refreshChip(c, this.activeWorks.has(w), 0x4fc3f7)
    );
  }

  // ---- 过滤 + 排序 ----
  private getFilteredPals(): Pal[] {
    const q = this.searchText.trim().toLowerCase();
    let list = pals.filter((p) => {
      if (q) {
        const hay = [
          String(p.id),
          p.name.zh,
          p.name.en,
          ...p.elements.map((e) => ELEMENT_LABELS[e]),
          ...p.workSuitability.map((w) => WORK_LABELS[w.type]),
          ...(p.spawnLocations ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (
        this.activeElements.size > 0 &&
        !p.elements.some((e) => this.activeElements.has(e))
      )
        return false;
      if (
        this.activeWorks.size > 0 &&
        !p.workSuitability.some((w) => this.activeWorks.has(w.type))
      )
        return false;
      return true;
    });

    const k = this.sortKey;
    list = [...list].sort((a, b) => {
      switch (k) {
        case "id":
          return a.id - b.id;
        case "name":
          return a.name.zh.localeCompare(b.name.zh, "zh");
        case "rarity":
          return b.rarity - a.rarity;
        case "hp":
          return b.stats.hp - a.stats.hp;
        case "attack":
          return b.stats.attack - a.stats.attack;
      }
    });
    return list;
  }

  // ---- 渲染网格 ----
  private renderGrid() {
    this.grid.removeAll(true);
    const list = this.getFilteredPals();
    this.countText.setText(`共 ${list.length} 只`);
    this.emptyText.setVisible(list.length === 0);

    const width = this.scale.width;
    const totalW = COLS * (CARD_W + GAP) - GAP;
    const startX = (width - totalW) / 2 + CARD_W / 2;

      list.forEach((pal, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const card = this.makeCard(pal);
      card.setPosition(
        startX + col * (CARD_W + GAP),
        GRID_TOP + row * (CARD_H + GAP)
      );
      this.grid.add(card);
    });
    const maxScroll = Math.min(
      0,
      this.scale.height - this.grid.height - GRID_TOP
    );
    this.grid.y = Phaser.Math.Clamp(this.scrollY, maxScroll, 0);
    this.saveState();
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
      .text(width - 16, 22, "被动技能", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#9aa0c0",
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.scene.start("PassiveSkillsScene"));
  }
}
