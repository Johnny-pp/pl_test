import Phaser from "phaser";
import { pals } from "../data/loadPals";
import {
  TEAM_LIMIT,
  loadGame,
  saveGame,
  toggleTeamMember,
  type GameSave,
  type PalInstance,
} from "../player/playerState";
import { ELEMENT_COLORS, ELEMENT_LABELS } from "../types/elements";

const GRID_TOP = 190;

export class TeamScene extends Phaser.Scene {
  private save!: GameSave;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super("TeamScene");
  }

  create() {
    this.save = loadGame(localStorage);
    this.add.text(18, 18, "< 返回图鉴", {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#4fc3f7",
    }).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("DexScene"));
    this.add.text(450, 28, "我的幻兽队伍", {
      fontFamily: "sans-serif",
      fontSize: "30px",
      color: "#ffffff",
    }).setOrigin(0.5);

    this.content = this.add.container(0, 0);
    this.render();
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const rows = Math.ceil(this.save.ownedPals.length / 3);
      const contentHeight = GRID_TOP + rows * 120;
      const minY = Math.min(0, this.scale.height - contentHeight - 20);
      this.content.y = Phaser.Math.Clamp(this.content.y - dy * 0.5, minY, 0);
    });
  }

  private render() {
    this.content.removeAll(true);
    const summary = this.add.text(450, 70,
      `队伍 ${this.save.teamIds.length}/${TEAM_LIMIT} · 已拥有 ${this.save.ownedPals.length} · 胜利 ${this.save.progress.battlesWon} · 捕获 ${this.save.progress.captures}`,
      { fontFamily: "sans-serif", fontSize: "15px", color: "#9aa0c0" }
    ).setOrigin(0.5);
    this.content.add(summary);

    const teamTitle = this.add.text(38, 106, "当前队伍", {
      fontFamily: "sans-serif", fontSize: "18px", color: "#ffffff",
    });
    this.content.add(teamTitle);
    for (let index = 0; index < TEAM_LIMIT; index += 1) {
      const uid = this.save.teamIds[index];
      const instance = this.save.ownedPals.find((pal) => pal.uid === uid);
      const species = instance ? pals.find((pal) => pal.id === instance.speciesId) : undefined;
      const x = 105 + index * 138;
      const slot = this.add.rectangle(x, 148, 124, 52, 0x16213e).setStrokeStyle(1, species ? 0x4fc3f7 : 0x303a58);
      const label = this.add.text(x, 148, species ? species.name.zh : "空位", {
        fontFamily: "sans-serif", fontSize: "14px", color: species ? "#ffffff" : "#626b88",
      }).setOrigin(0.5);
      this.content.add([slot, label]);
    }

    if (this.save.ownedPals.length === 0) {
      const empty = this.add.text(450, 290, "还没有捕获幻兽\n赢得战斗后可尝试捕获野生幻兽", {
        fontFamily: "sans-serif", fontSize: "20px", color: "#9aa0c0", align: "center", lineSpacing: 8,
      }).setOrigin(0.5);
      this.content.add(empty);
      return;
    }

    this.save.ownedPals.forEach((instance, index) => this.makeCard(instance, index));
  }

  private makeCard(instance: PalInstance, index: number) {
    const species = pals.find((pal) => pal.id === instance.speciesId);
    if (!species) return;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 170 + col * 280;
    const y = GRID_TOP + 48 + row * 120;
    const inTeam = this.save.teamIds.includes(instance.uid);
    const element = species.elements[0] ?? "neutral";
    const bg = this.add.rectangle(x, y, 250, 96, 0x16213e).setStrokeStyle(2, ELEMENT_COLORS[element]);
    const name = this.add.text(x - 105, y - 34, `${species.name.zh}  Lv.${instance.level}`, {
      fontFamily: "sans-serif", fontSize: "18px", color: "#ffffff",
    });
    const detail = this.add.text(x - 105, y - 7,
      `${species.elements.map((e) => ELEMENT_LABELS[e]).join("/")} · HP ${instance.currentHp}/${species.stats.hp}`,
      { fontFamily: "sans-serif", fontSize: "13px", color: "#9aa0c0" }
    );
    const button = this.add.rectangle(x + 55, y + 25, 112, 30, inTeam ? 0x713b4a : 0x0f5c6e)
      .setInteractive({ useHandCursor: true });
    const buttonText = this.add.text(x + 55, y + 25, inTeam ? "移出队伍" : "加入队伍", {
      fontFamily: "sans-serif", fontSize: "14px", color: "#ffffff",
    }).setOrigin(0.5);
    button.on("pointerdown", () => {
      const next = toggleTeamMember(this.save, instance.uid);
      if (next === this.save || next.teamIds.length === this.save.teamIds.length && !inTeam) return;
      this.save = next;
      saveGame(localStorage, this.save);
      this.render();
    });
    this.content.add([bg, name, detail, button, buttonText]);
  }
}
