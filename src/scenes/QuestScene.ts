import Phaser from "phaser";
import { loadGame, saveGame, type GameSave } from "../player/playerState";
import { claimQuestReward, getQuestViews, type QuestView } from "../quests/questSystem";
import { claimSideQuestReward, getSideQuestViews, type SideQuestView } from "../quests/sideQuests";
import { startScene } from "./sceneLoader";
import { createBackButton, createTextButton } from "../ui/button";
import { addSceneTitle, installSceneTheme } from "../ui/theme";

const STATUS_LABELS = {
  locked: "未激活",
  active: "进行中",
  complete: "可领取",
  claimed: "已完成",
} as const;

export class QuestScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private message = "";
  private showSide = false;
  private scrollY = 0;

  constructor() {
    super("QuestScene");
  }

  create() {
    installSceneTheme(this);
    this.scrollY = 0;
    this.showSide = false;
    this.save = loadGame(localStorage);
    createBackButton(this, "返回图鉴", () => void startScene(this, "DexScene"));
    addSceneTitle(this, "远征任务");
    createTextButton(this, {
      x: 815,
      y: 68,
      width: 134,
      height: 32,
      label: "切换：主线/支线",
      variant: "muted",
      fontSize: "13px",
      onPress: () => {
        this.showSide = !this.showSide;
        this.scrollY = 0;
        this.render();
      },
    });
    createTextButton(this, {
      x: 205,
      y: 68,
      width: 120,
      height: 32,
      label: "终局试炼",
      variant: "accent",
      fontSize: "13px",
      onPress: () => void startScene(this, "EndgameScene"),
    });
    this.content = this.add.container(0, 0);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, -Math.max(0, this.content.height - 560), 0);
      this.content.y = this.scrollY;
    });
    this.render();
  }

  private render() {
    this.content.removeAll(true);
    this.content.y = this.scrollY;
    const views = this.showSide ? getSideQuestViews(this.save) : getQuestViews(this.save);
    const next = views.find((view) => view.status === "active" || view.status === "complete");
    this.content.add(
      this.add
        .text(
          450,
          72,
          this.showSide
            ? next
              ? `下一支线：${next.definition.title}`
              : "当前没有可进行的支线"
            : next
              ? `下一目标：${next.definition.title}`
              : "当前任务链已经完成",
          { fontFamily: "sans-serif", fontSize: "16px", color: "#80deea" }
        )
        .setOrigin(0.5)
    );
    if (this.message) {
      this.content.add(
        this.add
          .text(450, 100, this.message, {
            fontFamily: "sans-serif",
            fontSize: "14px",
            color: "#9ccc65",
          })
          .setOrigin(0.5)
      );
    }
    if (this.showSide) {
      this.content.add(
        this.add
          .text(90, 130, "支线任务（第三地区）", {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: "#ffe082",
          })
          .setOrigin(0, 0.5)
      );
      const sideViews = views as SideQuestView[];
      sideViews.forEach((view, index) => this.makeSideQuestCard(view, 168 + index * 104));
    } else {
      const mainViews = views as QuestView[];
      mainViews.forEach((view, index) => this.makeQuestCard(view, 150 + index * 158));
    }
  }

  private makeQuestCard(view: QuestView, y: number) {
    const active = view.status === "active" || view.status === "complete";
    const panel = this.add
      .rectangle(450, y, 760, 132, active ? 0x18284a : 0x151b2e)
      .setStrokeStyle(2, view.status === "complete" ? 0xffd54f : active ? 0x4fc3f7 : 0x303a58);
    const title = this.add.text(90, y - 48, view.definition.title, {
      fontFamily: "sans-serif",
      fontSize: "20px",
      color: view.status === "locked" ? "#747b91" : "#ffffff",
    });
    const status = this.add
      .text(810, y - 46, STATUS_LABELS[view.status], {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: view.status === "complete" ? "#ffd54f" : view.status === "claimed" ? "#9ccc65" : "#9aa0c0",
      })
      .setOrigin(1, 0);
    const description = this.add.text(90, y - 18, view.definition.description, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#9aa0c0",
    });
    const goalText = view.definition.goals
      .map(
        (goal) => `${goal.label} ${Math.min(goal.target, view.state.progress[goal.id] ?? 0)}/${goal.target}`
      )
      .join("   ·   ");
    const goals = this.add.text(90, y + 14, goalText, {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: active || view.status === "claimed" ? "#d8def8" : "#626b88",
    });
    const reward = this.add.text(90, y + 42, `奖励：${view.definition.rewardLabel}`, {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#ffcc80",
    });
    this.content.add([panel, title, status, description, goals, reward]);
    if (view.status === "complete") {
      this.content.add(
        createTextButton(this, {
          x: 745,
          y: y + 38,
          width: 120,
          height: 32,
          label: "领取奖励",
          variant: "accent",
          fontSize: "14px",
          onPress: () => this.claim(view.definition.id),
        })
      );
    }
  }

  private makeSideQuestCard(view: SideQuestView, y: number) {
    const active = view.status === "active" || view.status === "complete";
    const panel = this.add
      .rectangle(450, y, 760, 92, active ? 0x18284a : 0x151b2e)
      .setStrokeStyle(2, view.status === "complete" ? 0xffd54f : active ? 0x4fc3f7 : 0x303a58);
    const title = this.add.text(90, y - 32, view.definition.title, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: view.status === "locked" ? "#747b91" : "#ffffff",
    });
    const status = this.add
      .text(810, y - 30, STATUS_LABELS[view.status], {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: view.status === "complete" ? "#ffd54f" : view.status === "claimed" ? "#9ccc65" : "#9aa0c0",
      })
      .setOrigin(1, 0);
    const description = this.add.text(90, y - 8, view.definition.description, {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#9aa0c0",
    });
    const goalText = view.definition.goals
      .map(
        (goal) => `${goal.label} ${Math.min(goal.target, view.state.progress[goal.id] ?? 0)}/${goal.target}`
      )
      .join("   ·   ");
    const goals = this.add.text(90, y + 18, goalText, {
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: active || view.status === "claimed" ? "#d8def8" : "#626b88",
    });
    const reward = this.add.text(90, y + 38, `奖励：${view.definition.rewardLabel}`, {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#ffcc80",
    });
    this.content.add([panel, title, status, description, goals, reward]);
    if (view.status === "complete") {
      this.content.add(
        createTextButton(this, {
          x: 745,
          y: y + 30,
          width: 120,
          height: 30,
          label: "领取奖励",
          variant: "accent",
          fontSize: "14px",
          onPress: () => this.claimSide(view.definition.id),
        })
      );
    }
  }

  private claim(questId: string) {
    const next = claimQuestReward(this.save, questId);
    if (next === this.save) return;
    if (!saveGame(localStorage, next)) {
      this.message = "奖励领取失败：浏览器无法写入存档";
      return this.render();
    }
    this.save = next;
    this.message = "任务奖励已领取，下一任务已自动激活";
    this.render();
  }

  private claimSide(questId: string) {
    const next = claimSideQuestReward(this.save, questId);
    if (next === this.save) return;
    if (!saveGame(localStorage, next)) {
      this.message = "奖励领取失败：浏览器无法写入存档";
      return this.render();
    }
    this.save = next;
    this.message = "支线奖励已领取";
    this.render();
  }
}
