/** 玩家可配置的设置项，独立于游戏存档持久化到浏览器 localStorage。 */

export interface GameSettings {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  /** 动画速度：normal 正常 / fast 快速 / off 关闭。 */
  animationSpeed: "normal" | "fast" | "off";
  /** 对话与战斗日志的推进速度。 */
  textSpeed: "normal" | "fast";
  /** 减少动态效果（开启后覆盖系统偏好）。 */
  reduceMotion: boolean;
  /** 高对比度/色盲辅助配色。 */
  highContrast: boolean;
  /** 键位重绑定（动作 -> 按键字符，空字符串表示未绑定）。 */
  keyBindings: Record<string, string>;
  /** 当前存档槽位（0/1/2）。 */
  saveSlot: number;
}

export const SETTINGS_STORAGE_KEY = "pl_test_settings";

export const SAVE_SLOT_COUNT = 3;

export const ACTION_LABELS: Record<string, string> = {
  up: "向上移动",
  down: "向下移动",
  left: "向左移动",
  right: "向右移动",
  interact: "交互（E）",
  back: "返回/取消",
};

export const DEFAULT_KEY_BINDINGS: Record<string, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  interact: "KeyE",
  back: "Escape",
};

export function createDefaultSettings(): GameSettings {
  return {
    masterVolume: 0.8,
    bgmVolume: 0.6,
    sfxVolume: 0.8,
    animationSpeed: "normal",
    textSpeed: "normal",
    reduceMotion: false,
    highContrast: false,
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    saveSlot: 0,
  };
}

export function prefersReducedMotion(settings: GameSettings): boolean {
  if (settings.reduceMotion || settings.animationSpeed === "off") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  return false;
}

export function getActionKey(settings: GameSettings, action: string): string {
  const key = settings.keyBindings[action];
  if (key && key.length > 0) return key;
  return DEFAULT_KEY_BINDINGS[action] ?? "";
}

export function setActionKey(settings: GameSettings, action: string, key: string): GameSettings {
  return {
    ...settings,
    keyBindings: { ...settings.keyBindings, [action]: key },
  };
}

function finiteVolume(value: unknown, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, Number(value))) : fallback;
}

function normalizeSettings(value: unknown): GameSettings {
  const defaults = createDefaultSettings();
  if (!value || typeof value !== "object") return defaults;
  const raw = value as Partial<GameSettings>;
  const rawBindings = raw.keyBindings && typeof raw.keyBindings === "object" ? raw.keyBindings : {};
  const keyBindings: Record<string, string> = {};
  for (const [action, key] of Object.entries(DEFAULT_KEY_BINDINGS)) {
    const candidate = (rawBindings as Record<string, unknown>)[action];
    keyBindings[action] = typeof candidate === "string" && candidate.length > 0 ? candidate : key;
  }
  return {
    masterVolume: finiteVolume(raw.masterVolume, defaults.masterVolume),
    bgmVolume: finiteVolume(raw.bgmVolume, defaults.bgmVolume),
    sfxVolume: finiteVolume(raw.sfxVolume, defaults.sfxVolume),
    animationSpeed:
      raw.animationSpeed === "fast" || raw.animationSpeed === "off" ? raw.animationSpeed : "normal",
    textSpeed: raw.textSpeed === "fast" ? "fast" : "normal",
    reduceMotion: raw.reduceMotion === true,
    highContrast: raw.highContrast === true,
    keyBindings,
    saveSlot: Number.isInteger(raw.saveSlot) ? Math.max(0, Math.min(SAVE_SLOT_COUNT - 1, raw.saveSlot!)) : 0,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadSettings(storage: StorageLike): GameSettings {
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(storage: StorageLike, settings: GameSettings): boolean {
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

export function updateSettings(storage: StorageLike, patch: Partial<GameSettings>): GameSettings {
  const next = { ...loadSettings(storage), ...patch };
  saveSettings(storage, next);
  return next;
}

/** 合并系统与设置的综合减少动态效果偏好。 */
export function isReducedMotion(settings: GameSettings): boolean {
  return prefersReducedMotion(settings);
}
