import Phaser from "phaser";
import { pals } from "../data/loadPals";
import { passiveSkills, passiveSkillsById } from "../data/loadPassiveSkills";
import { BREEDING_FOOD_COST, breed, hatchEgg, previewOffspring } from "../breeding/breedingSystem";
import { loadGame, saveGame, type EggQuality, type GameSave, type PalInstance } from "../player/playerState";
import { addPalPortrait, preloadPalPortraits } from "../ui/palPortraits";
import { startScene } from "./sceneLoader";
import { describePassiveBonuses } from "../passives/passiveEffects";
import { clampScroll } from "../ui/scroll";
import { createTextButton } from "../ui/button";

const QUALITY_LABELS: Record<EggQuality, string> = { common: "普通", fine: "优良", radiant: "辉光" };
const QUALITY_COLORS: Record<EggQuality, number> = { common: 0x9aa0c0, fine: 0x4fc3f7, radiant: 0xffb300 };

export class BreedingScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;
  private parentA?: string;
  private parentB?: string;
  private message = "";

  constructor() {
    super("BreedingScene");
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
      .text(450, 28, "共鸣孵化所", {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.render();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.render() });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const rows = Math.ceil(this.save.ownedPals.length / 2);
      this.content.y = clampScroll(this.content.y, dy, this.scale.height, 150 + rows * 100, 20);
    });
  }

  private render() {
    this.content.removeAll(true);
    const first = this.findInstance(this.parentA);
    const second = this.findInstance(this.parentB);
    const firstSpecies = first ? pals.find((pal) => pal.id === first.speciesId) : undefined;
    const secondSpecies = second ? pals.find((pal) => pal.id === second.speciesId) : undefined;
    const offspring =
      firstSpecies && secondSpecies ? previewOffspring(firstSpecies, secondSpecies, pals) : undefined;

    this.addContent(
      this.add.text(
        34,
        66,
        `父母 A：${firstSpecies?.name.zh ?? "未选择"}    父母 B：${secondSpecies?.name.zh ?? "未选择"}`,
        { fontFamily: "sans-serif", fontSize: "16px", color: "#d8def8" }
      )
    );
    this.addContent(
      this.add.text(
        34,
        94,
        offspring
          ? `预计后代：${offspring.name.zh} · 消耗食物 ${BREEDING_FOOD_COST}`
          : "依次点击两个不同个体以预览后代",
        { fontFamily: "sans-serif", fontSize: "15px", color: offspring ? "#9ccc65" : "#9aa0c0" }
      )
    );
    if (offspring) this.addContent(this.makeButton(475, 88, 130, "开始配种", () => this.startBreeding()));
    this.addContent(
      this.add.text(34, 124, this.message, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#ffd54f",
      })
    );

    this.addContent(
      this.add.text(34, 154, "选择父母", {
        fontFamily: "sans-serif",
        fontSize: "19px",
        color: "#ffffff",
      })
    );
    if (this.save.ownedPals.length < 2) {
      this.addContent(
        this.add
          .text(280, 250, "至少需要两个已拥有的幻兽", {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: "#9aa0c0",
          })
          .setOrigin(0.5)
      );
    }
    this.save.ownedPals.forEach((instance, index) => this.makeParentCard(instance, index));

    this.addContent(this.add.rectangle(722, 350, 320, 500, 0x0f1830).setStrokeStyle(1, 0x0f3460));
    this.addContent(
      this.add
        .text(722, 116, `孵化队列 ${this.save.breedingEggs.length}/4`, {
          fontFamily: "sans-serif",
          fontSize: "19px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
    );
    if (this.save.breedingEggs.length === 0) {
      this.addContent(
        this.add
          .text(722, 190, "暂无待孵化的蛋", {
            fontFamily: "sans-serif",
            fontSize: "16px",
            color: "#68718e",
          })
          .setOrigin(0.5)
      );
    }
    this.save.breedingEggs.forEach((egg, index) => {
      const species = pals.find((pal) => pal.id === egg.speciesId);
      const y = 175 + index * 108;
      const remaining = Math.max(0, Math.ceil((egg.hatchAt - Date.now()) / 1000));
      const panel = this.add
        .rectangle(722, y, 282, 92, 0x16213e)
        .setStrokeStyle(2, QUALITY_COLORS[egg.quality]);
      const title = this.add.text(
        596,
        y - 35,
        `${QUALITY_LABELS[egg.quality]}蛋 · ${species?.name.zh ?? "未知"}`,
        {
          fontFamily: "sans-serif",
          fontSize: "16px",
          color: "#ffffff",
        }
      );
      const inherited =
        egg.passiveSkillIds.map((id) => passiveSkillsById.get(id)?.name.zh ?? id).join("、") || "无继承被动";
      const inheritedEffect = describePassiveBonuses(egg.passiveSkillIds).join("、");
      const info = this.add.text(596, y - 9, `${inherited}${inheritedEffect ? `｜${inheritedEffect}` : ""}`, {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#9aa0c0",
      });
      const action = remaining === 0 ? "立即孵化" : `${remaining} 秒`;
      const button = this.makeButton(722, y + 25, 120, action, () => remaining === 0 && this.hatch(egg.id));
      this.addContent(panel, title, info, button);
    });
  }

  private makeParentCard(instance: PalInstance, index: number) {
    const species = pals.find((pal) => pal.id === instance.speciesId);
    if (!species) return;
    const x = 155 + (index % 2) * 275;
    const y = 205 + Math.floor(index / 2) * 92;
    const role = instance.uid === this.parentA ? "A" : instance.uid === this.parentB ? "B" : "";
    const bg = this.add
      .rectangle(x, y, 250, 76, role ? 0x244b52 : 0x16213e)
      .setStrokeStyle(2, role ? 0xffd54f : 0x0f3460)
      .setInteractive({ useHandCursor: true });
    const portrait = addPalPortrait(this, species.id, x - 92, y, 62);
    const name = this.add.text(
      x - 56,
      y - 27,
      `${role ? `[${role}] ` : ""}${species.name.zh} Lv.${instance.level}`,
      {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#ffffff",
      }
    );
    const passives =
      instance.passiveSkillIds.map((id) => passiveSkillsById.get(id)?.name.zh ?? id).join("、") || "无被动";
    const effects = describePassiveBonuses(instance.passiveSkillIds).join("、");
    const detail = this.add.text(x - 56, y + 3, `${passives}${effects ? `｜${effects}` : ""}`, {
      fontFamily: "sans-serif",
      fontSize: "12px",
      color: "#9aa0c0",
    });
    bg.on("pointerdown", () => this.selectParent(instance.uid));
    this.addContent(bg, portrait, name, detail);
  }

  private selectParent(uid: string) {
    if (!this.parentA || (this.parentA && this.parentB)) {
      this.parentA = uid;
      this.parentB = undefined;
    } else if (uid !== this.parentA) {
      this.parentB = uid;
    }
    this.message = "";
    this.render();
  }

  private startBreeding() {
    if (!this.parentA || !this.parentB) return;
    const result = breed(
      this.save,
      this.parentA,
      this.parentB,
      pals,
      passiveSkills.map((skill) => skill.id)
    );
    if (result.error) {
      const labels = {
        "same-parent": "不能选择同一个体",
        "missing-parent": "父母不存在",
        "missing-species": "物种数据缺失",
        "insufficient-food": "食物不足",
        "queue-full": "孵化队列已满",
      };
      this.message = labels[result.error];
    } else {
      this.save = result.save;
      saveGame(localStorage, this.save);
      this.message = "共鸣蛋已加入孵化队列";
      this.parentA = undefined;
      this.parentB = undefined;
    }
    this.render();
  }

  private hatch(eggId: string) {
    const next = hatchEgg(this.save, eggId, pals);
    if (next === this.save) return;
    this.save = next;
    saveGame(localStorage, this.save);
    this.message = "孵化完成，新个体已进入收藏";
    this.render();
  }

  private findInstance(uid?: string) {
    return this.save.ownedPals.find((pal) => pal.uid === uid);
  }

  private makeButton(x: number, y: number, width: number, label: string, action: () => void) {
    return createTextButton(this, { x, y, width, height: 30, label, onPress: action });
  }

  private addContent(...objects: Phaser.GameObjects.GameObject[]) {
    this.content.add(objects);
  }
}
