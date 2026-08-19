import type Phaser from "phaser";

const ASSET_ROOT = "assets/ui/kenney";

export const UI_ASSETS = {
  buttonPrimary: "ui-button-primary",
  buttonAccent: "ui-button-accent",
  panel: "ui-panel",
  check: "ui-check",
} as const;

export function preloadUiAssets(scene: Phaser.Scene): void {
  if (!scene.textures.exists(UI_ASSETS.buttonPrimary))
    scene.load.image(UI_ASSETS.buttonPrimary, `${ASSET_ROOT}/blue_button00.png`);
  if (!scene.textures.exists(UI_ASSETS.buttonAccent))
    scene.load.image(UI_ASSETS.buttonAccent, `${ASSET_ROOT}/yellow_button00.png`);
  if (!scene.textures.exists(UI_ASSETS.panel))
    scene.load.image(UI_ASSETS.panel, `${ASSET_ROOT}/grey_panel.png`);
  if (!scene.textures.exists(UI_ASSETS.check))
    scene.load.image(UI_ASSETS.check, `${ASSET_ROOT}/green_checkmark.png`);
}
