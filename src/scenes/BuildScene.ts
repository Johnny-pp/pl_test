import Phaser from "phaser";
import { loadGame, saveGame, type GameSave, type PalInstance } from "../player/playerState";
import { pals } from "../data/loadPals";
import { activeSkillsById } from "../data/loadActiveSkills";
import { passiveSkillsById } from "../data/loadPassiveSkills";
import { equipmentDefinitionsById } from "../data/loadEquipment";
import {
  describeBuildBonuses,
  equipSkill,
  getAvailableSkillPoints,
  getEquippedSkillIds,
  getFinalBuildStats,
  getResetCost,
  getSkillPointTotal,
  getSpeciesSkillTree,
  isBaseSkill,
  resetSkillTree,
  unequipSkill,
  unlockNode,
} from "../build/buildSystem";
import { equipItem, unequipItem, getEquipmentRarityLabel } from "../build/equipment";
import { describeBuildSources } from "../build/buildCombatant";
import { describePassiveBonuses } from "../passives/passiveEffects";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";
import { EQUIPMENT_SLOT_LABELS, type EquipmentSlot, type SkillTreeNode } from "../types/skillTree";
import { startScene } from "./sceneLoader";
import { createBackButton, createTextButton } from "../ui/button";
import { addSceneTitle, installSceneTheme } from "../ui/theme";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";
import { preloadUiAssets } from "../ui/assets";
import { clampScroll } from "../ui/scroll";
import { triggerOnboardingStep } from "../onboarding/onboarding";

const NODE_COLORS = {
  attribute: 0x66bb6a,
  active: 0x4fc3f7,
  passive: 0xffb300,
} as const;

interface BuildSceneData {
  uid: string;
}

export class BuildScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private instance?: PalInstance;
  private message = "";
  private equipmentSlot: EquipmentSlot | undefined;

  constructor() {
    super("BuildScene");
  }

  preload() {
    preloadPalPortraits(this);
    preloadUiAssets(this);
  }

  create(data: BuildSceneData) {
    installSceneTheme(this);
    triggerOnboardingStep(localStorage, "build");
    this.save = loadGame(localStorage);
    this.instance = this.save.ownedPals.find((pal) => pal.uid === data.uid);
    this.equipmentSlot = undefined;
    createBackButton(this, "返回队伍", () => void startScene(this, "TeamScene"));
    addSceneTitle(this, "个体构筑");
    this.content = this.add.container(0, 0);
    this.render();
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.content.y = clampScroll(this.content.y, dy, this.scale.height, 760, 20);
    });
  }

  private render() {
    this.content.removeAll(true);
    if (!this.instance) {
      this.content.add(
        this.add.text(450, 300, "未找到该个体", { fontSize: "20px", color: "#fff" }).setOrigin(0.5)
      );
      return;
    }
    const species = pals.find((pal) => pal.id === this.instance?.speciesId);
    if (!species) return;
    const tree = getSpeciesSkillTree(species, activeSkillsById, passiveSkillsById);
    const totalPoints = getSkillPointTotal(this.instance.level);
    const available = getAvailableSkillPoints(this.instance, tree);
    const equipped = getEquippedSkillIds(species, this.instance, tree);
    const finalStats = getFinalBuildStats(species, this.instance, tree, equipmentDefinitionsById, this.save);
    const bonusLabels = describeBuildBonuses(
      this.save,
      this.instance,
      species,
      tree,
      equipmentDefinitionsById
    );
    const sourceLabels = describeBuildSources(this.instance);

    this.content.add(
      this.add.text(40, 66, `${species.name.zh}  Lv.${this.instance.level}`, {
        fontFamily: "sans-serif",
        fontSize: "26px",
        color: "#ffffff",
      })
    );
    this.content.add(
      this.add.text(40, 96, `技能点 ${available}（总 ${totalPoints}）`, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: available > 0 ? "#ffd54f" : "#9aa0c0",
      })
    );
    this.content.add(addPalPortrait(this, species.id, 96, 150, 92));
    if (this.message) {
      this.content.add(
        this.add.text(40, 196, this.message, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#9ccc65",
        })
      );
    }
    this.content.add(
      this.add.text(40, 224, "构筑来源：" + sourceLabels.join("、"), {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#b39ddb",
        wordWrap: { width: 260 },
      })
    );
    const resetCost = getResetCost(this.instance);
    const resetButton = createTextButton(this, {
      x: 150,
      y: 258,
      width: 170,
      height: 34,
      label: `重置技能树 · ${resetCost} 晶体`,
      variant: "danger",
      fontSize: "13px",
      disabled: this.instance.unlockedNodeIds.length === 0,
      onPress: () => this.doReset(species.id),
    });
    this.content.add(resetButton);

    this.renderEquipmentPanel(40, 300);
    this.renderSkillTree(tree, 340, 76);
    this.renderEquippedSkills(tree, 680, 76, equipped);
    this.renderStats(tree, finalStats, bonusLabels, 680, 196);
  }

  private renderEquipmentPanel(x: number, y: number) {
    if (!this.instance) return;
    this.content.add(
      this.add.text(x, y, "装备", { fontFamily: "sans-serif", fontSize: "19px", color: "#ffffff" })
    );
    const slots: EquipmentSlot[] = ["core", "charm", "armor"];
    slots.forEach((slot, index) => {
      const slotY = y + 34 + index * 64;
      const item = this.instance?.equipment?.[slot]
        ? this.save.inventory.equipment.find((entry) => entry.uid === this.instance?.equipment?.[slot])
        : undefined;
      const definition = item ? equipmentDefinitionsById.get(item.equipmentId) : undefined;
      const bg = this.add
        .rectangle(x + 6, slotY, 280, 52, item ? 0x244b52 : 0x16213e)
        .setStrokeStyle(2, item ? ELEMENT_COLORS.neutral : 0x303a58)
        .setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => {
        this.equipmentSlot = this.equipmentSlot === slot ? undefined : slot;
        this.render();
      });
      const name = this.add.text(x + 14, slotY - 13, EQUIPMENT_SLOT_LABELS[slot], {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#9aa0c0",
      });
      const value = definition
        ? `${definition.name.zh}（${getEquipmentRarityLabel(definition.rarity)}）`
        : "空槽位 · 点击选择";
      const valueText = this.add.text(x + 14, slotY + 9, value, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: definition ? "#ffffff" : "#68718e",
      });
      this.content.add([bg, name, valueText]);
      if (item) {
        this.content.add(
          createTextButton(this, {
            x: x + 240,
            y: slotY,
            width: 72,
            height: 26,
            label: "卸下",
            variant: "muted",
            fontSize: "12px",
            onPress: () => this.doUnequip(slot),
          })
        );
      }
    });
    if (this.equipmentSlot) {
      this.renderEquipmentOptions(this.equipmentSlot, x, y + 232);
    }
  }

  private renderEquipmentOptions(slot: EquipmentSlot, x: number, y: number) {
    const owned = this.save.inventory.equipment.filter((item) => {
      const definition = equipmentDefinitionsById.get(item.equipmentId);
      return definition?.slot === slot;
    });
    this.content.add(
      this.add.text(x, y, `选择${EQUIPMENT_SLOT_LABELS[slot]}：`, {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#ffffff",
      })
    );
    if (owned.length === 0) {
      this.content.add(
        this.add.text(x + 14, y + 26, "背包中没有可用的此槽位装备", {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#9aa0c0",
        })
      );
      return;
    }
    owned.forEach((item, index) => {
      const definition = equipmentDefinitionsById.get(item.equipmentId);
      if (!definition) return;
      const itemY = y + 30 + index * 38;
      const bg = this.add
        .rectangle(x + 6, itemY, 280, 30, 0x16213e)
        .setStrokeStyle(1, 0x4f6280)
        .setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => this.doEquip(item.uid, slot));
      const label = this.add.text(
        x + 14,
        itemY,
        `${definition.name.zh} · ${getEquipmentRarityLabel(definition.rarity)}`,
        { fontFamily: "sans-serif", fontSize: "13px", color: "#d8def8" }
      );
      this.content.add([bg, label]);
    });
  }

  private renderSkillTree(tree: SkillTreeNode[], x: number, y: number) {
    if (!this.instance) return;
    const species = pals.find((pal) => pal.id === this.instance?.speciesId);
    if (!species) return;
    this.content.add(
      this.add.text(x, y, "技能树", { fontFamily: "sans-serif", fontSize: "19px", color: "#ffffff" })
    );
    const unlocked = new Set(this.instance.unlockedNodeIds ?? []);
    tree.forEach((node, index) => {
      const nodeY = y + 34 + index * 62;
      const isUnlocked = unlocked.has(node.id);
      const requirementMet = node.requires.every((id) => unlocked.has(id));
      const canAfford = node.cost <= getAvailableSkillPoints(this.instance!, tree);
      const isBaseActiveNode = node.type === "active" && isBaseSkill(species, node.skillId ?? "");
      const typeLabel = node.type === "attribute" ? "属性" : node.type === "active" ? "技能" : "被动";
      const bg = this.add
        .rectangle(x + 6, nodeY, 300, 54, isUnlocked ? 0x244b52 : 0x16213e)
        .setStrokeStyle(2, isUnlocked ? NODE_COLORS[node.type] : requirementMet ? 0x4f6280 : 0x303a58);
      const name = this.add.text(x + 16, nodeY - 14, `${typeLabel} · ${node.name.zh}`, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: isUnlocked ? "#ffffff" : "#d8def8",
      });
      const desc = this.add.text(
        x + 16,
        nodeY + 8,
        isBaseActiveNode
          ? `${node.description}（基础技能，无需解锁）`
          : `${node.description} · 花费 ${node.cost} 点`,
        { fontFamily: "sans-serif", fontSize: "11px", color: isUnlocked ? "#9ccc65" : "#9aa0c0" }
      );
      const prereq =
        node.requires.length > 0 && !requirementMet
          ? this.add.text(x + 16, nodeY + 24, `前置：${node.requires.join("、")}`, {
              fontFamily: "sans-serif",
              fontSize: "10px",
              color: "#ff8a80",
            })
          : null;
      this.content.add([bg, name, desc]);
      if (prereq) this.content.add(prereq);
      if (!isUnlocked && requirementMet && canAfford && !isBaseActiveNode) {
        const button = createTextButton(this, {
          x: x + 280,
          y: nodeY,
          width: 62,
          height: 26,
          label: "解锁",
          variant: "accent",
          fontSize: "12px",
          onPress: () => this.doUnlock(node.id),
        });
        this.content.add(button);
      } else if (node.type === "active" && isUnlocked && node.skillId) {
        const equippedNow = (this.instance?.equippedSkillIds ?? []).includes(node.skillId);
        this.content.add(
          createTextButton(this, {
            x: x + 280,
            y: nodeY,
            width: 62,
            height: 26,
            label: equippedNow ? "卸下" : "装备",
            variant: equippedNow ? "muted" : "primary",
            fontSize: "12px",
            onPress: () => this.toggleSkill(node.skillId!),
          })
        );
      }
    });
  }

  private renderEquippedSkills(tree: SkillTreeNode[], x: number, y: number, equipped: string[]) {
    if (!this.instance) return;
    this.content.add(
      this.add.text(x, y, `已装备主动技能 ${equipped.length}/4`, {
        fontFamily: "sans-serif",
        fontSize: "19px",
        color: "#ffffff",
      })
    );
    const species = pals.find((pal) => pal.id === this.instance?.speciesId);
    if (!species) return;
    equipped.forEach((skillId, index) => {
      const skill = activeSkillsById.get(skillId);
      const node = tree.find((item) => item.skillId === skillId);
      const itemY = y + 34 + index * 46;
      const bg = this.add
        .rectangle(x + 6, itemY, 200, 36, 0x16213e)
        .setStrokeStyle(1, skill ? ELEMENT_COLORS[skill.element] : 0x303a58);
      const label = this.add.text(x + 16, itemY, `${skill?.name.zh ?? skillId}${node ? "" : "（基础）"}`, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffffff",
      });
      this.content.add([bg, label]);
      const remove = createTextButton(this, {
        x: x + 250,
        y: itemY,
        width: 62,
        height: 26,
        label: "卸下",
        variant: "muted",
        fontSize: "12px",
        onPress: () => this.toggleSkill(skillId),
      });
      this.content.add(remove);
    });
    if (equipped.length === 0) {
      this.content.add(
        this.add.text(x, y + 40, "未装备主动技能", {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#9aa0c0",
        })
      );
    }
  }

  private renderStats(
    tree: SkillTreeNode[],
    stats: { maxHp: number; attack: number; defense: number; workSpeed: number; moveSpeed: number },
    bonusLabels: string[],
    x: number,
    y: number
  ) {
    this.content.add(
      this.add.text(x, y, "最终数值", { fontFamily: "sans-serif", fontSize: "19px", color: "#ffffff" })
    );
    const lines = [
      `HP ${stats.maxHp}`,
      `攻击 ${stats.attack}`,
      `防御 ${stats.defense}`,
      `工作速度 ${stats.workSpeed}`,
      `移动速度 ${stats.moveSpeed}`,
    ];
    lines.forEach((line, index) => {
      this.content.add(
        this.add.text(x, y + 28 + index * 22, line, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#d8def8",
        })
      );
    });
    const passiveText = describePassiveBonuses(this.instance?.passiveSkillIds ?? []).join("、");
    if (bonusLabels.length > 0 || passiveText) {
      const bonus = this.add.text(x, y + 28 + lines.length * 22, "加成：", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffd54f",
      });
      const detail = this.add.text(x, y + 28 + lines.length * 22 + 20, bonusLabels.join("、"), {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#9aa0c0",
        wordWrap: { width: 200 },
      });
      this.content.add([bonus, detail]);
    }
    const elements = this.instance
      ? (pals.find((pal) => pal.id === this.instance?.speciesId)?.elements ?? [])
      : [];
    this.content.add(
      this.add.text(x, y + 28 + (lines.length + 3) * 22, "元素：", {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#ffd54f",
      })
    );
    this.content.add(
      this.add.text(
        x,
        y + 28 + (lines.length + 4) * 22,
        elements.map((element) => ELEMENT_LABELS[element]).join("、") || "无",
        {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#d8def8",
        }
      )
    );
  }

  private doUnlock(nodeId: string) {
    if (!this.instance) return;
    const species = pals.find((pal) => pal.id === this.instance?.speciesId);
    if (!species) return;
    const next = unlockNode(
      this.save,
      this.instance.uid,
      nodeId,
      species,
      activeSkillsById,
      passiveSkillsById
    );
    if (next === this.save) {
      this.message = "无法解锁该节点";
    } else {
      this.persist(next);
      this.message = "已解锁节点";
    }
    this.render();
  }

  private toggleSkill(skillId: string) {
    if (!this.instance) return;
    const species = pals.find((pal) => pal.id === this.instance?.speciesId);
    if (!species) return;
    const tree = getSpeciesSkillTree(species, activeSkillsById, passiveSkillsById);
    const currentlyEquipped = this.instance.equippedSkillIds ?? [];
    const next = currentlyEquipped.includes(skillId)
      ? unequipSkill(this.save, this.instance.uid, skillId)
      : equipSkill(this.save, this.instance.uid, skillId, species, tree);
    if (next === this.save) {
      this.message = currentlyEquipped.includes(skillId) ? "该技能为基础技能，无法卸下" : "技能不可用或已满";
    } else {
      this.persist(next);
      this.message = currentlyEquipped.includes(skillId) ? "已卸下技能" : "已装备技能";
    }
    this.render();
  }

  private doEquip(itemUid: string, slot: EquipmentSlot) {
    if (!this.instance) return;
    const next = equipItem(this.save, this.instance.uid, itemUid, slot, equipmentDefinitionsById);
    if (next === this.save) {
      this.message = "装备失败";
    } else {
      this.persist(next);
      this.message = "已装备";
    }
    this.render();
  }

  private doUnequip(slot: EquipmentSlot) {
    if (!this.instance) return;
    const next = unequipItem(this.save, this.instance.uid, slot);
    if (next === this.save) {
      this.message = "卸下失败";
    } else {
      this.persist(next);
      this.message = "已卸下装备，回到背包";
    }
    this.render();
  }

  private doReset(speciesId: number) {
    if (!this.instance) return;
    const species = pals.find((pal) => pal.id === speciesId);
    if (!species) return;
    const next = resetSkillTree(this.save, this.instance.uid, species);
    if (next === this.save) {
      this.message = "晶体不足，无法重置";
    } else {
      this.persist(next);
      this.message = "技能树已重置，技能点已返还";
    }
    this.render();
  }

  private persist(next: GameSave) {
    this.save = next;
    this.instance = next.ownedPals.find((pal) => pal.uid === this.instance?.uid);
    saveGame(localStorage, next);
  }
}
