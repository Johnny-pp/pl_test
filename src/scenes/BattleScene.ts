import Phaser from "phaser";
import { preloadUiAssets } from "../ui/assets";
import { addSceneTitle, installSceneTheme } from "../ui/theme";
import { pals } from "../data/loadPals";
import {
  chooseEnemySkill,
  createBattle,
  createPartyBattle,
  getSkillEnergyCost,
  getStatusLabel,
  resolveTurn,
  switchPlayer,
  type BattleState,
  type Combatant,
} from "../battle/battleEngine";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import type { ActiveSkill } from "../types/activeSkill";
import { attemptCapture, calculateCaptureChance, rollWildPassiveSkills } from "../capture/capture";
import { passiveSkills } from "../data/loadPassiveSkills";
import {
  addCapturedPal,
  createPalInstance,
  loadGame,
  recordBattleWin,
  saveGame,
  updatePalCurrentHp,
} from "../player/playerState";
import { applyExperienceAward } from "../progression/progression";
import { consumeCaptureOrbByKind } from "../base/baseSystem";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";
import { startScene } from "./sceneLoader";
import { bossesById } from "../battle/bosses";
import { recordBossVictory, recordQuestEvent } from "../quests/questSystem";
import { recordSideQuestEvent } from "../quests/sideQuests";
import { applyBattleRewards } from "../battle/drops";
import { elitesById, recordEliteDefeat } from "../explore/elites";
import type { WorldRegion } from "../world/regions";
import { createBackButton, createTextButton } from "../ui/button";
import { describePassiveBonuses } from "../passives/passiveEffects";
import { createInstanceBuildSnapshot } from "../build/buildCombatant";
import { activeSkillsById } from "../data/loadActiveSkills";
import { passiveSkillsById } from "../data/loadPassiveSkills";
import { equipmentDefinitions, equipmentDefinitionsById } from "../data/loadEquipment";
import { grantEquipment, rollEquipmentDropForBoss, rollEquipmentId } from "../build/equipment";
import { chooseAutoBattleSkill, chooseAutoSwitchIndex } from "../battle/autoBattle";
import type { AutoExploreSession } from "../world/autoExploration";
import { announceGameStatus } from "../ui/accessibility";
import { instancePassesRestrictions, type ChallengeRestrictions } from "../endgame/challengeRules";
import { claimRematchFirstReward, getRematchForBoss } from "../endgame/bossRematch";
import { getTowerFloor, getTowerRestrictions, recordTowerVictory } from "../endgame/tower";
import { computeBattleScore, recordBestScore } from "../endgame/battleScore";
import { recordEndgameEvent } from "../endgame/dailyChallenges";
import { refreshAchievements } from "../endgame/achievements";
import { applyPermadeath, ngpCaptureOrbKind } from "../endgame/newGamePlus";

interface BattleSceneData {
  playerId: number;
  enemyId: number;
  enemyLevel?: number;
  playerUid?: string;
  bossId?: string;
  eliteId?: string;
  region?: WorldRegion;
  autoExplore?: AutoExploreSession;
  /** 终局挑战上下文（试炼塔/首领重战）。 */
  endgame?: {
    kind: "tower" | "rematch";
    challengeId: string;
    towerFloor?: number;
    bossId?: string;
  };
  returnTo?: {
    scene: string;
    data?: Record<string, unknown>;
  };
}

export class BattleScene extends Phaser.Scene {
  private state?: BattleState;
  private playerHp!: Phaser.GameObjects.Rectangle;
  private enemyHp!: Phaser.GameObjects.Rectangle;
  private playerStatus!: Phaser.GameObjects.Text;
  private enemyStatus!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private actionLayer!: Phaser.GameObjects.Container;
  private busy = false;
  private captureAttempted = false;
  private captureMessage = "";
  private returnTo?: BattleSceneData["returnTo"];
  private playerUid?: string;
  private enemyLevel = 1;
  private progressionMessage = "";
  private bossId?: string;
  private eliteId?: string;
  private battleRegion?: WorldRegion;
  private partyUids: string[] = [];
  private participatedUids = new Set<string>();
  private choosingSwitch = false;
  private playerPanel?: Phaser.GameObjects.Container;
  private displayedPlayerIndex = -1;
  private autoExploreAvailable = false;
  private autoExploreActive = false;
  private autoExploreMessage = "";
  private autoActionTimer?: Phaser.Time.TimerEvent;
  private autoStatusText?: Phaser.GameObjects.Text;
  private startAutoButton?: Phaser.GameObjects.Container;
  private stopAutoButton?: Phaser.GameObjects.Container;
  private endgameKind?: "tower" | "rematch";
  private endgameChallengeId?: string;
  private endgameTowerFloor?: number;
  private endgameBossId?: string;
  private challengeRestrictions?: ChallengeRestrictions;
  private switchCount = 0;
  private challengeScoreText = "";
  private readonly visibilityHandler = () => {
    if (document.hidden && this.autoExploreActive) {
      this.setAutoExplore(false, "已因进入后台暂停 · 点击继续挂机");
    }
  };

  constructor() {
    super("BattleScene");
  }

  preload() {
    preloadPalPortraits(this);
    preloadUiAssets(this);
  }

  create(data: BattleSceneData) {
    installSceneTheme(this);
    this.captureAttempted = false;
    this.captureMessage = "";
    this.progressionMessage = "";
    this.partyUids = [];
    this.participatedUids.clear();
    this.choosingSwitch = false;
    this.displayedPlayerIndex = -1;
    this.returnTo = data.returnTo;
    this.autoExploreAvailable = Boolean(data.autoExplore) && !data.bossId;
    this.autoExploreActive = this.autoExploreAvailable && data.autoExplore?.active === true;
    this.autoExploreMessage = data.autoExplore?.message ?? "挂机战斗已暂停";
    this.playerUid = data.playerUid;
    this.enemyLevel = Math.max(1, Math.min(50, Math.floor(data.enemyLevel ?? 1)));
    this.bossId = data.bossId;
    this.eliteId = data.eliteId;
    this.endgameKind = data.endgame?.kind;
    this.endgameChallengeId = data.endgame?.challengeId;
    this.endgameTowerFloor = data.endgame?.towerFloor;
    this.endgameBossId = data.endgame?.bossId;
    this.switchCount = 0;
    this.challengeScoreText = "";
    const elite = this.eliteId ? elitesById.get(this.eliteId) : undefined;
    this.battleRegion = data.region ?? elite?.region;
    const boss = this.bossId ? bossesById.get(this.bossId) : undefined;

    let enemyPal: (typeof pals)[number] | undefined;
    let effectiveLevel = Math.max(1, Math.min(50, Math.floor(data.enemyLevel ?? 1)));
    let bossRules = boss?.rules;
    this.challengeRestrictions = undefined;
    if (data.endgame?.kind === "tower" && data.endgame.towerFloor !== undefined) {
      const floor = getTowerFloor(data.endgame.towerFloor);
      if (floor) {
        enemyPal = pals.find((pal) => pal.id === floor.speciesId);
        effectiveLevel = floor.level;
        bossRules = floor.bossRules;
        this.challengeRestrictions = getTowerRestrictions(data.endgame.towerFloor);
      }
    } else if (data.endgame?.kind === "rematch" && data.endgame.bossId) {
      const rematch = getRematchForBoss(data.endgame.bossId);
      const rematchBoss = rematch ? bossesById.get(rematch.bossId) : undefined;
      if (rematch && rematchBoss) {
        enemyPal = pals.find((pal) => pal.id === rematchBoss.speciesId);
        effectiveLevel = rematch.level;
        bossRules = rematch.rules;
        this.challengeRestrictions = rematch.restrictions;
      }
    }
    const player = pals.find((pal) => pal.id === data.playerId);
    const enemy = enemyPal ?? pals.find((pal) => pal.id === data.enemyId);
    if (!player || !enemy) {
      this.add.text(450, 300, "战斗数据无效", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);
      this.makeNavButton(450, 350, this.returnTo ? "返回地图" : "返回图鉴", () => this.leaveBattle());
      return;
    }

    const currentSave = loadGame(localStorage);
    const instance = this.playerUid
      ? currentSave.ownedPals.find((pal) => pal.uid === this.playerUid && pal.speciesId === player.id)
      : undefined;
    if (instance) {
      const orderedUids = this.endgameChallengeId
        ? currentSave.teamIds
        : [instance.uid, ...currentSave.teamIds.filter((uid) => uid !== instance.uid)];
      const members = orderedUids.flatMap((uid) => {
        const owned = currentSave.ownedPals.find((pal) => pal.uid === uid);
        const species = owned ? pals.find((pal) => pal.id === owned.speciesId) : undefined;
        if (!owned || !species) return [];
        if (
          this.challengeRestrictions &&
          !instancePassesRestrictions(species, owned, this.challengeRestrictions)
        )
          return [];
        this.partyUids.push(owned.uid);
        return [
          {
            pal: species,
            level: owned.level,
            currentHp: owned.currentHp,
            passiveSkillIds: owned.passiveSkillIds,
            build: createInstanceBuildSnapshot(currentSave, species, owned, {
              activeSkills: activeSkillsById,
              passiveSkills: passiveSkillsById,
              equipment: equipmentDefinitionsById,
            }),
          },
        ];
      });
      this.state = createPartyBattle(members, enemy, effectiveLevel, bossRules);
      const activeUid = this.partyUids[this.state.activePlayerIndex];
      if (activeUid) this.participatedUids.add(activeUid);
    } else {
      this.state = createBattle(player, enemy, 1, effectiveLevel, bossRules);
    }
    if (boss) this.state.enemy.name = boss.name;
    if (data.endgame?.kind === "rematch") {
      const rematch = data.endgame.bossId ? getRematchForBoss(data.endgame.bossId) : undefined;
      if (rematch) this.state.enemy.name = `${this.state.enemy.name}·强化`;
    }
    createBackButton(this, "退出战斗", () => this.leaveBattle());
    addSceneTitle(
      this,
      this.endgameKind === "tower"
        ? `试炼塔·第 ${this.endgameTowerFloor ?? 1} 层`
        : this.endgameKind === "rematch"
          ? "首领强化重战"
          : boss
            ? "区域首领战"
            : "幻兽对决"
    );
    this.createAutoExploreControls();
    this.roundText = this.add
      .text(450, 66, "", {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#9aa0c0",
      })
      .setOrigin(0.5);

    this.makeCombatantPanel(655, 150, this.state.enemy, false);
    this.playerPanel = this.makeCombatantPanel(245, 330, this.state.player, true);
    this.displayedPlayerIndex = this.state.activePlayerIndex;

    this.add.rectangle(450, 470, 840, 128, 0x0f1830).setStrokeStyle(1, 0x0f3460);
    this.logText = this.add.text(48, 416, "", {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#d8def8",
      lineSpacing: 4,
      wordWrap: { width: 804 },
    });
    this.actionLayer = this.add.container(0, 0);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.autoActionTimer?.remove(false);
    });
    if (document.hidden && this.autoExploreActive) {
      this.setAutoExplore(false, "已因进入后台暂停 · 点击继续挂机");
    }
    this.render();
  }

  private createAutoExploreControls() {
    if (!this.autoExploreAvailable) return;
    this.autoStatusText = this.add
      .text(785, 65, "", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#9ccc65",
      })
      .setOrigin(1, 0.5)
      .setDepth(11);
    this.startAutoButton = createTextButton(this, {
      x: 810,
      y: 28,
      width: 142,
      height: 32,
      label: "▶ 继续挂机",
      variant: "accent",
      fontSize: "13px",
      onPress: () => this.setAutoExplore(true, "自动战斗中"),
    }).setDepth(12);
    this.stopAutoButton = createTextButton(this, {
      x: 810,
      y: 28,
      width: 142,
      height: 32,
      label: "■ 停止挂机",
      variant: "danger",
      fontSize: "13px",
      onPress: () => this.setAutoExplore(false, "已手动停止挂机"),
    }).setDepth(12);
    this.updateAutoExploreControls();
  }

  private setAutoExplore(active: boolean, message: string) {
    this.autoExploreActive = active;
    this.autoExploreMessage = message;
    this.autoActionTimer?.remove(false);
    this.autoActionTimer = undefined;
    this.syncReturnAutoExplore();
    this.updateAutoExploreControls();
    announceGameStatus(active ? "探索挂机继续，正在自动战斗。" : message);
    if (active) this.queueAutoAction();
  }

  private syncReturnAutoExplore() {
    if (!this.returnTo?.data) return;
    this.returnTo.data.autoExplore = {
      active: this.autoExploreActive,
      message: this.autoExploreMessage,
    } satisfies AutoExploreSession;
  }

  private updateAutoExploreControls() {
    this.autoStatusText?.setText(
      `${this.autoExploreActive ? "● 挂机运行" : "○ 挂机暂停"} · ${this.autoExploreMessage}`
    );
    this.autoStatusText?.setColor(this.autoExploreActive ? "#9ccc65" : "#ff8a80");
    this.startAutoButton?.setVisible(!this.autoExploreActive);
    this.stopAutoButton?.setVisible(this.autoExploreActive);
  }

  private makeCombatantPanel(
    x: number,
    y: number,
    fighter: Combatant,
    player: boolean
  ): Phaser.GameObjects.Container {
    const element = fighter.elements[0] ?? "neutral";
    const contentX = player ? x - 55 : x - 145;
    const background = this.add
      .rectangle(x, y, 350, 130, 0x16213e)
      .setStrokeStyle(2, ELEMENT_COLORS[element]);
    const portrait = addPalPortrait(this, fighter.id, x + (player ? -120 : 120), y + 8, 110);
    const name = this.add.text(
      contentX,
      y - 48,
      `${fighter.name} Lv.${fighter.level}  ·  ${fighter.elements.map((e) => ELEMENT_LABELS[e]).join("/")}`,
      {
        fontFamily: "sans-serif",
        fontSize: "21px",
        color: "#ffffff",
      }
    );
    const hpBackground = this.add.rectangle(contentX, y, 200, 16, 0x301f38).setOrigin(0, 0.5);
    const hp = this.add.rectangle(contentX, y, 200, 16, 0x66bb6a).setOrigin(0, 0.5);
    const status = this.add.text(contentX, y + 18, "", {
      fontFamily: "sans-serif",
      fontSize: "14px",
      color: "#b8c0df",
    });
    if (player) {
      this.playerHp = hp;
      this.playerStatus = status;
    } else {
      this.enemyHp = hp;
      this.enemyStatus = status;
    }
    return this.add.container(0, 0, [background, portrait, name, hpBackground, hp, status]);
  }

  private render() {
    if (!this.state) return;
    if (this.displayedPlayerIndex !== this.state.activePlayerIndex) {
      this.playerPanel?.destroy(true);
      this.playerPanel = this.makeCombatantPanel(245, 330, this.state.player, true);
      this.displayedPlayerIndex = this.state.activePlayerIndex;
    }
    this.roundText.setText(`第 ${this.state.round} 回合`);
    this.updateFighter(this.state.player, this.playerHp, this.playerStatus);
    this.updateFighter(this.state.enemy, this.enemyHp, this.enemyStatus);
    this.logText.setText(this.state.log.slice(-5).join("\n"));
    this.renderActions();
  }

  private updateFighter(
    fighter: Combatant,
    hpBar: Phaser.GameObjects.Rectangle,
    status: Phaser.GameObjects.Text
  ) {
    hpBar.displayWidth = 200 * (fighter.hp / fighter.maxHp);
    hpBar.setFillStyle(fighter.hp / fighter.maxHp > 0.35 ? 0x66bb6a : 0xef5350);
    const statusNames = fighter.statuses.map((effect) => getStatusLabel(effect.type)).join("、");
    const skillNames = fighter.skillIds.map((id) => activeSkillsById.get(id)?.name.zh ?? id).join("、");
    const passiveText = describePassiveBonuses(fighter.passiveSkillIds).slice(0, 2).join("、");
    status.setText(
      `HP ${fighter.hp}/${fighter.maxHp}    能量 ${fighter.energy}/100${statusNames ? `    ${statusNames}` : ""}\n技能：${skillNames || "无"}${passiveText ? `\n被动：${passiveText}` : ""}`
    );
  }

  private renderActions() {
    this.actionLayer.removeAll(true);
    if (!this.state) return;
    if (this.state.phase === "victory" || this.state.phase === "defeat") {
      const title = this.add
        .text(450, 540, this.state.phase === "victory" ? "战斗胜利" : "战斗失败", {
          fontFamily: "sans-serif",
          fontSize: "24px",
          color: this.state.phase === "victory" ? "#ffd54f" : "#ff8a80",
        })
        .setOrigin(0.5);
      const progression = this.add
        .text(450, 570, this.challengeScoreText || this.progressionMessage, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#80deea",
        })
        .setOrigin(0.5);
      const again = this.makeNavButton(500, 602, this.returnTo ? "返回地图" : "重新选角", () =>
        this.returnTo ? this.leaveBattle() : void startScene(this, "SelectPalScene")
      );
      const dex = this.makeNavButton(665, 602, "返回图鉴", () => void startScene(this, "DexScene"));
      this.actionLayer.add([title, progression, again, dex]);
      if (this.state.phase === "victory") {
        const currentSave = loadGame(localStorage);
        const enemyPal = pals.find((pal) => pal.id === this.state?.enemy.id);
        if (enemyPal && !this.captureAttempted && !this.bossId && !this.endgameKind) {
          const chance = calculateCaptureChance({
            hp: this.state.enemy.hp,
            maxHp: this.state.enemy.maxHp,
            rarity: enemyPal.rarity,
            catchRate: enemyPal.catchRate,
          });
          const orbKind = ngpCaptureOrbKind(currentSave);
          const orbCount =
            orbKind === "advanced"
              ? currentSave.inventory.advancedCaptureOrbs
              : currentSave.inventory.captureOrbs;
          if (orbCount > 0) {
            const capture = this.makeNavButton(
              170,
              602,
              `捕获 ${chance}% · ${orbKind === "advanced" ? "高级捕获器" : "捕获器"} ${orbCount}`,
              () => this.captureEnemy(enemyPal)
            );
            this.actionLayer.add(capture);
          } else {
            const noOrb = this.add
              .text(
                170,
                602,
                orbKind === "advanced" ? "高级捕获器不足，请到基地制造" : "捕获器不足，请到基地制造",
                {
                  fontFamily: "sans-serif",
                  fontSize: "14px",
                  color: "#ff8a80",
                }
              )
              .setOrigin(0.5);
            this.actionLayer.add(noOrb);
          }
        } else if (this.captureMessage) {
          const message = this.add
            .text(170, 602, this.captureMessage, {
              fontFamily: "sans-serif",
              fontSize: "16px",
              color: this.captureMessage.startsWith("捕获成功") ? "#9ccc65" : "#ff8a80",
            })
            .setOrigin(0.5);
          this.actionLayer.add(message);
        }
      }
      if (this.autoExploreActive) {
        if (this.state.phase === "defeat") {
          this.setAutoExplore(false, "全队已失去战斗能力 · 请返回队伍治疗");
        } else {
          this.queueAutoAction();
        }
      }
      return;
    }

    if (this.state.phase === "switching" || this.choosingSwitch) {
      this.renderPartyChoices(this.state.phase === "switching");
      this.queueAutoAction();
      return;
    }

    const label = this.add.text(42, 548, "选择技能", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#ffffff",
    });
    this.actionLayer.add(label);
    if (this.state.playerParty.length > 1) {
      const switchButton = this.makeNavButton(820, 548, "更换队员", () => {
        this.choosingSwitch = true;
        this.renderActions();
      });
      this.actionLayer.add(switchButton);
    }
    const skills = this.state.player.skillIds
      .map((id) => activeSkillsById.get(id))
      .filter((skill): skill is ActiveSkill => Boolean(skill));
    skills.forEach((skill, index) => {
      const x = 150 + index * 185;
      const cost = this.state ? getSkillEnergyCost(this.state.player, skill) : skill.energyCost;
      const affordable = this.state ? this.state.player.energy >= cost : false;
      const bg = this.add
        .rectangle(x, 594, 165, 58, affordable ? 0x20345c : 0x29293b)
        .setStrokeStyle(1, ELEMENT_COLORS[skill.element])
        .setInteractive({ useHandCursor: true });
      const name = this.add
        .text(x, 582, skill.name.zh, {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: affordable ? "#ffffff" : "#89899c",
        })
        .setOrigin(0.5);
      const stats = this.add
        .text(x, 606, `威力 ${skill.power} · 能量 ${cost}`, {
          fontFamily: "sans-serif",
          fontSize: "12px",
          color: "#9aa0c0",
        })
        .setOrigin(0.5);
      bg.on("pointerdown", () => this.takeTurn(skill));
      this.actionLayer.add([bg, name, stats]);
    });
    this.queueAutoAction();
  }

  private queueAutoAction() {
    if (!this.autoExploreActive || !this.state || this.autoActionTimer) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.autoActionTimer = this.time.delayedCall(reducedMotion ? 240 : 620, () => {
      this.autoActionTimer = undefined;
      this.runAutoAction();
    });
  }

  private runAutoAction() {
    if (!this.autoExploreActive || !this.state || this.busy) {
      if (this.autoExploreActive) this.queueAutoAction();
      return;
    }
    if (this.state.phase === "victory") {
      const enemyPal = pals.find((pal) => pal.id === this.state?.enemy.id);
      const save = loadGame(localStorage);
      const isNewSpecies = enemyPal && !save.ownedPals.some((pal) => pal.speciesId === enemyPal.id);
      if (enemyPal && isNewSpecies && !this.captureAttempted && save.inventory.captureOrbs > 0) {
        this.captureEnemy(enemyPal);
        return;
      }
      this.leaveBattle();
      return;
    }
    if (this.state.phase === "defeat") return;
    if (this.state.phase === "switching") {
      const index = chooseAutoSwitchIndex(this.state);
      if (index === undefined) {
        this.setAutoExplore(false, "全队已失去战斗能力 · 请返回队伍治疗");
        return;
      }
      this.switchTo(index);
      return;
    }
    if (this.state.phase !== "choosing") {
      this.queueAutoAction();
      return;
    }
    const skill = chooseAutoBattleSkill(this.state.player, this.state.enemy, activeSkillsById);
    if (!skill) {
      this.setAutoExplore(false, "当前队员没有可用技能 · 已停止挂机");
      return;
    }
    this.takeTurn(skill);
  }

  private renderPartyChoices(forced: boolean) {
    if (!this.state) return;
    const label = this.add.text(42, 535, forced ? "当前队员倒下，请选择替补" : "更换队员将占用本回合", {
      fontFamily: "sans-serif",
      fontSize: "17px",
      color: forced ? "#ff8a80" : "#ffffff",
    });
    this.actionLayer.add(label);
    this.state.playerParty.forEach((fighter, index) => {
      const active = index === this.state?.activePlayerIndex;
      const available = fighter.hp > 0 && !active;
      const x = 82 + index * 145;
      const bg = this.add
        .rectangle(x, 590, 132, 58, available ? 0x203f5c : 0x29293b)
        .setStrokeStyle(1, active ? 0xffd54f : 0x4f6280);
      if (available) bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.switchTo(index));
      const name = this.add
        .text(x, 580, `${active ? "[出战] " : ""}${fighter.name}`, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: available || active ? "#ffffff" : "#777b8d",
        })
        .setOrigin(0.5);
      const hp = this.add
        .text(x, 603, `Lv.${fighter.level} · HP ${fighter.hp}/${fighter.maxHp}`, {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: fighter.hp > 0 ? "#9ccc65" : "#ff8a80",
        })
        .setOrigin(0.5);
      this.actionLayer.add([bg, name, hp]);
    });
    if (!forced) {
      const cancel = this.makeNavButton(820, 535, "取消", () => {
        this.choosingSwitch = false;
        this.renderActions();
      });
      this.actionLayer.add(cancel);
    }
  }

  private takeTurn(playerSkill: ActiveSkill) {
    if (!this.state || this.busy || this.state.phase !== "choosing") return;
    const enemySkill = chooseEnemySkill(this.state.enemy, activeSkillsById);
    if (!enemySkill) return;
    this.busy = true;
    this.state = resolveTurn(this.state, playerSkill, enemySkill);
    let save = this.persistPartyHealth(loadGame(localStorage));
    if (this.state.phase === "victory") {
      save = recordBattleWin(save);
      save = recordQuestEvent(save, { type: "battle-win", region: this.battleRegion });
      save = recordSideQuestEvent(save, { type: "battle-win", region: this.battleRegion });
      const enemySpecies = pals.find((pal) => pal.id === this.state?.enemy.id);
      if (enemySpecies) save = applyBattleRewards(save, enemySpecies, this.enemyLevel);
      if (this.endgameKind) {
        const challengeId =
          this.endgameKind === "tower"
            ? `tower-${this.endgameTowerFloor ?? 1}`
            : `rematch-${this.endgameBossId}`;
        const totalMaxHp = this.state.playerParty.reduce((sum, fighter) => sum + fighter.maxHp, 0);
        const totalRemainingHp = this.state.playerParty.reduce((sum, fighter) => sum + fighter.hp, 0);
        const score = computeBattleScore({
          victory: true,
          rounds: this.state.round,
          totalRemainingHp,
          totalMaxHp,
          switchCount: this.switchCount,
          baseLevel: this.state.enemy.level,
        });
        save.endgame.bestScores = recordBestScore(save.endgame.bestScores, challengeId, score);
        this.challengeScoreText = `挑战评分：${score}（最佳 ${save.endgame.bestScores[challengeId]}）`;
        if (this.endgameKind === "tower") {
          save = recordTowerVictory(save, this.endgameTowerFloor ?? 1);
          save = recordEndgameEvent(save, { type: "tower-floor" });
        } else if (this.endgameKind === "rematch" && this.endgameBossId) {
          save = claimRematchFirstReward(save, this.endgameBossId);
          save = recordEndgameEvent(save, { type: "rematch-win" });
        }
      } else if (this.bossId) {
        save = recordBossVictory(save, this.bossId);
        const boss = bossesById.get(this.bossId);
        if (boss) {
          const dropped = rollEquipmentDropForBoss(boss.name, boss.id);
          if (dropped) {
            const result = grantEquipment(save, dropped);
            save = result.save;
            this.captureMessage = `首领掉落：${equipmentDefinitions.find((item) => item.id === dropped)?.name.zh ?? dropped}（装备已存入背包）`;
          }
        }
      } else {
        save = recordEndgameEvent(save, { type: "battle-win" });
        const enemyPalForDrop = pals.find((pal) => pal.id === this.state?.enemy.id);
        if (Math.random() < 0.18) {
          const rarity = enemyPalForDrop ? (enemyPalForDrop.rarity >= 4 ? "rare" : "common") : "common";
          const dropped = rollEquipmentId(equipmentDefinitions, rarity);
          if (dropped) {
            const result = grantEquipment(save, dropped);
            save = result.save;
            this.captureMessage = `掉落装备：${equipmentDefinitions.find((item) => item.id === dropped)?.name.zh ?? dropped}`;
          }
        }
      }
      const elite = this.eliteId ? elitesById.get(this.eliteId) : undefined;
      if (elite) {
        const result = recordEliteDefeat(save, elite);
        save = result.save;
        const dropNote = result.firstDefeat && this.captureMessage ? `；${this.captureMessage}` : "";
        this.captureMessage = `击败训练者 ${elite.name}（${elite.rewardLabel}）${dropNote}`;
        this.progressionMessage = `精英挑战${result.firstDefeat ? "首胜" : "已重战"} · 经验照常结算`;
      }
      if (enemySpecies) {
        const messages: string[] = [];
        for (const uid of this.participatedUids) {
          const owned = save.ownedPals.find((pal) => pal.uid === uid);
          const playerSpecies = owned ? pals.find((pal) => pal.id === owned.speciesId) : undefined;
          if (!owned || !playerSpecies) continue;
          const result = applyExperienceAward(
            save.ownedPals,
            uid,
            playerSpecies,
            this.enemyLevel,
            enemySpecies.rarity
          );
          if (!result.award) continue;
          save = { ...save, ownedPals: result.ownedPals };
          messages.push(
            `${playerSpecies.name.zh} +${result.award.gained}${result.award.levelsGained > 0 ? ` → Lv.${result.award.newLevel}` : ""}`
          );
        }
        this.progressionMessage = messages.length > 0 ? `经验：${messages.join(" · ")}` : "";
      }
      save = refreshAchievements(save, pals);
    }
    save = this.applyEndgamePermadeath(save);
    saveGame(localStorage, save);
    this.render();
    this.busy = false;
  }

  /** 永久倒下：开启新周目模式时，移除本场倒下的个体。 */
  private applyEndgamePermadeath(save: ReturnType<typeof loadGame>): ReturnType<typeof loadGame> {
    if (!save.endgame.newGamePlus.permadeath || !this.state) return save;
    const downedUids = this.state.playerParty
      .map((fighter, index) => ({ fighter, uid: this.partyUids[index] }))
      .filter((entry) => entry.fighter.hp <= 0 && entry.uid)
      .map((entry) => entry.uid!);
    if (downedUids.length === 0) return save;
    const removed = applyPermadeath(save, downedUids);
    if (removed !== save) {
      this.captureMessage = `永久倒下：${downedUids.length} 只幻兽离队。`;
    }
    return removed;
  }

  private switchTo(index: number) {
    if (!this.state || this.busy) return;
    const forced = this.state.phase === "switching";
    const enemySkill = forced ? undefined : chooseEnemySkill(this.state.enemy, activeSkillsById);
    if (!forced && !enemySkill) return;
    const next = switchPlayer(this.state, index, enemySkill);
    if (next === this.state) return;
    this.state = next;
    this.switchCount += 1;
    this.choosingSwitch = false;
    const activeUid = this.partyUids[this.state.activePlayerIndex];
    if (activeUid) this.participatedUids.add(activeUid);
    saveGame(localStorage, this.persistPartyHealth(loadGame(localStorage)));
    this.render();
  }

  private persistPartyHealth(save: ReturnType<typeof loadGame>) {
    if (!this.state) return save;
    let next = save;
    this.state.playerParty.forEach((fighter, index) => {
      const uid = this.partyUids[index];
      if (uid) next = updatePalCurrentHp(next, uid, fighter.hp);
    });
    return next;
  }

  private captureEnemy(enemyPal: (typeof pals)[number]) {
    if (!this.state || this.captureAttempted) return;
    const currentSave = loadGame(localStorage);
    const orbKind = ngpCaptureOrbKind(currentSave);
    const consumed = consumeCaptureOrbByKind(currentSave, orbKind);
    if (!consumed.consumed) {
      this.captureMessage = orbKind === "advanced" ? "高级捕获器不足" : "捕获器不足";
      this.render();
      return;
    }
    this.captureAttempted = true;
    const result = attemptCapture({
      hp: this.state.enemy.hp,
      maxHp: this.state.enemy.maxHp,
      rarity: enemyPal.rarity,
      catchRate: enemyPal.catchRate,
    });
    if (result.success) {
      const rolledPassives = rollWildPassiveSkills(passiveSkills.map((skill) => skill.id));
      const captured = addCapturedPal(
        consumed.save,
        createPalInstance(enemyPal, undefined, undefined, rolledPassives)
      );
      const next = recordQuestEvent(captured, { type: "capture" });
      const persisted = saveGame(localStorage, next);
      this.captureMessage = persisted ? "捕获成功！" : "捕获成功，但存档失败";
    } else {
      saveGame(localStorage, consumed.save);
      this.captureMessage = "捕获失败";
    }
    this.render();
  }

  private leaveBattle() {
    if (this.returnTo) {
      void startScene(this, this.returnTo.scene, this.returnTo.data);
    } else {
      void startScene(this, "DexScene");
    }
  }

  private makeNavButton(x: number, y: number, label: string, action: () => void) {
    return createTextButton(this, {
      x,
      y,
      width: 145,
      height: 38,
      label,
      onPress: action,
      backgroundColor: 0x0f3460,
      fontSize: "16px",
    });
  }
}
