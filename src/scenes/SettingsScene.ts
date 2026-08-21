import Phaser from "phaser";
import { loadSettings, saveSettings, setActionKey, type GameSettings } from "../settings/settings";
import { soundEffects } from "../audio/soundEffects";
import { startScene } from "./sceneLoader";
import { createBackButton, createTextButton } from "../ui/button";
import { addSceneTitle, installSceneTheme } from "../ui/theme";

export class SettingsScene extends Phaser.Scene {
  private settings!: GameSettings;
  private content!: Phaser.GameObjects.Container;
  private message = "";

  constructor() {
    super("SettingsScene");
  }

  create() {
    installSceneTheme(this);
    this.settings = loadSettings(localStorage);
    createBackButton(this, "返回图鉴", () => void startScene(this, "DexScene"));
    addSceneTitle(this, "游戏设置");
    createTextButton(this, {
      x: 815,
      y: 68,
      width: 134,
      height: 32,
      label: "音效预览",
      variant: "accent",
      fontSize: "13px",
      onPress: () => {
        soundEffects.ensureContext();
        soundEffects.play("capture");
        soundEffects.play("levelup");
      },
    });
    this.content = this.add.container(0, 0);
    this.render();
  }

  render() {
    this.content.removeAll(true);
    const s = this.settings;
    this.message = "";
    const volumeRows: { key: "masterVolume" | "bgmVolume" | "sfxVolume"; label: string }[] = [
      { key: "masterVolume", label: "主音量" },
      { key: "bgmVolume", label: "音乐音量" },
      { key: "sfxVolume", label: "音效音量" },
    ];
    volumeRows.forEach((row, index) => {
      const y = 130 + index * 62;
      const value = Math.round(s[row.key] * 100);
      this.content.add(
        this.add
          .text(90, y, `${row.label}：${value}%`, {
            fontFamily: "sans-serif",
            fontSize: "18px",
            color: "#17334d",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        createTextButton(this, {
          x: 620,
          y,
          width: 46,
          height: 32,
          label: "−",
          variant: "muted",
          fontSize: "18px",
          onPress: () => this.adjustVolume(row.key, -0.1),
        })
      );
      this.content.add(
        createTextButton(this, {
          x: 700,
          y,
          width: 46,
          height: 32,
          label: "＋",
          variant: "accent",
          fontSize: "18px",
          onPress: () => this.adjustVolume(row.key, 0.1),
        })
      );
    });

    const toggleRows: { key: "reduceMotion" | "highContrast"; label: string }[] = [
      { key: "reduceMotion", label: "减少动态效果" },
      { key: "highContrast", label: "高对比度（色盲辅助）" },
    ];
    toggleRows.forEach((row, index) => {
      const y = 326 + index * 56;
      this.content.add(
        this.add
          .text(90, y, `${row.label}：${s[row.key] ? "已开启" : "已关闭"}`, {
            fontFamily: "sans-serif",
            fontSize: "17px",
            color: "#17334d",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        createTextButton(this, {
          x: 745,
          y,
          width: 110,
          height: 32,
          label: s[row.key] ? "关闭" : "开启",
          variant: s[row.key] ? "danger" : "accent",
          fontSize: "13px",
          onPress: () => this.toggle(row.key),
        })
      );
    });

    const speedRows: { key: "animationSpeed" | "textSpeed"; label: string; options: string[] }[] = [
      { key: "animationSpeed", label: "动画速度", options: ["normal", "fast", "off"] },
      { key: "textSpeed", label: "文字速度", options: ["normal", "fast"] },
    ];
    speedRows.forEach((row, index) => {
      const y = 452 + index * 56;
      const labelMap: Record<string, string> = {
        normal: "正常",
        fast: "快速",
        off: "关闭",
      };
      const current = s[row.key];
      this.content.add(
        this.add
          .text(90, y, `${row.label}：${labelMap[current] ?? current}`, {
            fontFamily: "sans-serif",
            fontSize: "17px",
            color: "#17334d",
          })
          .setOrigin(0, 0.5)
      );
      this.content.add(
        createTextButton(this, {
          x: 745,
          y,
          width: 110,
          height: 32,
          label: "切换",
          variant: "accent",
          fontSize: "13px",
          onPress: () => this.cycle(row.key, row.options),
        })
      );
    });

    this.content.add(
      this.add
        .text(90, 560, "键位：方向键/WASD 移动、E 交互、Esc 返回；可在设置页重置", {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#567184",
        })
        .setOrigin(0, 0.5)
    );
    this.content.add(
      createTextButton(this, {
        x: 745,
        y: 560,
        width: 150,
        height: 32,
        label: "重置键位",
        variant: "muted",
        fontSize: "13px",
        onPress: () => this.resetKeyBindings(),
      })
    );
    this.content.add(
      this.add
        .text(90, 604, `当前存档槽：${s.saveSlot + 1}`, {
          fontFamily: "sans-serif",
          fontSize: "14px",
          color: "#567184",
        })
        .setOrigin(0, 0.5)
    );
  }

  private persist(next: GameSettings) {
    if (!saveSettings(localStorage, next)) {
      this.message = "设置保存失败：浏览器无法写入";
    }
    this.settings = next;
    soundEffects.setVolumes(next);
    this.render();
  }

  private adjustVolume(key: "masterVolume" | "bgmVolume" | "sfxVolume", delta: number) {
    const nextValue = Math.max(0, Math.min(1, this.settings[key] + delta));
    this.persist({ ...this.settings, [key]: nextValue });
    soundEffects.play("click");
  }

  private toggle(key: "reduceMotion" | "highContrast") {
    this.persist({ ...this.settings, [key]: !this.settings[key] });
    soundEffects.play("click");
  }

  private cycle(key: "animationSpeed" | "textSpeed", options: string[]) {
    const current = this.settings[key];
    const next = options[(options.indexOf(current) + 1) % options.length] as GameSettings[typeof key];
    this.persist({ ...this.settings, [key]: next });
    soundEffects.play("click");
  }

  private resetKeyBindings() {
    const defaults: Record<string, string> = {
      up: "W",
      down: "S",
      left: "A",
      right: "D",
      interact: "E",
      back: "ESC",
    };
    const keyBindings = Object.fromEntries(
      Object.entries(this.settings.keyBindings).map(([action]) => [action, defaults[action] ?? ""])
    );
    this.persist({ ...this.settings, keyBindings });
    soundEffects.play("click");
  }

  // 浏览器验收辅助入口
  doAdjustVolume(key: "masterVolume" | "bgmVolume" | "sfxVolume", delta: number) {
    this.adjustVolume(key, delta);
  }

  doToggle(key: "reduceMotion" | "highContrast") {
    this.toggle(key);
  }

  doCycle(key: "animationSpeed" | "textSpeed", options: string[]) {
    this.cycle(key, options);
  }

  doSetActionKey(action: string, key: string) {
    this.persist(setActionKey(this.settings, action, key));
  }

  doResetKeyBindings() {
    this.resetKeyBindings();
  }
}
