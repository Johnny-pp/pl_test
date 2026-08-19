import Phaser from "phaser";
import { pals } from "../data/loadPals";
import {
  CRAFT_RECIPES,
  assignWorker,
  craftItem,
  removeWorker,
  simulateProduction,
  upgradeFacility,
  type CraftableItem,
} from "../base/baseSystem";
import { loadGame, saveGame, type BaseJob, type FacilityId, type GameSave } from "../player/playerState";
import { startScene } from "./sceneLoader";
import { recordQuestEvent } from "../quests/questSystem";
import { clampScroll } from "../ui/scroll";

const speciesById = new Map(pals.map((pal) => [pal.id, pal]));
const JOB_LABELS: Record<BaseJob, string> = {
  planting: "种植",
  mining: "采矿",
  lumbering: "伐木",
  generating: "发电",
};
const FACILITY_LABELS: Record<FacilityId, string> = { warehouse: "仓库", farm: "农圃", workshop: "工坊" };
const RESOURCE_LABELS = {
  wood: "木材",
  stone: "石料",
  food: "食物",
  fiber: "纤维",
  crystal: "晶体",
} as const;

export class BaseScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private message = "";

  constructor() {
    super("BaseScene");
  }

  create() {
    this.save = simulateProduction(loadGame(localStorage), speciesById);
    saveGame(localStorage, this.save);
    this.add
      .text(18, 18, "< 返回图鉴", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#4fc3f7",
      })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => void startScene(this, "DexScene"));
    this.add
      .text(450, 28, "远征基地", {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.render();
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.settleProduction() });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const rows = Math.ceil(this.save.ownedPals.length / 2);
      this.content.y = clampScroll(this.content.y, dy, this.scale.height, 300 + rows * 130, 20);
    });
  }

  private render() {
    this.content.removeAll(true);
    const resourceLine = Object.entries(this.save.base.resources)
      .map(([id, amount]) => `${RESOURCE_LABELS[id as keyof typeof RESOURCE_LABELS]} ${amount.toFixed(1)}`)
      .join("  ·  ");
    this.addToContent(
      this.add
        .text(450, 70, resourceLine, {
          fontFamily: "sans-serif",
          fontSize: "15px",
          color: "#d8def8",
        })
        .setOrigin(0.5)
    );
    this.addToContent(
      this.add
        .text(
          450,
          96,
          `捕获器 ${this.save.inventory.captureOrbs} · 治疗剂 ${this.save.inventory.healingTonics}`,
          { fontFamily: "sans-serif", fontSize: "15px", color: "#9ccc65" }
        )
        .setOrigin(0.5)
    );

    (Object.keys(FACILITY_LABELS) as FacilityId[]).forEach((facility, index) => {
      const x = 230 + index * 220;
      this.addToContent(
        this.add
          .text(x, 130, `${FACILITY_LABELS[facility]} Lv.${this.save.base.facilities[facility]}`, {
            fontFamily: "sans-serif",
            fontSize: "17px",
            color: "#ffffff",
          })
          .setOrigin(0.5)
      );
      this.addToContent(this.makeButton(x, 160, 130, "升级设施", () => this.upgrade(facility)));
    });

    this.addToContent(
      this.add.text(62, 205, "制造", { fontFamily: "sans-serif", fontSize: "19px", color: "#ffffff" })
    );
    this.addToContent(
      this.makeButton(230, 218, 230, this.recipeLabel("capture-orb", "捕获器"), () =>
        this.craft("capture-orb")
      )
    );
    this.addToContent(
      this.makeButton(515, 218, 230, this.recipeLabel("healing-tonic", "治疗剂"), () =>
        this.craft("healing-tonic")
      )
    );
    this.addToContent(this.makeButton(760, 218, 120, "立即结算", () => this.settleProduction()));

    const message = this.add
      .text(450, 258, this.message, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffd54f",
      })
      .setOrigin(0.5);
    this.addToContent(message);
    this.addToContent(
      this.add.text(42, 286, "岗位分配（每 5 秒及离线期间自动生产）", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#ffffff",
      })
    );

    if (this.save.ownedPals.length === 0) {
      this.addToContent(
        this.add
          .text(450, 380, "尚无可工作的幻兽，请先探索并捕获。", {
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
      const y = 352 + row * 126;
      const assignment = this.save.base.assignments.find((item) => item.palUid === instance.uid);
      const panel = this.add.rectangle(x, y, 390, 108, 0x16213e).setStrokeStyle(1, 0x0f3460);
      const name = this.add.text(
        x - 180,
        y - 43,
        `${species.name.zh} · ${assignment ? JOB_LABELS[assignment.job] : "休息中"}`,
        {
          fontFamily: "sans-serif",
          fontSize: "17px",
          color: "#ffffff",
        }
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
      const detail = this.add.text(x - 180, y - 17, suitability, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#9aa0c0",
      });
      this.addToContent(panel, name, detail);
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
    this.save = simulateProduction(this.save, speciesById);
    this.persist("生产已结算");
  }

  private persist(message: string) {
    this.message = message;
    saveGame(localStorage, this.save);
    this.render();
  }

  private makeButton(x: number, y: number, width: number, label: string, action: () => void) {
    const bg = this.add.rectangle(x, y, width, 32, 0x0f4660).setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    bg.on("pointerdown", action);
    return this.add.container(0, 0, [bg, text]);
  }

  private addToContent(...objects: Phaser.GameObjects.GameObject[]) {
    this.content.add(objects);
  }
}
