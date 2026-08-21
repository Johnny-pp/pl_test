import Phaser from "phaser";
import { addSceneTitle, installSceneTheme } from "../ui/theme";
import { pals } from "../data/loadPals";
import {
  CRAFT_RECIPES,
  assignWorker,
  craftItem,
  getFacilityLevel,
  removeWorker,
  simulateProduction,
  upgradeFacility,
  type CraftableItem,
} from "../base/baseSystem";
import { activeSkillsById } from "../data/loadActiveSkills";
import { passiveSkillsById } from "../data/loadPassiveSkills";
import { equipmentDefinitionsById } from "../data/loadEquipment";
import { loadGame, saveGame, type BaseJob, type FacilityId, type GameSave } from "../player/playerState";
import { startScene } from "./sceneLoader";
import { recordQuestEvent } from "../quests/questSystem";
import { clampScroll } from "../ui/scroll";
import { createBackButton, createTextButton } from "../ui/button";
import {
  FACILITY_DEFS,
  GRID_COLS,
  GRID_ROWS,
  getAdjacentFacilityPairs,
  getPlacedFacility,
  moveFacility,
  placeFacility,
  removeFacility,
} from "../base/baseLayout";
import { TECH_TREE, canUnlockTech, isTechUnlocked, unlockTech } from "../base/techTree";
import {
  assembleAdvancedOrb,
  assembleEquipment,
  canAssembleEquipment,
  canAssembleOrb,
  canSmelt,
  smeltMetal,
} from "../base/processing";
import { BASE_ORDERS, canCompleteOrder, completeOrder } from "../base/baseOrders";

const speciesById = new Map(pals.map((pal) => [pal.id, pal]));
const JOB_LABELS: Record<BaseJob, string> = {
  planting: "种植",
  mining: "采矿",
  lumbering: "伐木",
  generating: "发电",
};
const FACILITY_LABELS: Record<FacilityId, string> = {
  warehouse: "仓库",
  farm: "农圃",
  workshop: "工坊",
  forge: "熔炉",
  assembly: "装配台",
};
const RESOURCE_LABELS = {
  wood: "木材",
  stone: "石料",
  food: "食物",
  fiber: "纤维",
  crystal: "晶体",
  ore: "矿石",
  metal: "金属锭",
} as const;

type BaseTab = "production" | "layout" | "tech" | "processing" | "orders";

const TAB_LABELS: { key: BaseTab; label: string }[] = [
  { key: "production", label: "生产" },
  { key: "layout", label: "布局" },
  { key: "tech", label: "科技" },
  { key: "processing", label: "加工" },
  { key: "orders", label: "订单" },
];

const CELL = 66;
const GRID_ORIGIN_X = 240;
const GRID_ORIGIN_Y = 150;

export class BaseScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private message = "";
  private tab: BaseTab = "production";
  private selectedPalette?: FacilityId;
  private selectedPlaced?: FacilityId;
  private scrollY = 0;

  constructor() {
    super("BaseScene");
  }

  create() {
    installSceneTheme(this);
    this.save = simulateProduction(loadGame(localStorage), speciesById, Date.now(), {
      activeSkills: activeSkillsById,
      passiveSkills: passiveSkillsById,
      equipment: equipmentDefinitionsById,
    });
    saveGame(localStorage, this.save);
    createBackButton(this, "返回图鉴", () => void startScene(this, "DexScene"));
    addSceneTitle(this, "远征基地");
    this.makeTabs();
    this.content = this.add.container(0, 0);
    this.render();
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.settleProduction() });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const maxScroll = Math.max(0, this.content.height - 500);
      this.scrollY = clampScroll(this.scrollY, dy, this.scale.height, maxScroll, 20);
      this.content.y = this.scrollY;
    });
  }

  private makeTabs() {
    let x = 90;
    for (const tab of TAB_LABELS) {
      createTextButton(this, {
        x,
        y: 68,
        width: 92,
        height: 30,
        label: tab.label,
        variant: this.tab === tab.key ? "accent" : "muted",
        fontSize: "14px",
        onPress: () => {
          this.tab = tab.key;
          this.scrollY = 0;
          this.selectedPalette = undefined;
          this.selectedPlaced = undefined;
          this.render();
        },
      });
      x += 106;
    }
  }

  private render() {
    this.content.removeAll(true);
    this.content.y = this.scrollY;
    this.makeTabs();
    const resourceLine = Object.entries(this.save.base.resources)
      .map(([id, amount]) => `${RESOURCE_LABELS[id as keyof typeof RESOURCE_LABELS]} ${amount.toFixed(1)}`)
      .join("  ·  ");
    this.addToContent(
      this.add
        .text(450, 104, resourceLine, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#d8def8",
        })
        .setOrigin(0.5)
    );
    this.addToContent(
      this.add
        .text(
          450,
          122,
          `捕获器 ${this.save.inventory.captureOrbs} · 高级捕获器 ${this.save.inventory.advancedCaptureOrbs} · 治疗剂 ${this.save.inventory.healingTonics} · 装备 ${this.save.inventory.equipment.length} 件`,
          { fontFamily: "sans-serif", fontSize: "14px", color: "#9ccc65" }
        )
        .setOrigin(0.5)
    );
    if (this.message) {
      this.addToContent(
        this.add
          .text(450, 140, this.message, { fontFamily: "sans-serif", fontSize: "14px", color: "#ffd54f" })
          .setOrigin(0.5)
      );
    }
    if (this.tab === "production") this.renderProduction();
    else if (this.tab === "layout") this.renderLayout();
    else if (this.tab === "tech") this.renderTech();
    else if (this.tab === "processing") this.renderProcessing();
    else this.renderOrders();
  }

  private renderProduction() {
    const startY = 160;
    (Object.keys(FACILITY_LABELS) as FacilityId[]).forEach((facility, index) => {
      const x = 230 + index * 130;
      this.addToContent(
        this.add
          .text(x, startY, `${FACILITY_LABELS[facility]} Lv.${getFacilityLevel(this.save, facility)}`, {
            fontFamily: "sans-serif",
            fontSize: "15px",
            color: "#ffffff",
          })
          .setOrigin(0.5)
      );
    });
    this.addToContent(
      this.add.text(62, startY + 34, "制造", { fontFamily: "sans-serif", fontSize: "18px", color: "#ffffff" })
    );
    this.addToContent(
      this.makeButton(230, startY + 48, 230, this.recipeLabel("capture-orb", "捕获器"), () =>
        this.craft("capture-orb")
      )
    );
    this.addToContent(
      this.makeButton(515, startY + 48, 230, this.recipeLabel("healing-tonic", "治疗剂"), () =>
        this.craft("healing-tonic")
      )
    );
    this.addToContent(this.makeButton(760, startY + 48, 110, "立即结算", () => this.settleProduction()));
    this.addToContent(
      this.add.text(42, startY + 96, "岗位分配（每 5 秒及离线期间自动生产）", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#ffffff",
      })
    );
    if (this.save.ownedPals.length === 0) {
      this.addToContent(
        this.add
          .text(450, startY + 190, "尚无可工作的幻兽，请先探索并捕获。", {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: "#9aa0c0",
          })
          .setOrigin(0.5)
      );
      return;
    }
    this.save.ownedPals.forEach((instance, index) => {
      const species = speciesById.get(instance.speciesId);
      if (!species) return;
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 245 + col * 420;
      const y = startY + 180 + row * 126;
      const assignment = this.save.base.assignments.find((item) => item.palUid === instance.uid);
      this.addToContent(this.add.rectangle(x, y, 390, 108, 0x16213e).setStrokeStyle(1, 0x0f3460));
      this.addToContent(
        this.add.text(
          x - 180,
          y - 43,
          `${species.name.zh} · ${assignment ? JOB_LABELS[assignment.job] : "休息中"}`,
          { fontFamily: "sans-serif", fontSize: "17px", color: "#ffffff" }
        )
      );
      const suitability =
        species.workSuitability
          .filter((work) =>
            ["planting", "mining", "lumbering", "generating", "electricity"].includes(work.type)
          )
          .map(
            (work) =>
              `${work.type === "electricity" ? "发电" : JOB_LABELS[work.type as BaseJob]} Lv.${work.level}`
          )
          .join(" · ") || "无基地岗位适性";
      this.addToContent(
        this.add.text(x - 180, y - 17, suitability, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#9aa0c0",
        })
      );
      const jobs = this.availableJobs(species);
      jobs.forEach((job, jobIndex) => {
        this.addToContent(
          this.makeButton(x - 135 + jobIndex * 88, y + 27, 80, JOB_LABELS[job], () =>
            this.assign(instance.uid, job)
          )
        );
      });
      if (assignment)
        this.addToContent(this.makeButton(x + 135, y + 27, 80, "休息", () => this.unassign(instance.uid)));
    });
  }

  private renderLayout() {
    this.addToContent(
      this.add.text(62, GRID_ORIGIN_Y - 28, "基地布局（点击网格单元格）", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#ffffff",
      })
    );
    this.drawGrid();
    this.drawPlacedFacilities();
    const pairs = getAdjacentFacilityPairs(this.save);
    this.addToContent(
      this.add.text(
        62,
        GRID_ORIGIN_Y + GRID_ROWS * CELL + 14,
        pairs.length > 0
          ? `邻接加成：${pairs.map(([a, b]) => `${FACILITY_LABELS[a]}·${FACILITY_LABELS[b]}`).join("、")}`
          : "邻接加成：无（相邻设施获得加成）",
        { fontFamily: "sans-serif", fontSize: "13px", color: "#9ccc65" }
      )
    );
    const paletteY = GRID_ORIGIN_Y + GRID_ROWS * CELL + 44;
    this.addToContent(
      this.add.text(62, paletteY - 20, "可放置设施", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#ffffff",
      })
    );
    let px = 62;
    for (const facilityId of ["forge", "assembly"] as FacilityId[]) {
      const def = FACILITY_DEFS[facilityId];
      const unlocked = !def.requiredTech || isTechUnlocked(this.save, def.requiredTech);
      const placed = Boolean(getPlacedFacility(this.save, facilityId));
      this.addToContent(
        this.makeButton(px, paletteY, 120, `${def.label}${placed ? "（已放）" : ""}`, () => {
          if (!unlocked) return this.setMessage(def.requiredTech ? "需先解锁对应科技" : "不可放置");
          if (placed) return this.setMessage("该设施已放置在网格上");
          this.selectedPalette = facilityId;
          this.setMessage(`已选择 ${def.label}，点击网格放置`);
        })
      );
      px += 134;
    }
    this.addToContent(
      this.add.text(62, paletteY + 26, "点击已放置设施可升级或移除。", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#9aa0c0",
      })
    );
  }

  private drawGrid() {
    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLS; x += 1) {
        const rect = this.add
          .rectangle(
            GRID_ORIGIN_X + x * CELL + CELL / 2,
            GRID_ORIGIN_Y + y * CELL + CELL / 2,
            CELL - 2,
            CELL - 2,
            0x16213e,
            0.4
          )
          .setStrokeStyle(1, 0x303a58)
          .setInteractive({ useHandCursor: true });
        rect.on("pointerdown", () => this.handleCellClick(x, y));
        this.addToContent(rect);
      }
    }
  }

  private drawPlacedFacilities() {
    for (const entry of this.save.base.placedFacilities) {
      const def = FACILITY_DEFS[entry.facilityId];
      const w = def.width * CELL - 4;
      const h = def.height * CELL - 4;
      const x = GRID_ORIGIN_X + entry.gridX * CELL + 2;
      const y = GRID_ORIGIN_Y + entry.gridY * CELL + 2;
      const selected = this.selectedPlaced === entry.facilityId;
      const rect = this.add
        .rectangle(x + w / 2, y + h / 2, w, h, selected ? 0x0f4660 : 0x244b52, 0.9)
        .setStrokeStyle(selected ? 4 : 2, selected ? 0xffd54f : 0x4fc3f7)
        .setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => {
        this.selectedPlaced = entry.facilityId;
        this.selectedPalette = undefined;
        this.render();
      });
      this.addToContent(rect);
      this.addToContent(
        this.add
          .text(x + w / 2, y + h / 2, `${def.label} Lv.${entry.level}`, {
            fontFamily: "sans-serif",
            fontSize: "13px",
            color: "#ffffff",
            align: "center",
            wordWrap: { width: w - 6 },
          })
          .setOrigin(0.5)
      );
      if (selected) {
        this.addToContent(
          this.makeButton(x + w + 4, y + h / 2 - 12, 96, "升级", () => this.upgrade(entry.facilityId))
        );
        this.addToContent(
          this.makeButton(x + w + 4, y + h / 2 + 20, 96, "移除", () => {
            this.save = removeFacility(this.save, entry.facilityId);
            this.selectedPlaced = undefined;
            this.persist("设施已移除");
          })
        );
        this.addToContent(
          this.add.text(x + w + 4, y + h / 2 + 52, "点击目标单元格\n可移动", {
            fontFamily: "sans-serif",
            fontSize: "11px",
            color: "#9aa0c0",
            align: "left",
          })
        );
      }
    }
  }

  private handleCellClick(x: number, y: number) {
    if (this.selectedPalette) {
      const result = placeFacility(this.save, this.selectedPalette, x, y);
      if (!result.ok) return this.setMessage(result.reason ?? "无法放置");
      this.save = result.save;
      this.selectedPalette = undefined;
      return this.persist("设施已放置");
    }
    if (this.selectedPlaced) {
      const result = moveFacility(this.save, this.selectedPlaced, x, y);
      if (!result.ok) return this.setMessage(result.reason ?? "无法移动");
      this.save = result.save;
      this.selectedPlaced = undefined;
      return this.persist("设施已移动");
    }
    this.setMessage("请先在右侧选择设施，或点击已放置设施");
  }

  private renderTech() {
    this.addToContent(
      this.add.text(62, 160, "科技树（消耗资源解锁）", {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: "#ffffff",
      })
    );
    TECH_TREE.forEach((tech, index) => {
      const y = 200 + index * 76;
      const unlocked = isTechUnlocked(this.save, tech.id);
      const can = canUnlockTech(this.save, tech);
      this.addToContent(
        this.add
          .rectangle(450, y, 760, 64, 0x16213e)
          .setStrokeStyle(2, unlocked ? 0x9ccc65 : can ? 0x4fc3f7 : 0x303a58)
      );
      const costLabel = Object.entries(tech.cost)
        .map(([id, amount]) => `${RESOURCE_LABELS[id as keyof typeof RESOURCE_LABELS]}${amount}`)
        .join(" ");
      this.addToContent(
        this.add.text(90, y - 20, `${tech.name}${unlocked ? " ✓" : ""}`, {
          fontFamily: "sans-serif",
          fontSize: "17px",
          color: unlocked ? "#9ccc65" : "#ffffff",
        })
      );
      this.addToContent(
        this.add.text(90, y + 6, `${tech.description} · 消耗 ${costLabel}`, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#9aa0c0",
          wordWrap: { width: 560 },
        })
      );
      if (!unlocked) {
        this.addToContent(
          this.makeButton(745, y, 120, can ? "解锁" : "条件不足", () => {
            if (!can) return this.setMessage("前置科技、地区或设施等级不足");
            this.save = unlockTech(this.save, tech.id);
            this.persist(`已解锁科技：${tech.name}`);
          })
        );
      }
    });
  }

  private renderProcessing() {
    this.addToContent(
      this.add.text(62, 160, "加工链：矿石 → 金属锭 → 装备/高级捕获器", {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: "#ffffff",
      })
    );
    const forgeUnlocked = isTechUnlocked(this.save, "tech-smelting");
    const forgeLv = getFacilityLevel(this.save, "forge");
    this.addToContent(
      this.add.rectangle(450, 230, 760, 96, 0x16213e).setStrokeStyle(2, forgeLv > 0 ? 0x4fc3f7 : 0x303a58)
    );
    this.addToContent(
      this.add.text(90, 206, `熔炉${forgeLv > 0 ? ` Lv.${forgeLv}` : ""}`, {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: "#ffffff",
      })
    );
    this.addToContent(
      this.add.text(90, 234, `把石料、矿石与晶体熔炼为金属锭（需“冶炼”科技并放置熔炉）`, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#9aa0c0",
      })
    );
    this.addToContent(
      this.makeButton(700, 230, 160, forgeUnlocked && forgeLv > 0 ? "熔炼金属" : "未解锁", () => {
        if (!forgeUnlocked) return this.setMessage("需先在科技页解锁“冶炼”并放置熔炉");
        if (forgeLv <= 0) return this.setMessage("需先放置熔炉");
        if (!canSmelt(this.save)) return this.setMessage("石料/矿石/晶体不足");
        this.save = smeltMetal(this.save);
        this.persist("熔炼完成，获得金属锭");
      })
    );

    const assemblyUnlocked = isTechUnlocked(this.save, "tech-assembly");
    const assemblyLv = getFacilityLevel(this.save, "assembly");
    this.addToContent(
      this.add.rectangle(450, 360, 760, 120, 0x16213e).setStrokeStyle(2, assemblyLv > 0 ? 0x4fc3f7 : 0x303a58)
    );
    this.addToContent(
      this.add.text(90, 336, `装配台${assemblyLv > 0 ? ` Lv.${assemblyLv}` : ""}`, {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: "#ffffff",
      })
    );
    this.addToContent(
      this.add.text(90, 364, `用金属锭制造高级捕获器与强化锻纹甲（需“装配”科技并放置装配台）`, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#9aa0c0",
      })
    );
    this.addToContent(
      this.makeButton(650, 360, 170, assemblyUnlocked && assemblyLv > 0 ? "高级捕获器" : "未解锁", () => {
        if (!assemblyUnlocked) return this.setMessage("需先在科技页解锁“装配”并放置装配台");
        if (assemblyLv <= 0) return this.setMessage("需先放置装配台");
        if (!canAssembleOrb(this.save)) return this.setMessage("金属锭或晶体不足");
        this.save = assembleAdvancedOrb(this.save);
        this.persist("制造完成，获得高级捕获器");
      })
    );
    this.addToContent(
      this.makeButton(650, 400, 170, assemblyUnlocked && assemblyLv > 0 ? "强化锻纹甲" : "未解锁", () => {
        if (!assemblyUnlocked) return this.setMessage("需先在科技页解锁“装配”并放置装配台");
        if (assemblyLv <= 0) return this.setMessage("需先放置装配台");
        if (!canAssembleEquipment(this.save)) return this.setMessage("金属锭或纤维不足");
        this.save = assembleEquipment(this.save);
        this.persist("制造完成，获得强化锻纹甲");
      })
    );
  }

  private renderOrders() {
    this.addToContent(
      this.add.text(62, 160, "基地订单（可重复完成的资源消耗目标）", {
        fontFamily: "sans-serif",
        fontSize: "17px",
        color: "#ffffff",
      })
    );
    BASE_ORDERS.forEach((order, index) => {
      const y = 210 + index * 72;
      const can = canCompleteOrder(this.save, order);
      const costLabel = Object.entries(order.cost)
        .map(([id, amount]) => `${RESOURCE_LABELS[id as keyof typeof RESOURCE_LABELS]}${amount}`)
        .join(" ");
      this.addToContent(
        this.add.rectangle(450, y, 760, 60, 0x16213e).setStrokeStyle(2, can ? 0x4fc3f7 : 0x303a58)
      );
      this.addToContent(
        this.add.text(90, y - 18, order.title, {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#ffffff",
        })
      );
      this.addToContent(
        this.add.text(90, y + 8, `${order.description} 消耗 ${costLabel} → ${order.rewardLabel}`, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#9aa0c0",
          wordWrap: { width: 540 },
        })
      );
      this.addToContent(
        this.makeButton(700, y, 130, can ? "完成" : "资源不足", () => {
          if (!can) return this.setMessage("资源不足，无法完成订单");
          this.save = completeOrder(this.save, order.id);
          this.persist(`已完成订单：${order.title}`);
        })
      );
    });
  }

  private availableJobs(species: (typeof pals)[number]): BaseJob[] {
    const jobs = new Set<BaseJob>();
    for (const work of species.workSuitability) {
      if (work.type === "electricity" || work.type === "generating") jobs.add("generating");
      if (work.type === "planting" || work.type === "mining" || work.type === "lumbering")
        jobs.add(work.type);
    }
    return [...jobs];
  }

  private recipeLabel(item: CraftableItem, name: string) {
    const cost = Object.entries(CRAFT_RECIPES[item])
      .map(([id, amount]) => `${RESOURCE_LABELS[id as keyof typeof RESOURCE_LABELS]}${amount}`)
      .join(" ");
    return `${name} · ${cost}`;
  }

  private assign(uid: string, job: BaseJob) {
    this.save = assignWorker(this.save, uid, job, speciesById);
    this.persist("岗位已更新");
  }

  private unassign(uid: string) {
    this.save = removeWorker(this.save, uid);
    this.persist("幻兽已进入休息状态");
  }

  private craft(item: CraftableItem) {
    const next = craftItem(this.save, item);
    if (next === this.save) return this.persist("资源不足，无法制造");
    this.save = recordQuestEvent(next, { type: "craft" });
    this.persist("制造完成");
  }

  private upgrade(facility: FacilityId) {
    const next = upgradeFacility(this.save, facility);
    if (next === this.save) return this.persist("资源不足或设施已满级");
    this.save = next;
    this.persist(`${FACILITY_LABELS[facility]}升级完成`);
  }

  private settleProduction() {
    this.save = simulateProduction(this.save, speciesById, Date.now(), {
      activeSkills: activeSkillsById,
      passiveSkills: passiveSkillsById,
      equipment: equipmentDefinitionsById,
    });
    if (this.tab === "production") this.render();
  }

  private setMessage(message: string) {
    this.message = message;
    this.render();
  }

  private persist(message: string) {
    this.message = message;
    saveGame(localStorage, this.save);
    this.render();
  }

  private makeButton(x: number, y: number, width: number, label: string, action: () => void) {
    return createTextButton(this, { x, y, width, height: 30, label, onPress: action, fontSize: "12px" });
  }

  private addToContent(...objects: Phaser.GameObjects.GameObject[]) {
    this.content.add(objects);
  }

  // ---- 浏览器测试钩子 ----
  doUnlockTech(techId: string) {
    this.save = unlockTech(this.save, techId);
    this.persist(`已解锁科技：${techId}`);
  }

  doPlaceFacility(facilityId: FacilityId, x: number, y: number) {
    const result = placeFacility(this.save, facilityId, x, y);
    if (result.ok) {
      this.save = result.save;
      this.persist("设施已放置");
    }
  }

  doSmelt() {
    this.save = smeltMetal(this.save);
    this.persist("熔炼完成");
  }

  doAssembleOrb() {
    this.save = assembleAdvancedOrb(this.save);
    this.persist("制造完成");
  }

  doCompleteOrder(orderId: string) {
    this.save = completeOrder(this.save, orderId);
    this.persist("订单完成");
  }
}
