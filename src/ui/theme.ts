import Phaser from "phaser";
import { loadSettings } from "../settings/settings";

export const UI_THEME = {
  colors: {
    skyTop: 0xc7f0ea,
    skyBottom: 0x79cbd1,
    surface: 0xfffbeb,
    surfaceAlt: 0xe9f7e9,
    surfaceMuted: 0xd9ebdf,
    ink: 0x17334d,
    muted: 0x567184,
    faint: 0x78909c,
    line: 0x71b5aa,
    primary: 0x178f91,
    primaryDark: 0x0d6f76,
    accent: 0xf1aa3c,
    success: 0x3d8d55,
    danger: 0xc44555,
  },
  fontFamily: '"Trebuchet MS", "Microsoft YaHei", sans-serif',
} as const;

const LEGACY_TEXT_COLORS = new Map<string, string>([
  ["#ffffff", "#17334d"],
  ["#fff", "#17334d"],
  ["#e8eaf6", "#17334d"],
  ["#d8def8", "#294c61"],
  ["#cccccc", "#385a6e"],
  ["#c0c4e0", "#385a6e"],
  ["#b8c0df", "#385a6e"],
  ["#aaaaaa", "#607b88"],
  ["#9aa0c0", "#567184"],
  ["#8a8aa0", "#607b88"],
  ["#888888", "#71838c"],
  ["#747b91", "#71838c"],
  ["#68718e", "#71838c"],
  ["#626b88", "#71838c"],
  ["#4fc3f7", "#087d84"],
  ["#80deea", "#087d84"],
  ["#80cbc4", "#237c70"],
  ["#9ccc65", "#347d4b"],
  ["#ffd54f", "#a9680c"],
  ["#ffcc80", "#a9680c"],
  ["#ffb74d", "#b45c19"],
  ["#f48fb1", "#ad466c"],
  ["#ce93d8", "#765297"],
  ["#b39ddb", "#765297"],
  ["#ff8a80", "#bd3f4e"],
  ["#89899c", "#71838c"],
  ["#777b8d", "#71838c"],
]);

const LEGACY_FILL_COLORS = new Map<number, number>([
  [0x16213e, UI_THEME.colors.surface],
  [0x0f1830, UI_THEME.colors.surfaceAlt],
  [0x0b1224, UI_THEME.colors.surface],
  [0x17233e, UI_THEME.colors.surfaceMuted],
  [0x18284a, UI_THEME.colors.surfaceAlt],
  [0x151b2e, 0xe4ece3],
  [0x301f38, 0xf1d9d2],
  [0x354a68, 0x8aabb0],
  [0x713b4a, 0xf3bdc4],
  [0x0f5c6e, 0x93d6d0],
  [0x244b52, 0xb8ded8],
  [0x20345c, 0xb9d4e4],
  [0x203f5c, 0xb9d4e4],
  [0x29293b, 0xd9e4e6],
  [0x303a58, 0xaabcc5],
  [0x4f6280, 0xaabcc5],
  [0x49743f, 0xb8dfb9],
  [0x0f3460, 0x93d6d0],
  [0x0f4660, 0x93d6d0],
  [0x6d5b18, UI_THEME.colors.accent],
]);

const THEMED_OBJECT = Symbol("themed-object");

type ThemedGameObject = Phaser.GameObjects.GameObject & { [THEMED_OBJECT]?: boolean };

// 目标文字渲染分辨率：游戏固定以 900×640 绘制，再按 Scale.FIT 放大到窗口。
// 若不提升文字自身分辨率，放大后的位图会被浏览器拉伸而变模糊。这里按
// “画布放大倍率 × devicePixelRatio”计算目标分辨率（限制在 2..4，避免过高内存）。
let targetTextResolution = 2;

function updateTextResolutionTarget(scene: Phaser.Scene): void {
  const scale = scene.scale;
  const base = scale.gameSize.width || scale.baseSize.width || 900;
  const upscale = base > 0 ? scale.displaySize.width / base : 1;
  targetTextResolution = Math.max(2, Math.min(4, Math.ceil((window.devicePixelRatio || 1) * upscale)));
}

function ensureTextResolution(object: ThemedGameObject): void {
  if (!(object instanceof Phaser.GameObjects.Text)) return;
  const current = object.style.resolution || 1;
  if (current !== targetTextResolution) object.setResolution(targetTextResolution);
}

export function installSceneTheme(scene: Phaser.Scene): void {
  const highContrast = loadSettings(localStorage).highContrast;
  updateTextResolutionTarget(scene);
  scene.cameras.main.setBackgroundColor(highContrast ? 0x0b1d33 : UI_THEME.colors.skyBottom);
  const backdrop = scene.add.graphics().setDepth(-1000).setScrollFactor(0).setName("ui-theme-backdrop");
  if (highContrast) {
    backdrop.fillStyle(0x0b1d33, 1);
    backdrop.fillRect(0, 0, scene.scale.width, scene.scale.height);
  } else {
    backdrop.fillGradientStyle(
      UI_THEME.colors.skyTop,
      UI_THEME.colors.skyTop,
      UI_THEME.colors.skyBottom,
      UI_THEME.colors.skyBottom,
      1
    );
    backdrop.fillRect(0, 0, scene.scale.width, scene.scale.height);
    backdrop.fillStyle(0xffffff, 0.28);
    backdrop.fillCircle(70, 78, 68);
    backdrop.fillCircle(126, 56, 42);
    backdrop.fillCircle(scene.scale.width - 42, scene.scale.height - 35, 94);
    backdrop.lineStyle(3, 0xffffff, 0.18);
    backdrop.strokeCircle(scene.scale.width - 100, 92, 54);
  }

  const apply = () =>
    scene.children.list.forEach((child) => themeObject(child as ThemedGameObject, highContrast));
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, apply);
  const onResize = () => updateTextResolutionTarget(scene);
  scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, apply);
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
  });
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  apply();
}

function themeObject(object: ThemedGameObject, highContrast: boolean): void {
  ensureTextResolution(object);
  if (object.name.startsWith("ui-theme-")) return;
  if (object instanceof Phaser.GameObjects.Container) {
    object.list.forEach((child) => themeObject(child as ThemedGameObject, highContrast));
    return;
  }
  if (object[THEMED_OBJECT]) return;
  object[THEMED_OBJECT] = true;

  if (highContrast) {
    if (object instanceof Phaser.GameObjects.Text) {
      object.setFontFamily(UI_THEME.fontFamily);
      if (object.style.color === "#567184" || object.style.color === "#71838c") object.setColor("#c7d6e6");
      return;
    }
    if (object instanceof Phaser.GameObjects.Rectangle || object instanceof Phaser.GameObjects.Arc) {
      if (object.fillColor === 0x0f1830 || object.fillColor === 0x151b2e) object.setFillStyle(0x14263f, 1);
      if (object.strokeColor !== 0) object.setStrokeStyle(object.lineWidth || 1, 0x4fc3f7, 1);
    }
    return;
  }

  if (object instanceof Phaser.GameObjects.Text) {
    object.setFontFamily(UI_THEME.fontFamily);
    const mapped =
      typeof object.style.color === "string"
        ? LEGACY_TEXT_COLORS.get(object.style.color.toLowerCase())
        : undefined;
    if (mapped) object.setColor(mapped);
    return;
  }

  if (object instanceof Phaser.GameObjects.Rectangle || object instanceof Phaser.GameObjects.Arc) {
    const mappedFill = LEGACY_FILL_COLORS.get(object.fillColor);
    if (mappedFill !== undefined) object.setFillStyle(mappedFill, Math.max(object.fillAlpha, 0.94));
    const mappedStroke = LEGACY_FILL_COLORS.get(object.strokeColor);
    if (mappedStroke !== undefined) object.setStrokeStyle(object.lineWidth || 1, UI_THEME.colors.line, 1);
  }
}

export function addSceneTitle(scene: Phaser.Scene, title: string): Phaser.GameObjects.Text {
  return scene.add
    .text(scene.scale.width / 2, 28, title, {
      fontFamily: UI_THEME.fontFamily,
      fontSize: "30px",
      fontStyle: "bold",
      color: "#17334d",
      stroke: "#fffbed",
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(5);
}

export function addEntranceMotion(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject): void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const transform = target as Phaser.GameObjects.GameObject &
    Phaser.GameObjects.Components.Transform &
    Phaser.GameObjects.Components.Alpha;
  transform.setAlpha(0);
  transform.y += 8;
  scene.tweens.add({ targets: transform, alpha: 1, y: transform.y - 8, duration: 220, ease: "Sine.Out" });
}
