import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { ELEMENT_COLORS, ELEMENT_LABELS, WORK_LABELS } from "../types/elements";
import type { ElementType, WorkType, Pal } from "../types/pal";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";
import { startScene } from "./sceneLoader";
import { filterAndSortPals, paginate, type DexSortKey } from "../dex/dexFilters";
import { clampScroll, getMinScroll } from "../ui/scroll";
import { preloadUiAssets, UI_ASSETS } from "../ui/assets";
import { createTextButton } from "../ui/button";
import { addSceneTitle, installSceneTheme } from "../ui/theme";
import { renderOnboardingBanner } from "../ui/onboardingBanner";

const CARD_W = 200;
const CARD_H = 96;
const GAP = 16;
const COLS = 4;
const PAGE_SIZE = 24;

const ELEMENTS = Object.keys(ELEMENT_LABELS) as ElementType[];
const WORKS = Object.keys(WORK_LABELS) as WorkType[];

interface SortOpt {
  key: DexSortKey;
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

const GRID_TOP = 250;
const STORAGE_KEY = "pl_test_filter_state";

interface SavedState {
  searchText: string;
  sortKey: SortOpt["key"];
  elements: ElementType[];
  works: WorkType[];
  scrollY: number;
  page: number;
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
  private page = 0;
  private pageText!: Phaser.GameObjects.Text;
  private previousPage!: Phaser.GameObjects.Text;
  private nextPage!: Phaser.GameObjects.Text;

  private elementChips = new Map<ElementType, Chip>();
  private workChips = new Map<WorkType, Chip>();
  private sortButtons = new Map<SortOpt["key"], Chip>();

  constructor() {
    super("DexScene");
  }

  preload() {
    preloadPalPortraits(this);
    preloadUiAssets(this);
  }

  create() {
    installSceneTheme(this);
    const width = this.scale.width;
    this.loadState();
    this.elementChips.clear();
    this.workChips.clear();
    this.sortButtons.clear();

    addSceneTitle(this, "幻兽图鉴");

    this.makePassiveButton(width);
    this.makeBattleButton();
    this.makeTeamButton();
    this.makeWorldButton();
    this.makeBaseButton();
    this.makeBreedingButton();
    this.makeQuestButton();
    this.makeSettingsButton();

    this.buildSearchInput();
    this.buildSortButtons();
    this.buildChips(width);
    this.buildClearButton(width);

    this.applyStateToUI();

    renderOnboardingBanner(this);

    this.countText = this.add
      .text(280, 108, "", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#9aa0c0",
      })
      .setOrigin(0, 0.5);
    this.pageText = this.add
      .text(342, 108, "", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#68718e",
      })
      .setOrigin(0, 0.5);
    this.previousPage = this.add
      .text(385, 108, "‹", {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: "#4fc3f7",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.previousPage.on("pointerdown", () => this.changePage(-1));
    this.nextPage = this.add
      .text(405, 108, "›", {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: "#4fc3f7",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.nextPage.on("pointerdown", () => this.changePage(1));

    this.emptyText = this.add
      .text(width / 2, GRID_TOP + 80, "未找到匹配的幻兽", {
        fontFamily: "sans-serif",
        fontSize: "22px",
        color: "#9aa0c0",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.grid = this.add.container(0, 0);
    this.renderGrid();

    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = clampScroll(this.grid.y, dy, this.scale.height, this.grid.height, GRID_TOP);
      this.grid.y = this.scrollY;
      this.saveState();
    });
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
      color: "#17334d",
      backgroundColor: "#fffbeb",
      border: "2px solid #71b5aa",
      borderRadius: "10px",
      boxShadow: "0 3px 0 rgba(23, 143, 145, .22)",
      outline: "none",
      fontFamily: '"Trebuchet MS", "Microsoft YaHei", sans-serif',
      pointerEvents: "auto",
    });
    this.add.dom(16, 108, input).setOrigin(0, 0.5);
    input.addEventListener("input", () => {
      this.searchText = input.value;
      this.page = 0;
      this.renderGrid();
    });
    this.searchInput = input;
  }

  // ---- 排序按钮 ----
  private buildSortButtons() {
    const startX = 420;
    const y = 108;
    const w = 60;
    const gap = 6;
    let x = startX;
    SORTS.forEach((s) => {
      const chip = this.makeChip(x, y, w, 28, s.label, () => {
        this.sortKey = s.key;
        this.page = 0;
        this.sortButtons.forEach((c, key) => this.refreshChip(c, key === s.key, 0x4fc3f7));
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
      const chip = this.makeChip(ex, 150, 64, 28, ELEMENT_LABELS[e], () => {
        if (this.activeElements.has(e)) this.activeElements.delete(e);
        else this.activeElements.add(e);
        this.page = 0;
        this.refreshChip(this.elementChips.get(e)!, this.activeElements.has(e), ELEMENT_COLORS[e]);
        this.renderGrid();
      });
      this.elementChips.set(e, chip);
      ex += 70;
    });

    const wTotal = WORKS.length * (54 + 6) - 6;
    let wx = (width - wTotal) / 2 + 27;
    WORKS.forEach((w) => {
      const chip = this.makeChip(wx, 184, 54, 26, WORK_LABELS[w], () => {
        if (this.activeWorks.has(w)) this.activeWorks.delete(w);
        else this.activeWorks.add(w);
        this.page = 0;
        this.refreshChip(this.workChips.get(w)!, this.activeWorks.has(w), 0x4fc3f7);
        this.renderGrid();
      });
      this.workChips.set(w, chip);
      wx += 60;
    });
  }

  private buildClearButton(width: number) {
    const compare = this.add
      .text(width - 126, 108, "属性对比", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#80deea",
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    compare.on("pointerdown", () => void startScene(this, "CompareScene"));
    const btn = this.add
      .text(width - 16, 108, "清除", {
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
    this.page = 0;
    this.sortButtons.forEach((c, key) => this.refreshChip(c, key === "id", 0x4fc3f7));
    this.renderGrid();
  }

  private makeChip(x: number, y: number, w: number, h: number, label: string, onClick: () => void): Chip {
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
    this.page = 0;
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
      if (typeof saved.scrollY === "number" && Number.isFinite(saved.scrollY)) this.scrollY = saved.scrollY;
      if (typeof saved.page === "number" && Number.isInteger(saved.page) && saved.page >= 0)
        this.page = saved.page;
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
      page: this.page,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 忽略写入失败（如隐私模式）
    }
  }

  private applyStateToUI() {
    if (this.searchInput) this.searchInput.value = this.searchText;
    this.sortButtons.forEach((c, key) => this.refreshChip(c, key === this.sortKey, 0x4fc3f7));
    this.elementChips.forEach((c, e) => this.refreshChip(c, this.activeElements.has(e), ELEMENT_COLORS[e]));
    this.workChips.forEach((c, w) => this.refreshChip(c, this.activeWorks.has(w), 0x4fc3f7));
  }

  // ---- 过滤 + 排序 ----
  private getFilteredPals(): Pal[] {
    return filterAndSortPals(pals, {
      searchText: this.searchText,
      elements: this.activeElements,
      works: this.activeWorks,
      sortKey: this.sortKey,
    });
  }

  // ---- 渲染网格 ----
  private renderGrid() {
    this.grid.removeAll(true);
    const list = this.getFilteredPals();
    this.countText.setText(`共 ${list.length} 只`);
    this.emptyText.setVisible(list.length === 0);
    const pageResult = paginate(list, this.page, PAGE_SIZE);
    const pageCount = pageResult.pageCount;
    this.page = pageResult.page;
    const pageItems = pageResult.items;
    this.pageText.setText(`${this.page + 1}/${pageCount}`);
    this.previousPage.setAlpha(this.page > 0 ? 1 : 0.25);
    this.nextPage.setAlpha(this.page < pageCount - 1 ? 1 : 0.25);

    const width = this.scale.width;
    const totalW = COLS * (CARD_W + GAP) - GAP;
    const startX = (width - totalW) / 2 + CARD_W / 2;

    pageItems.forEach((pal, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const card = this.makeCard(pal);
      card.setPosition(startX + col * (CARD_W + GAP), GRID_TOP + row * (CARD_H + GAP));
      this.grid.add(card);
    });
    const maxScroll = getMinScroll(this.scale.height, this.grid.height, GRID_TOP);
    this.grid.y = Phaser.Math.Clamp(this.scrollY, maxScroll, 0);
    this.saveState();
  }

  private changePage(delta: number) {
    const pageCount = Math.max(1, Math.ceil(this.getFilteredPals().length / PAGE_SIZE));
    const next = Phaser.Math.Clamp(this.page + delta, 0, pageCount - 1);
    if (next === this.page) return;
    this.page = next;
    this.scrollY = 0;
    this.renderGrid();
  }

  private makeCard(pal: Pal): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const bg = this.textures.exists(UI_ASSETS.panel)
      ? this.add.image(0, 0, UI_ASSETS.panel).setDisplaySize(CARD_W, CARD_H)
      : this.add.rectangle(0, 0, CARD_W, CARD_H, 0x16213e).setStrokeStyle(2, 0x0f3460);
    const elem = pal.elements[0] ?? "neutral";
    const portrait = addPalPortrait(this, pal.id, -CARD_W / 2 + 42, 0, 76);
    const idText = this.add.text(-CARD_W / 2 + 82, -CARD_H / 2 + 10, `#${pal.id}`, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#8a8aa0",
    });
    const nameText = this.add.text(-CARD_W / 2 + 82, -CARD_H / 2 + 30, pal.name.zh, {
      fontFamily: "sans-serif",
      fontSize: "20px",
      color: "#ffffff",
    });
    const enText = this.add.text(-CARD_W / 2 + 82, CARD_H / 2 - 24, pal.name.en, {
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
    c.add([bg, portrait, idText, nameText, enText, elemText]);

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.035, duration: 90 }));
    bg.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 90 }));
    bg.on("pointerdown", () => void startScene(this, "DetailScene", { palId: pal.id }));
    return c;
  }

  private makePassiveButton(width: number) {
    this.makeNavButton(width - 70, "被动", "PassiveSkillsScene");
  }

  private makeBattleButton() {
    this.makeNavButton(70, "战斗", "SelectPalScene", "accent");
  }

  private makeTeamButton() {
    this.makeNavButton(190, "队伍", "TeamScene");
  }

  private makeWorldButton() {
    this.makeNavButton(310, "探索", "WorldScene");
  }

  private makeBaseButton() {
    this.makeNavButton(590, "基地", "BaseScene");
  }

  private makeBreedingButton() {
    this.makeNavButton(710, "孵化", "BreedingScene");
  }

  private makeQuestButton() {
    this.makeNavButton(830, "任务", "QuestScene");
  }

  private makeSettingsButton() {
    this.makeNavButton(430, "设置", "SettingsScene");
  }

  private makeNavButton(
    x: number,
    label: string,
    sceneKey: string,
    variant: "primary" | "accent" = "primary"
  ) {
    return createTextButton(this, {
      x,
      y: 68,
      width: 102,
      height: 32,
      label,
      variant,
      fontSize: "14px",
      onPress: () => void startScene(this, sceneKey),
    });
  }
}
