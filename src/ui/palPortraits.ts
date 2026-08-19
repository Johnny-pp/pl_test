import Phaser from "phaser";

const PORTRAIT_KEY = "pal-portraits";
const PORTRAIT_IDS = [1, 2, 4, 11, 15, 17, 22, 23, 26, 28, 29, 30];
const HIGHLAND_PORTRAIT_KEY = "pal-portraits-highland";
const HIGHLAND_PORTRAIT_IDS = [34, 35, 36, 37, 38, 39];

export function preloadPalPortraits(scene: Phaser.Scene) {
  if (!scene.textures.exists(PORTRAIT_KEY)) {
    scene.load.spritesheet(PORTRAIT_KEY, "/assets/pal-portraits.png", {
      frameWidth: 362,
      frameHeight: 362,
    });
  }
  if (!scene.textures.exists(HIGHLAND_PORTRAIT_KEY)) {
    scene.load.spritesheet(HIGHLAND_PORTRAIT_KEY, "/assets/pal-portraits-highland.png", {
      frameWidth: 418,
      frameHeight: 627,
    });
  }
}

export function addPalPortrait(
  scene: Phaser.Scene,
  palId: number,
  x: number,
  y: number,
  size: number
): Phaser.GameObjects.Image {
  const highlandFrame = HIGHLAND_PORTRAIT_IDS.indexOf(palId);
  const key = highlandFrame >= 0 ? HIGHLAND_PORTRAIT_KEY : PORTRAIT_KEY;
  const frame = highlandFrame >= 0 ? highlandFrame : Math.max(0, PORTRAIT_IDS.indexOf(palId));
  return scene.add.image(x, y, key, frame).setDisplaySize(size, size);
}
