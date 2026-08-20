import Phaser from "phaser";

const PORTRAIT_KEY = "pal-portraits";
const PORTRAIT_IDS = [1, 2, 4, 11, 15, 17, 22, 23, 26, 28, 29, 30];
const HIGHLAND_PORTRAIT_KEY = "pal-portraits-highland";
const HIGHLAND_PORTRAIT_IDS = [34, 35, 36, 37, 38, 39];
const STARTIDE_PORTRAIT_KEY = "pal-portraits-startide";
const STARTIDE_PORTRAIT_IDS = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];

export function preloadPalPortraits(scene: Phaser.Scene) {
  if (!scene.textures.exists(PORTRAIT_KEY)) {
    scene.load.spritesheet(PORTRAIT_KEY, "/assets/pal-portraits.png", {
      frameWidth: 384,
      frameHeight: 384,
    });
  }
  if (!scene.textures.exists(HIGHLAND_PORTRAIT_KEY)) {
    scene.load.spritesheet(HIGHLAND_PORTRAIT_KEY, "/assets/pal-portraits-highland.png", {
      frameWidth: 512,
      frameHeight: 512,
    });
  }
  if (!scene.textures.exists(STARTIDE_PORTRAIT_KEY)) {
    scene.load.spritesheet(STARTIDE_PORTRAIT_KEY, "/assets/pal-portraits-startide.png", {
      frameWidth: 362,
      frameHeight: 362,
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
  if (highlandFrame >= 0) {
    return scene.add.image(x, y, HIGHLAND_PORTRAIT_KEY, highlandFrame).setDisplaySize(size, size);
  }
  const startideFrame = STARTIDE_PORTRAIT_IDS.indexOf(palId);
  if (startideFrame >= 0) {
    return scene.add.image(x, y, STARTIDE_PORTRAIT_KEY, startideFrame).setDisplaySize(size, size);
  }
  const key = PORTRAIT_KEY;
  const frame = Math.max(0, PORTRAIT_IDS.indexOf(palId));
  return scene.add.image(x, y, key, frame).setDisplaySize(size, size);
}
