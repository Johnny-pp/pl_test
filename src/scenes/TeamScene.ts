import Phaser from "phaser";
import { preloadUiAssets } from "../ui/assets";
import { addSceneTitle, installSceneTheme } from "../ui/theme";
import { pals } from "../data/loadPals";
import {
  TEAM_LIMIT,
  exportSaveBackup,
  importSaveBackup,
  loadGame,
  saveGame,
  toggleTeamMember,
  listSaveSlots,
  deleteSaveSlot,
  copySaveSlot,
  createRestorePoint,
  listRestorePoints,
  restoreFromPoint,
  type GameSave,
  type PalInstance,
} from "../player/playerState";
import { loadSettings, saveSettings, SAVE_SLOT_COUNT } from "../settings/settings";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import { useHealingTonic } from "../base/baseSystem";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";
import { startScene } from "./sceneLoader";
import { getProgressionStats, getTotalExperienceForLevel, MAX_PAL_LEVEL } from "../progression/progression";
import { passiveSkillsById } from "../data/loadPassiveSkills";
import { describePassiveBonuses } from "../passives/passiveEffects";
import { activeSkillsById } from "../data/loadActiveSkills";
import { equipmentDefinitionsById } from "../data/loadEquipment";
import {
  getEquippedSkillIds,
  getFinalBuildStats,
  getSpeciesSkillTree,
  getAvailableSkillPoints,
} from "../build/buildSystem";
import { getTeamExploreAbilityIds } from "../explore/gates";
import { soundEffects } from "../audio/soundEffects";
import { EXPLORE_ABILITY_LABELS } from "../types/exploreAbility";
import { clampScroll } from "../ui/scroll";
import { createBackButton, createTextButton } from "../ui/button";

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
    preloadUiAssets(this);
  }

  create() {
    installSceneTheme(this);
    this.save = loadGame(localStorage);
    createBackButton(this, "返回图鉴", () => void startScene(this, "DexScene"));
    addSceneTitle(this, "我的幻兽队伍");

    this.content = this.add.container(0, 0);
    this.render();
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const rows = Math.ceil(this.save.ownedPals.length / 3);
      const contentHeight = GRID_TOP + rows * 150 + 60;
      this.content.y = clampScroll(this.content.y, dy, this.scale.height, contentHeight, 20);
    });
  }

  private render() {
    this.content.removeAll(true);
    this.makeBackupButton(610, 110, "存档槽", () => this.showSlots());
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
    const teamAbilities = [...getTeamExploreAbilityIds(this.save, new Map(pals.map((pal) => [pal.id, pal])))];
    const abilitySummary = this.add
      .text(
        450,
        130,
        teamAbilities.length > 0
          ? `队伍探索能力：${teamAbilities.map((id) => EXPLORE_ABILITY_LABELS[id] ?? id).join("、")}`
          : "队伍探索能力：无（部分机关需要对应能力开启）",
        {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: teamAbilities.length > 0 ? "#9ccc65" : "#9aa0c0",
        }
      )
      .setOrigin(0.5);
    this.content.add(abilitySummary);
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
    const y = GRID_TOP + 74 + row * 150;
    const inTeam = this.save.teamIds.includes(instance.uid);
    const element = species.elements[0] ?? "neutral";
    const stats = getProgressionStats(species, instance.level);
    const tree = getSpeciesSkillTree(species, activeSkillsById, passiveSkillsById);
    const finalStats = getFinalBuildStats(species, instance, tree, equipmentDefinitionsById, this.save);
    const equipped = getEquippedSkillIds(species, instance, tree);
    const skillPoints = getAvailableSkillPoints(instance, tree);
    const levelStart = getTotalExperienceForLevel(instance.level, species.growth.experienceCurve);
    const nextLevel =
      instance.level < MAX_PAL_LEVEL
        ? getTotalExperienceForLevel(instance.level + 1, species.growth.experienceCurve)
        : undefined;
    const bg = this.add.rectangle(x, y, 250, 132, 0x16213e).setStrokeStyle(2, ELEMENT_COLORS[element]);
    const portrait = addPalPortrait(this, species.id, x - 92, y, 76);
    const name = this.add.text(x - 50, y - 56, `${species.name.zh}  Lv.${instance.level}`, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#ffffff",
    });
    const detail = this.add.text(
      x - 50,
      y - 30,
      `${species.elements.map((e) => ELEMENT_LABELS[e]).join("/")} · HP ${instance.currentHp}/${finalStats.maxHp} · 攻 ${finalStats.attack} 防 ${finalStats.defense}`,
      { fontFamily: "sans-serif", fontSize: "13px", color: "#9aa0c0" }
    );
    const button = this.add
      .rectangle(x + 72, y - 2, 100, 28, inTeam ? 0x713b4a : 0x0f5c6e)
      .setInteractive({ useHandCursor: true });
    const buttonText = this.add
      .text(x + 72, y - 2, inTeam ? "移出队伍" : "加入队伍", {
        fontFamily: "sans-serif",
        fontSize: "13px",
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
      x - 50,
      y - 8,
      passiveNames ? `被动 ${passiveNames}${passiveEffects ? `｜${passiveEffects}` : ""}` : "被动 无",
      { fontFamily: "sans-serif", fontSize: "10px", color: "#ce93d8", wordWrap: { width: 175 } }
    );
    const equippedNames = equipped.map((id) => activeSkillsById.get(id)?.name.zh ?? id).join("、");
    const buildText = this.add.text(x - 50, y + 14, `技能点 ${skillPoints} · ${equippedNames || "无技能"}`, {
      fontFamily: "sans-serif",
      fontSize: "11px",
      color: "#80deea",
      wordWrap: { width: 175 },
    });
    const experienceText = this.add.text(
      x - 50,
      y + 34,
      nextLevel
        ? `经验 ${Math.max(0, instance.experience - levelStart)}/${nextLevel - levelStart}`
        : "经验 MAX",
      { fontFamily: "sans-serif", fontSize: "11px", color: "#80deea" }
    );
    const abilities = species.exploreAbilities ?? [];
    const abilityText = this.add.text(
      x - 50,
      y + 52,
      abilities.length > 0
        ? `探索 ${abilities.map((id) => EXPLORE_ABILITY_LABELS[id] ?? id).join("、")}`
        : "",
      { fontFamily: "sans-serif", fontSize: "10px", color: "#ffe082", wordWrap: { width: 175 } }
    );
    this.content.add([passiveText, buildText, experienceText, abilityText]);
    const build = createTextButton(this, {
      x: x + 72,
      y: y + 34,
      width: 100,
      height: 28,
      label: "构筑",
      variant: "primary",
      fontSize: "13px",
      onPress: () => void startScene(this, "BuildScene", { uid: instance.uid }),
    });
    this.content.add(build);
    if (instance.currentHp < stats.maxHp) {
      const heal = this.add
        .rectangle(x - 50, y + 34, 100, 28, 0x49743f)
        .setInteractive({ useHandCursor: true });
      const healText = this.add
        .text(x - 50, y + 34, `治疗 ×${this.save.inventory.healingTonics}`, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      heal.on("pointerdown", () => {
        const next = useHealingTonic(this.save, instance.uid, stats.maxHp);
        if (next === this.save) return;
        soundEffects.play("heal");
        this.save = next;
        saveGame(localStorage, this.save);
        this.render();
      });
      this.content.add([heal, healText]);
    }
  }

  private slotOverlay?: Phaser.GameObjects.Container;

  /** 打开存档槽位与恢复点管理覆盖层。 */
  private showSlots() {
    this.slotOverlay?.destroy(true);
    const overlay = this.add.container(0, 0).setDepth(50);
    overlay.add(
      this.add.rectangle(450, 320, 900, 640, 0x0b1224, 0.85).setInteractive({ useHandCursor: true })
    );
    overlay.add(
      this.add
        .text(450, 40, "存档槽位与恢复点", { fontFamily: "sans-serif", fontSize: "26px", color: "#ffffff" })
        .setOrigin(0.5)
    );
    const slots = listSaveSlots(localStorage);
    const currentSlot = loadSettings(localStorage).saveSlot;
    slots.forEach((info, index) => {
      const y = 96 + index * 56;
      const isCurrent = info.slot === currentSlot;
      const label = isCurrent ? `槽位 ${info.slot + 1}（当前）` : `槽位 ${info.slot + 1}`;
      const detail = info.hasSave ? `拥有 ${info.ownedCount} · 最高 Lv.${info.highestLevel}` : "空槽位";
      overlay.add(
        this.add
          .text(60, y, `${label} · ${detail}`, {
            fontFamily: "sans-serif",
            fontSize: "16px",
            color: "#ffffff",
          })
          .setOrigin(0, 0.5)
      );
      if (!isCurrent) {
        overlay.add(
          createTextButton(this, {
            x: 700,
            y,
            width: 84,
            height: 30,
            label: "切换",
            variant: "accent",
            fontSize: "13px",
            onPress: () => this.switchSlot(info.slot),
          })
        );
      }
      overlay.add(
        createTextButton(this, {
          x: 792,
          y,
          width: 44,
          height: 30,
          label: "复制",
          variant: "muted",
          fontSize: "12px",
          onPress: () => this.copySlot(info.slot),
        })
      );
      overlay.add(
        createTextButton(this, {
          x: 844,
          y,
          width: 44,
          height: 30,
          label: "删除",
          variant: "danger",
          fontSize: "12px",
          onPress: () => this.removeSlot(info.slot),
        })
      );
    });

    const restoreY = 96 + SAVE_SLOT_COUNT * 56 + 20;
    overlay.add(
      this.add
        .text(60, restoreY, "恢复点（手动快照，不会互相覆盖）", {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#ffe082",
        })
        .setOrigin(0, 0.5)
    );
    overlay.add(
      createTextButton(this, {
        x: 790,
        y: restoreY,
        width: 120,
        height: 30,
        label: "创建恢复点",
        variant: "accent",
        fontSize: "13px",
        onPress: () => this.createPoint(),
      })
    );
    const points = listRestorePoints(localStorage);
    if (points.length === 0) {
      overlay.add(
        this.add
          .text(60, restoreY + 36, "（暂无恢复点）", {
            fontFamily: "sans-serif",
            fontSize: "14px",
            color: "#9aa0c0",
          })
          .setOrigin(0, 0.5)
      );
    } else {
      points.forEach((label, index) => {
        const y = restoreY + 36 + index * 40;
        overlay.add(
          this.add
            .text(60, y, label, {
              fontFamily: "sans-serif",
              fontSize: "14px",
              color: "#ffffff",
            })
            .setOrigin(0, 0.5)
        );
        overlay.add(
          createTextButton(this, {
            x: 790,
            y,
            width: 84,
            height: 28,
            label: "恢复",
            variant: "accent",
            fontSize: "12px",
            onPress: () => this.restorePoint(label),
          })
        );
        overlay.add(
          createTextButton(this, {
            x: 884,
            y,
            width: 44,
            height: 28,
            label: "删除",
            variant: "danger",
            fontSize: "12px",
            onPress: () => this.removePoint(label),
          })
        );
      });
    }
    overlay.add(
      createTextButton(this, {
        x: 450,
        y: 608,
        width: 140,
        height: 34,
        label: "关闭",
        variant: "muted",
        fontSize: "14px",
        onPress: () => overlay.destroy(true),
      })
    );
    this.slotOverlay = overlay;
  }

  private switchSlot(slot: number) {
    saveSettings(localStorage, { ...loadSettings(localStorage), saveSlot: slot });
    this.slotOverlay?.destroy(true);
    this.save = loadGame(localStorage);
    soundEffects.play("open");
    this.render();
  }

  private copySlot(slot: number) {
    if (copySaveSlot(localStorage, loadSettings(localStorage).saveSlot, slot)) {
      this.backupMessage = `已复制当前存档到槽位 ${slot + 1}`;
    } else {
      this.backupMessage = "复制失败：请确认源槽位有存档";
    }
    this.showSlots();
  }

  private removeSlot(slot: number) {
    deleteSaveSlot(localStorage, slot);
    this.backupMessage = `槽位 ${slot + 1} 已清空`;
    this.showSlots();
  }

  private createPoint() {
    const label = `恢复点-${new Date().toISOString().replace("T", " ").slice(0, 16)}`;
    if (createRestorePoint(localStorage, label)) {
      this.backupMessage = `恢复点「${label}」已创建`;
    } else {
      this.backupMessage = "创建恢复点失败";
    }
    this.showSlots();
  }

  private restorePoint(label: string) {
    const restored = restoreFromPoint(localStorage, label);
    if (restored) {
      this.slotOverlay?.destroy(true);
      this.save = restored;
      this.backupMessage = `已从恢复点「${label}」恢复`;
      soundEffects.play("heal");
      this.render();
    } else {
      this.backupMessage = "恢复失败：恢复点数据无效";
      this.showSlots();
    }
  }

  private removePoint(label: string) {
    localStorage.removeItem(`pl_test_game_restore_${label}`);
    this.backupMessage = `恢复点「${label}」已删除`;
    this.showSlots();
  }
}
