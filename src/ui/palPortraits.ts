import Phaser from "phaser";

const PORTRAIT_KEY = "pal-portraits";
const PORTRAIT_IDS = [1, 2, 4, 11, 15, 17, 22, 23, 26, 28, 29, 30];

export function preloadPalPortraits(scene: Phaser.Scene) {
  if (scene.textures.exists(PORTRAIT_KEY)) return;
  scene.load.spritesheet(PORTRAIT_KEY, "/assets/pal-portraits.png", {
    frameWidth: 362,
    frameHeight: 362,
  });
}

export function addPalPortrait(
  scene: Phaser.Scene,
  palId: number,
  x: number,
  y: number,
  size: number
): Phaser.GameObjects.Image {
  const frame = Math.max(0, PORTRAIT_IDS.indexOf(palId));
  return scene.add.image(x, y, PORTRAIT_KEY, frame).setDisplaySize(size, size);
}
