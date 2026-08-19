import Phaser from "phaser";
import { loadGame, saveGame, type GameSave } from "../player/playerState";
import { claimQuestReward, getQuestViews, type QuestView } from "../quests/questSystem";
import { startScene } from "./sceneLoader";

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

  constructor() {
    super("QuestScene");
  }

  create() {
    this.save = loadGame(localStorage);
    this.add
      .text(18, 18, "< 返回图鉴", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#4fc3f7",
      })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => void startScene(this, "DexScene"));
    this.add
      .text(450, 28, "远征任务", {
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
    const views = getQuestViews(this.save);
    const next = views.find((view) => view.status === "active" || view.status === "complete");
    this.content.add(
      this.add
        .text(450, 72, next ? `下一目标：${next.definition.title}` : "当前任务链已经完成", {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#80deea",
        })
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
    views.forEach((view, index) => this.makeQuestCard(view, 150 + index * 158));
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
      const button = this.add
        .rectangle(745, y + 38, 120, 32, 0x6d5b18)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(745, y + 38, "领取奖励", {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      button.on("pointerdown", () => this.claim(view.definition.id));
      this.content.add([button, label]);
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
}
