import type Phaser from "phaser";
import { UI_ASSETS } from "./assets";
import { UI_THEME } from "./theme";
import { soundEffects } from "../audio/soundEffects";

interface TextButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onPress: () => void;
  backgroundColor?: number;
  fontSize?: string;
  variant?: "primary" | "accent" | "muted" | "danger";
  disabled?: boolean;
}

export function createTextButton(scene: Phaser.Scene, options: TextButtonOptions) {
  const canUseTexture = scene.textures.exists(UI_ASSETS.buttonPrimary);
  const variant = options.variant ?? "primary";
  const tint =
    options.backgroundColor ??
    (variant === "danger"
      ? UI_THEME.colors.danger
      : variant === "muted"
        ? 0x8aabb0
        : variant === "accent"
          ? 0xffffff
          : 0xffffff);
  const background = canUseTexture
    ? scene.add
        .image(options.x, options.y, variant === "accent" ? UI_ASSETS.buttonAccent : UI_ASSETS.buttonPrimary)
        .setDisplaySize(options.width, options.height)
        .setTint(tint)
    : scene.add.rectangle(options.x, options.y, options.width, options.height, tint);
  background.setName("ui-theme-native-button");
  if (!options.disabled) background.setInteractive({ useHandCursor: true });
  else background.setAlpha(0.55);
  const text = scene.add
    .text(options.x, options.y, options.label, {
      fontFamily: UI_THEME.fontFamily,
      fontSize: options.fontSize ?? "13px",
      color: variant === "accent" ? "#5a3b00" : "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setName("ui-theme-native-label");
  if (!options.disabled) {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const baseScales = [background, text].map((t) => ({ x: t.scaleX, y: t.scaleY }));
    const tweenScale = (factor: number, duration: number, yoyo = false) => {
      [background, text].forEach((target, i) => {
        scene.tweens.killTweensOf(target);
        scene.tweens.add({
          targets: target,
          scaleX: baseScales[i].x * factor,
          scaleY: baseScales[i].y * factor,
          duration,
          yoyo,
        });
      });
    };
    if (!reducedMotion) {
      background.on("pointerover", () => {
        soundEffects.play("hover");
        tweenScale(1.035, 80);
      });
      background.on("pointerout", () => tweenScale(1, 80));
    }
    background.on("pointerdown", () => {
      soundEffects.play("click");
      if (!reducedMotion) tweenScale(0.96, 60, true);
      options.onPress();
    });
  }
  return scene.add.container(0, 0, [background, text]);
}

export function createBackButton(scene: Phaser.Scene, label: string, onPress: () => void) {
  return createTextButton(scene, {
    x: 76,
    y: 28,
    width: 126,
    height: 30,
    label: `‹ ${label}`,
    variant: "muted",
    fontSize: "13px",
    onPress,
  }).setDepth(10);
}
