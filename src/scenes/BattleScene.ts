import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { activeSkillsById } from "../data/loadActiveSkills";
import {
  chooseEnemySkill,
  createBattle,
  resolveTurn,
  type BattleState,
  type Combatant,
} from "../battle/battleEngine";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import type { ActiveSkill } from "../types/activeSkill";
import { attemptCapture, calculateCaptureChance } from "../capture/capture";
import {
  addCapturedPal,
  createPalInstance,
  loadGame,
  recordBattleWin,
  saveGame,
} from "../player/playerState";

interface BattleSceneData {
  playerId: number;
  enemyId: number;
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

  constructor() {
    super("BattleScene");
  }

  create(data: BattleSceneData) {
    this.captureAttempted = false;
    this.captureMessage = "";
    const player = pals.find((pal) => pal.id === data.playerId);
    const enemy = pals.find((pal) => pal.id === data.enemyId);
    if (!player || !enemy) {
      this.add.text(450, 300, "战斗数据无效", { fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);
      this.makeNavButton(450, 350, "返回图鉴", () => this.scene.start("DexScene"));
      return;
    }

    this.state = createBattle(player, enemy);
    this.add.text(18, 18, "< 退出战斗", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#4fc3f7",
    }).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("DexScene"));
    this.add.text(450, 28, "幻兽对决", {
      fontFamily: "sans-serif",
      fontSize: "30px",
      color: "#ffffff",
    }).setOrigin(0.5);
    this.roundText = this.add.text(450, 66, "", {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#9aa0c0",
    }).setOrigin(0.5);

    this.makeCombatantPanel(655, 150, this.state.enemy, false);
    this.makeCombatantPanel(245, 330, this.state.player, true);

    this.add.rectangle(450, 470, 840, 128, 0x0f1830).setStrokeStyle(1, 0x0f3460);
    this.logText = this.add.text(48, 416, "", {
      fontFamily: "sans-serif",
      fontSize: "15px",
      color: "#d8def8",
      lineSpacing: 4,
      wordWrap: { width: 804 },
    });
    this.actionLayer = this.add.container(0, 0);
    this.render();
  }

  private makeCombatantPanel(x: number, y: number, fighter: Combatant, player: boolean) {
    const element = fighter.elements[0] ?? "neutral";
    this.add.rectangle(x, y, 350, 130, 0x16213e).setStrokeStyle(2, ELEMENT_COLORS[element]);
    this.add.circle(x + (player ? -125 : 125), y, 32, ELEMENT_COLORS[element], 0.85);
    this.add.text(x - 145, y - 48, `${fighter.name}  ·  ${fighter.elements.map((e) => ELEMENT_LABELS[e]).join("/")}`, {
      fontFamily: "sans-serif",
      fontSize: "21px",
      color: "#ffffff",
    });
    this.add.rectangle(x - 145, y, 260, 16, 0x301f38).setOrigin(0, 0.5);
    const hp = this.add.rectangle(x - 145, y, 260, 16, 0x66bb6a).setOrigin(0, 0.5);
    const status = this.add.text(x - 145, y + 18, "", {
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
  }

  private render() {
    if (!this.state) return;
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
    hpBar.displayWidth = 260 * (fighter.hp / fighter.maxHp);
    hpBar.setFillStyle(fighter.hp / fighter.maxHp > 0.35 ? 0x66bb6a : 0xef5350);
    status.setText(`HP ${fighter.hp}/${fighter.maxHp}    能量 ${fighter.energy}/100`);
  }

  private renderActions() {
    this.actionLayer.removeAll(true);
    if (!this.state) return;
    if (this.state.phase === "victory" || this.state.phase === "defeat") {
      const title = this.add.text(450, 555, this.state.phase === "victory" ? "战斗胜利" : "战斗失败", {
        fontFamily: "sans-serif",
        fontSize: "24px",
        color: this.state.phase === "victory" ? "#ffd54f" : "#ff8a80",
      }).setOrigin(0.5);
      const again = this.makeNavButton(500, 602, "重新选角", () => this.scene.start("SelectPalScene"));
      const dex = this.makeNavButton(665, 602, "返回图鉴", () => this.scene.start("DexScene"));
      this.actionLayer.add([title, again, dex]);
      if (this.state.phase === "victory") {
        const enemyPal = pals.find((pal) => pal.id === this.state?.enemy.id);
        if (enemyPal && !this.captureAttempted) {
          const chance = calculateCaptureChance({
            hp: this.state.enemy.hp,
            maxHp: this.state.enemy.maxHp,
            rarity: enemyPal.rarity,
            catchRate: enemyPal.catchRate,
          });
          const capture = this.makeNavButton(170, 602, `捕获 ${chance}%`, () => this.captureEnemy(enemyPal));
          this.actionLayer.add(capture);
        } else if (this.captureMessage) {
          const message = this.add.text(170, 602, this.captureMessage, {
            fontFamily: "sans-serif",
            fontSize: "16px",
            color: this.captureMessage.startsWith("捕获成功") ? "#9ccc65" : "#ff8a80",
          }).setOrigin(0.5);
          this.actionLayer.add(message);
        }
      }
      return;
    }

    const label = this.add.text(42, 548, "选择技能", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#ffffff",
    });
    this.actionLayer.add(label);
    const skills = this.state.player.skillIds
      .map((id) => activeSkillsById.get(id))
      .filter((skill): skill is ActiveSkill => Boolean(skill));
    skills.forEach((skill, index) => {
      const x = 150 + index * 185;
      const affordable = this.state ? this.state.player.energy >= skill.energyCost : false;
      const bg = this.add.rectangle(x, 594, 165, 58, affordable ? 0x20345c : 0x29293b)
        .setStrokeStyle(1, ELEMENT_COLORS[skill.element])
        .setInteractive({ useHandCursor: true });
      const name = this.add.text(x, 582, skill.name.zh, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: affordable ? "#ffffff" : "#89899c",
      }).setOrigin(0.5);
      const stats = this.add.text(x, 606, `威力 ${skill.power} · 能量 ${skill.energyCost}`, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#9aa0c0",
      }).setOrigin(0.5);
      bg.on("pointerdown", () => this.takeTurn(skill));
      this.actionLayer.add([bg, name, stats]);
    });
  }

  private takeTurn(playerSkill: ActiveSkill) {
    if (!this.state || this.busy || this.state.phase !== "choosing") return;
    const enemySkill = chooseEnemySkill(this.state.enemy, activeSkillsById);
    if (!enemySkill) return;
    this.busy = true;
    this.state = resolveTurn(this.state, playerSkill, enemySkill);
    if (this.state.phase === "victory") {
      const save = recordBattleWin(loadGame(localStorage));
      saveGame(localStorage, save);
    }
    this.render();
    this.busy = false;
  }

  private captureEnemy(enemyPal: (typeof pals)[number]) {
    if (!this.state || this.captureAttempted) return;
    this.captureAttempted = true;
    const result = attemptCapture({
      hp: this.state.enemy.hp,
      maxHp: this.state.enemy.maxHp,
      rarity: enemyPal.rarity,
      catchRate: enemyPal.catchRate,
    });
    if (result.success) {
      const current = loadGame(localStorage);
      const next = addCapturedPal(current, createPalInstance(enemyPal));
      const persisted = saveGame(localStorage, next);
      this.captureMessage = persisted ? "捕获成功！" : "捕获成功，但存档失败";
    } else {
      this.captureMessage = "捕获失败";
    }
    this.render();
  }

  private makeNavButton(x: number, y: number, label: string, action: () => void) {
    const bg = this.add.rectangle(x, y, 145, 38, 0x0f3460)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: "sans-serif",
      fontSize: "16px",
      color: "#ffffff",
    }).setOrigin(0.5);
    bg.on("pointerdown", action);
    const container = this.add.container(0, 0, [bg, text]);
    return container;
  }
}
