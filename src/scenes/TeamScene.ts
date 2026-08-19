import Phaser from "phaser";
import { pals } from "../data/loadPals";
import {
  TEAM_LIMIT,
  exportSaveBackup,
  importSaveBackup,
  loadGame,
  saveGame,
  toggleTeamMember,
  type GameSave,
  type PalInstance,
} from "../player/playerState";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import { useHealingTonic } from "../base/baseSystem";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";
import { startScene } from "./sceneLoader";
import { getProgressionStats, getTotalExperienceForLevel, MAX_PAL_LEVEL } from "../progression/progression";
import { passiveSkillsById } from "../data/loadPassiveSkills";
import { describePassiveBonuses } from "../passives/passiveEffects";
import { clampScroll } from "../ui/scroll";
import { createTextButton } from "../ui/button";

const GRID_TOP = 190;

export class TeamScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private backupMessage = "";

  constructor() {
    super("TeamScene");
  }

  preload() {
    preloadPalPortraits(this);
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
      .text(450, 28, "我的幻兽队伍", {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.content = this.add.container(0, 0);
    this.render();
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const rows = Math.ceil(this.save.ownedPals.length / 3);
      const contentHeight = GRID_TOP + rows * 138;
      this.content.y = clampScroll(this.content.y, dy, this.scale.height, contentHeight, 20);
    });
  }

  private render() {
    this.content.removeAll(true);
    this.makeBackupButton(720, 110, "导出备份", () => this.downloadBackup());
    this.makeBackupButton(830, 110, "导入备份", () => this.chooseBackup());
    const summary = this.add
      .text(
        450,
        70,
        `队伍 ${this.save.teamIds.length}/${TEAM_LIMIT} · 已拥有 ${this.save.ownedPals.length} · 胜利 ${this.save.progress.battlesWon} · 捕获 ${this.save.progress.captures}`,
        { fontFamily: "sans-serif", fontSize: "15px", color: "#9aa0c0" }
      )
      .setOrigin(0.5);
    this.content.add(summary);
    if (this.backupMessage) {
      const feedback = this.add
        .text(450, 94, this.backupMessage, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#80cbc4",
        })
        .setOrigin(0.5);
      this.content.add(feedback);
    }

    const teamTitle = this.add.text(38, 106, "当前队伍", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#ffffff",
    });
    this.content.add(teamTitle);
    for (let index = 0; index < TEAM_LIMIT; index += 1) {
      const uid = this.save.teamIds[index];
      const instance = this.save.ownedPals.find((pal) => pal.uid === uid);
      const species = instance ? pals.find((pal) => pal.id === instance.speciesId) : undefined;
      const x = 105 + index * 138;
      const slot = this.add
        .rectangle(x, 148, 124, 52, 0x16213e)
        .setStrokeStyle(1, species ? 0x4fc3f7 : 0x303a58);
      const label = this.add
        .text(x, 148, species ? species.name.zh : "空位", {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: species ? "#ffffff" : "#626b88",
        })
        .setOrigin(0.5);
      this.content.add([slot, label]);
    }

    if (this.save.ownedPals.length === 0) {
      const empty = this.add
        .text(450, 290, "还没有捕获幻兽\n赢得战斗后可尝试捕获野生幻兽", {
          fontFamily: "sans-serif",
          fontSize: "20px",
          color: "#9aa0c0",
          align: "center",
          lineSpacing: 8,
        })
        .setOrigin(0.5);
      this.content.add(empty);
      return;
    }

    this.save.ownedPals.forEach((instance, index) => this.makeCard(instance, index));
  }

  private makeBackupButton(x: number, y: number, label: string, action: () => void) {
    this.content.add(
      createTextButton(this, {
        x,
        y,
        width: 98,
        height: 30,
        label,
        onPress: action,
        backgroundColor: 0x354a68,
      })
    );
  }

  private downloadBackup() {
    const blob = new Blob([exportSaveBackup(this.save)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `幻兽远征存档-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    this.backupMessage = "存档备份已导出";
    this.render();
  }

  private chooseBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        if (!file) return;
        void file.text().then((raw) => {
          const imported = importSaveBackup(raw);
          if (!imported) {
            this.backupMessage = "导入失败：不是有效的游戏存档";
          } else if (!saveGame(localStorage, imported)) {
            this.backupMessage = "导入失败：浏览器无法写入存档";
          } else {
            this.save = imported;
            this.backupMessage = "存档已导入并完成兼容迁移";
          }
          this.render();
        });
      },
      { once: true }
    );
    input.click();
  }

  private makeCard(instance: PalInstance, index: number) {
    const species = pals.find((pal) => pal.id === instance.speciesId);
    if (!species) return;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 170 + col * 280;
    const y = GRID_TOP + 54 + row * 138;
    const inTeam = this.save.teamIds.includes(instance.uid);
    const element = species.elements[0] ?? "neutral";
    const stats = getProgressionStats(species, instance.level);
    const levelStart = getTotalExperienceForLevel(instance.level, species.growth.experienceCurve);
    const nextLevel =
      instance.level < MAX_PAL_LEVEL
        ? getTotalExperienceForLevel(instance.level + 1, species.growth.experienceCurve)
        : undefined;
    const bg = this.add.rectangle(x, y, 250, 120, 0x16213e).setStrokeStyle(2, ELEMENT_COLORS[element]);
    const portrait = addPalPortrait(this, species.id, x - 88, y, 76);
    const name = this.add.text(x - 45, y - 48, `${species.name.zh}  Lv.${instance.level}`, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#ffffff",
    });
    const detail = this.add.text(
      x - 45,
      y - 22,
      `${species.elements.map((e) => ELEMENT_LABELS[e]).join("/")} · HP ${instance.currentHp}/${stats.maxHp} · 攻 ${stats.attack} 防 ${stats.defense}`,
      { fontFamily: "sans-serif", fontSize: "13px", color: "#9aa0c0" }
    );
    const button = this.add
      .rectangle(x + 55, y + 40, 112, 30, inTeam ? 0x713b4a : 0x0f5c6e)
      .setInteractive({ useHandCursor: true });
    const buttonText = this.add
      .text(x + 55, y + 40, inTeam ? "移出队伍" : "加入队伍", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    button.on("pointerdown", () => {
      const next = toggleTeamMember(this.save, instance.uid);
      if (next === this.save || (next.teamIds.length === this.save.teamIds.length && !inTeam)) return;
      this.save = next;
      saveGame(localStorage, this.save);
      this.render();
    });
    this.content.add([bg, portrait, name, detail, button, buttonText]);
    const passiveNames = instance.passiveSkillIds
      .map((id) => passiveSkillsById.get(id)?.name.zh ?? id)
      .join("、");
    const passiveEffects = describePassiveBonuses(instance.passiveSkillIds).join("、");
    const passiveText = this.add.text(
      x - 45,
      y - 3,
      passiveNames ? `被动 ${passiveNames}${passiveEffects ? `｜${passiveEffects}` : ""}` : "被动 无",
      { fontFamily: "sans-serif", fontSize: "10px", color: "#ce93d8", wordWrap: { width: 195 } }
    );
    const experienceText = this.add.text(
      x - 45,
      y + 17,
      nextLevel
        ? `经验 ${Math.max(0, instance.experience - levelStart)}/${nextLevel - levelStart}`
        : "经验 MAX",
      { fontFamily: "sans-serif", fontSize: "12px", color: "#80deea" }
    );
    this.content.add([passiveText, experienceText]);
    if (instance.currentHp < stats.maxHp) {
      const heal = this.add
        .rectangle(x - 65, y + 40, 100, 30, 0x49743f)
        .setInteractive({ useHandCursor: true });
      const healText = this.add
        .text(x - 65, y + 40, `治疗 ×${this.save.inventory.healingTonics}`, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      heal.on("pointerdown", () => {
        const next = useHealingTonic(this.save, instance.uid, stats.maxHp);
        if (next === this.save) return;
        this.save = next;
        saveGame(localStorage, this.save);
        this.render();
      });
      this.content.add([heal, healText]);
    }
  }
}
