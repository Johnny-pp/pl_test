import Phaser from "phaser";
import { loadGame, saveGame, type GameSave } from "../player/playerState";
import { pals } from "../data/loadPals";
import { startScene } from "./sceneLoader";
import { createBackButton, createTextButton } from "../ui/button";
import { addSceneTitle, installSceneTheme } from "../ui/theme";
import {
  claimTowerReward,
  getTowerFloor,
  getTowerRestrictions,
  getTowerView,
  TOWER_FLOORS,
} from "../endgame/tower";
import { getRematchViews } from "../endgame/bossRematch";
import {
  claimPeriodChallengeReward,
  getPeriodChallengeViews,
  type PeriodChallengeView,
} from "../endgame/dailyChallenges";
import {
  ACHIEVEMENTS,
  equipTitle,
  isAchievementUnlocked,
  type AchievementCategory,
} from "../endgame/achievements";
import { toggleNgpOption, type NgpOptionKey } from "../endgame/newGamePlus";
import { describeRestrictions, validateChallengeTeam } from "../endgame/challengeRules";

type EndgameTab = "tower" | "rematch" | "challenges" | "achievements" | "ngp";

const TAB_LABELS: { key: EndgameTab; label: string; x: number }[] = [
  { key: "tower", label: "试炼塔", x: 120 },
  { key: "rematch", label: "首领重战", x: 270 },
  { key: "challenges", label: "周期委托", x: 420 },
  { key: "achievements", label: "成就称号", x: 570 },
  { key: "ngp", label: "新周目", x: 720 },
];

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  dex: "图鉴",
  explore: "探索",
  breeding: "配种",
  base: "基地",
  battle: "战斗",
  challenge: "挑战",
};

/** 完成第三地区主线（沉星终章）后解锁终局试炼。 */
export function isEndgameUnlocked(save: GameSave): boolean {
  return (
    save.progress.quests.find((quest) => quest.id === "abyssal-colossus-challenge")?.rewardClaimed === true
  );
}

export class EndgameScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private message = "";
  private tab: EndgameTab = "tower";
  private scrollY = 0;

  constructor() {
    super("EndgameScene");
  }

  create() {
    installSceneTheme(this);
    this.scrollY = 0;
    this.tab = "tower";
    this.save = loadGame(localStorage);
    createBackButton(this, "返回任务", () => void startScene(this, "QuestScene"));
    addSceneTitle(this, "终局试炼");
    for (const tab of TAB_LABELS) {
      createTextButton(this, {
        x: tab.x,
        y: 68,
        width: 132,
        height: 32,
        label: tab.label,
        variant: this.tab === tab.key ? "accent" : "muted",
        fontSize: "13px",
        onPress: () => {
          this.tab = tab.key;
          this.scrollY = 0;
          this.message = "";
          this.render();
        },
      });
    }
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
    if (!isEndgameUnlocked(this.save)) {
      this.content.add(
        this.add
          .text(450, 300, "完成第三地区主线「沉星终章」后可解锁终局试炼", {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: "#567184",
          })
          .setOrigin(0.5)
      );
      return;
    }
    if (this.message) {
      this.content.add(
        this.add
          .text(450, 98, this.message, {
            fontFamily: "sans-serif",
            fontSize: "14px",
            color: "#347d4b",
          })
          .setOrigin(0.5)
      );
    }
    if (this.tab === "tower") this.renderTower();
    else if (this.tab === "rematch") this.renderRematch();
    else if (this.tab === "challenges") this.renderChallenges();
    else if (this.tab === "achievements") this.renderAchievements();
    else this.renderNgp();
  }

  private startChallenge(
    kind: "tower" | "rematch",
    challengeId: string,
    extra: { towerFloor?: number; bossId?: string }
  ) {
    const leader = this.save.teamIds[0];
    const leaderPal = this.save.ownedPals.find((pal) => pal.uid === leader);
    if (!leaderPal) {
      this.message = "请先在队伍页配置出战幻兽";
      this.render();
      return;
    }
    void startScene(this, "BattleScene", {
      playerId: leaderPal.speciesId,
      playerUid: leaderPal.uid,
      enemyId: 1,
      endgame: { kind, challengeId, towerFloor: extra.towerFloor, bossId: extra.bossId },
      returnTo: { scene: "EndgameScene" },
    });
  }

  // ---------- 试炼塔 ----------

  private renderTower() {
    const view = getTowerView(this.save);
    const nextFloor = view.nextFloor;
    this.content.add(
      this.add
        .text(450, 130, `试炼塔进度  ${view.clearedFloors}/${view.totalFloors}`, {
          fontFamily: "sans-serif",
          fontSize: "22px",
          color: "#17334d",
        })
        .setOrigin(0.5)
    );
    if (nextFloor !== null) {
      const floor = getTowerFloor(nextFloor)!;
      const restrictions = getTowerRestrictions(nextFloor);
      const check = validateChallengeTeam(this.save, pals, restrictions);
      const label = check.valid
        ? `挑战第 ${nextFloor} 层（Lv.${floor.level}）`
        : `第 ${nextFloor} 层：${check.missing.join("；")}`;
      this.content.add(
        createTextButton(this, {
          x: 450,
          y: 176,
          width: 240,
          height: 36,
          label,
          variant: check.valid ? "accent" : "muted",
          disabled: !check.valid,
          onPress: () => this.startChallenge("tower", `tower-${nextFloor}`, { towerFloor: nextFloor }),
        })
      );
      if (restrictions) {
        this.content.add(
          this.add
            .text(450, 206, `本层规则：${describeRestrictions(restrictions).join(" · ")}`, {
              fontFamily: "sans-serif",
              fontSize: "13px",
              color: "#71838c",
            })
            .setOrigin(0.5)
        );
      }
    } else {
      this.content.add(
        this.add
          .text(450, 176, "试炼塔已通关，可反复挑战刷新最佳评分", {
            fontFamily: "sans-serif",
            fontSize: "16px",
            color: "#347d4b",
          })
          .setOrigin(0.5)
      );
    }
    if (view.pendingRewards.length > 0) {
      this.content.add(
        this.add
          .text(90, 248, "可领取的阶段奖励", {
            fontFamily: "sans-serif",
            fontSize: "16px",
            color: "#a9680c",
          })
          .setOrigin(0, 0.5)
      );
      view.pendingRewards.forEach((floor, index) => {
        const y = 286 + index * 44;
        this.content.add(
          this.add
            .text(90, y, `第 ${floor} 层奖励`, {
              fontFamily: "sans-serif",
              fontSize: "14px",
              color: "#567184",
            })
            .setOrigin(0, 0.5)
        );
        this.content.add(
          createTextButton(this, {
            x: 745,
            y,
            width: 120,
            height: 30,
            label: "领取奖励",
            variant: "accent",
            fontSize: "13px",
            onPress: () => this.claimTower(floor),
          })
        );
      });
    }
    const startY = view.pendingRewards.length > 0 ? 320 + view.pendingRewards.length * 44 : 240;
    TOWER_FLOORS.forEach((floor, index) => {
      const y = startY + index * 34;
      const cleared = floor.floor <= view.clearedFloors;
      this.content.add(
        this.add
          .text(90, y, `第 ${floor.floor} 层 · Lv.${floor.level}${cleared ? " · 已通关" : ""}`, {
            fontFamily: "sans-serif",
            fontSize: "13px",
            color: cleared ? "#567184" : "#8aabb0",
          })
          .setOrigin(0, 0.5)
      );
    });
  }

  private claimTower(floor: number) {
    const next = claimTowerReward(this.save, floor);
    if (next === this.save) return;
    if (!saveGame(localStorage, next)) {
      this.message = "奖励领取失败：浏览器无法写入存档";
      return this.render();
    }
    this.save = next;
    this.message = "试炼塔阶段奖励已领取";
    this.render();
  }

  // ---------- 首领重战 ----------

  private renderRematch() {
    const views = getRematchViews(this.save);
    views.forEach((view, index) => {
      const y = 138 + index * 112;
      const unlocked = view.unlocked;
      const check = validateChallengeTeam(this.save, pals, view.rematch.restrictions);
      this.content.add(
        this.add
          .rectangle(450, y, 760, 96, unlocked ? 0xffffff : 0xe4ece3)
          .setStrokeStyle(2, unlocked ? 0x93d6d0 : 0xaabcc5)
      );
      this.content.add(
        this.add
          .text(90, y - 30, `${view.bossName}·强化  Lv.${view.rematch.level}`, {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: unlocked ? "#17334d" : "#71838c",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        this.add
          .text(90, y - 4, describeRestrictions(view.rematch.restrictions).join(" · "), {
            fontFamily: "sans-serif",
            fontSize: "13px",
            color: "#71838c",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        this.add
          .text(
            90,
            y + 24,
            `首胜奖励：${view.rematch.firstRewardLabel}${view.firstRewardClaimed ? "（已领取）" : ""}`,
            {
              fontFamily: "sans-serif",
              fontSize: "12px",
              color: view.firstRewardClaimed ? "#347d4b" : "#a9680c",
            }
          )
          .setOrigin(0, 0.5)
      );
      this.content.add(
        createTextButton(this, {
          x: 745,
          y,
          width: 130,
          height: 32,
          label: unlocked
            ? check.valid
              ? view.firstRewardClaimed
                ? "再战"
                : "挑战"
              : "队伍不符"
            : "未解锁",
          variant: unlocked && check.valid ? "accent" : "muted",
          disabled: !unlocked || !check.valid,
          fontSize: "13px",
          onPress: () =>
            this.startChallenge("rematch", `rematch-${view.rematch.bossId}`, { bossId: view.rematch.bossId }),
        })
      );
    });
  }

  // ---------- 周期委托 ----------

  private renderChallenges() {
    const views = getPeriodChallengeViews(this.save);
    this.content.add(
      this.add
        .text(90, 122, "每日委托（本周期固定，可复现）", {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#a9680c",
        })
        .setOrigin(0, 0.5)
    );
    views.forEach((view, index) => {
      this.makeChallengeCard(view, 158 + index * 92, index < 3 ? "daily" : "weekly");
    });
  }

  private makeChallengeCard(view: PeriodChallengeView, y: number, period: "daily" | "weekly") {
    const challenge = view.challenge;
    this.content.add(
      this.add
        .rectangle(450, y, 760, 80, view.status === "claimed" ? 0xe4ece3 : 0xffffff)
        .setStrokeStyle(
          2,
          view.status === "complete" ? 0xf1aa3c : view.status === "claimed" ? 0x3d8d55 : 0x93d6d0
        )
    );
    const title = `${period === "daily" ? "每日" : "每周"} · ${challenge.title}`;
    this.content.add(
      this.add
        .text(90, y - 24, title, {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: view.status === "claimed" ? "#71838c" : "#17334d",
        })
        .setOrigin(0, 0.5)
    );
    const progressText = challenge.goals
      .map((goal) => `${goal.label} ${view.progress[goal.type] ?? 0}/${goal.target}`)
      .join("  ·  ");
    this.content.add(
      this.add
        .text(90, y, progressText, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#567184",
        })
        .setOrigin(0, 0.5)
    );
    this.content.add(
      this.add
        .text(90, y + 22, `奖励：${challenge.rewardLabel}`, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#a9680c",
        })
        .setOrigin(0, 0.5)
    );
    if (view.status === "complete") {
      this.content.add(
        createTextButton(this, {
          x: 745,
          y,
          width: 120,
          height: 30,
          label: "领取奖励",
          variant: "accent",
          fontSize: "13px",
          onPress: () => this.claimPeriod(challenge.id),
        })
      );
    }
  }

  private claimPeriod(challengeId: string) {
    const next = claimPeriodChallengeReward(this.save, challengeId);
    if (next === this.save) return;
    if (!saveGame(localStorage, next)) {
      this.message = "奖励领取失败：浏览器无法写入存档";
      return this.render();
    }
    this.save = next;
    this.message = "周期委托奖励已领取";
    this.render();
  }

  // ---------- 成就与称号 ----------

  private renderAchievements() {
    this.content.add(
      this.add
        .text(90, 122, "成就与称号（纯展示）", {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#a9680c",
        })
        .setOrigin(0, 0.5)
    );
    const titles = this.save.endgame.unlockedTitles;
    this.content.add(
      this.add
        .text(90, 150, `已获得称号：${titles.length > 0 ? titles.join("、") : "（无）"}`, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#17334d",
        })
        .setOrigin(0, 0.5)
    );
    ACHIEVEMENTS.forEach((achievement, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 90 + column * 390;
      const y = 192 + row * 96;
      const unlocked = isAchievementUnlocked(this.save, achievement.id);
      this.content.add(
        this.add
          .rectangle(x, y, 370, 84, unlocked ? 0xffffff : 0xe4ece3)
          .setStrokeStyle(2, unlocked ? 0xf1aa3c : 0xaabcc5)
      );
      this.content.add(
        this.add
          .text(x - 165, y - 26, `${CATEGORY_LABELS[achievement.category]} · ${achievement.title}`, {
            fontFamily: "sans-serif",
            fontSize: "15px",
            color: unlocked ? "#17334d" : "#71838c",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        this.add
          .text(x - 165, y + 2, achievement.description, {
            fontFamily: "sans-serif",
            fontSize: "12px",
            color: "#71838c",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        this.add
          .text(x - 165, y + 24, unlocked ? "已达成" : "未达成", {
            fontFamily: "sans-serif",
            fontSize: "12px",
            color: unlocked ? "#347d4b" : "#8aabb0",
          })
          .setOrigin(0, 0.5)
      );
      if (achievement.titles?.length && unlocked) {
        this.content.add(
          createTextButton(this, {
            x: x + 130,
            y,
            width: 96,
            height: 28,
            label: this.save.endgame.equippedTitleId === achievement.titles[0] ? "已装备" : "装备称号",
            variant: this.save.endgame.equippedTitleId === achievement.titles[0] ? "accent" : "muted",
            disabled: this.save.endgame.equippedTitleId === achievement.titles[0],
            fontSize: "12px",
            onPress: () => this.equip(achievement.titles![0]),
          })
        );
      }
    });
  }

  private equip(titleId: string) {
    const next = equipTitle(this.save, titleId);
    if (next === this.save) return;
    if (!saveGame(localStorage, next)) {
      this.message = "称号装备失败：浏览器无法写入存档";
      return this.render();
    }
    this.save = next;
    this.message = `称号已装备：${titleId}`;
    this.render();
  }

  // ---------- 新周目 ----------

  private renderNgp() {
    this.content.add(
      this.add
        .text(450, 130, "新周目模式（可组合开启，随时切换）", {
          fontFamily: "sans-serif",
          fontSize: "18px",
          color: "#17334d",
        })
        .setOrigin(0.5)
    );
    const options: { key: NgpOptionKey; label: string }[] = [
      { key: "randomEncounters", label: "随机遭遇：野外敌人等级波动" },
      { key: "restrictedCapture", label: "限制捕获：只能使用高级捕获器" },
      { key: "permadeath", label: "永久倒下：倒下的个体无法再出战" },
    ];
    options.forEach((option, index) => {
      const y = 192 + index * 96;
      const enabled = this.save.endgame.newGamePlus[option.key] === true;
      this.content.add(
        this.add.rectangle(450, y, 760, 80, 0xffffff).setStrokeStyle(2, enabled ? 0xf1aa3c : 0x93d6d0)
      );
      this.content.add(
        this.add
          .text(90, y - 14, option.label, {
            fontFamily: "sans-serif",
            fontSize: "16px",
            color: enabled ? "#17334d" : "#567184",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        this.add
          .text(90, y + 16, enabled ? "已开启" : "未开启", {
            fontFamily: "sans-serif",
            fontSize: "13px",
            color: enabled ? "#a9680c" : "#8aabb0",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        createTextButton(this, {
          x: 745,
          y,
          width: 130,
          height: 34,
          label: enabled ? "关闭" : "开启",
          variant: enabled ? "danger" : "accent",
          fontSize: "14px",
          onPress: () => this.toggleNgp(option.key),
        })
      );
    });
  }

  private toggleNgp(option: NgpOptionKey) {
    const next = toggleNgpOption(this.save, option);
    if (!saveGame(localStorage, next)) {
      this.message = "选项保存失败：浏览器无法写入存档";
      return this.render();
    }
    this.save = next;
    this.render();
  }
}
