import Phaser from "phaser";
import { DexScene } from "./scenes/DexScene";
import { loadScene } from "./scenes/sceneLoader";

export async function startGame(): Promise<Phaser.Game> {
  const start = new URLSearchParams(window.location.search).get("start");
  const firstScene = start === "world" ? await loadScene("WorldScene") : DexScene;
  const scenes = firstScene === DexScene ? [DexScene] : [firstScene, DexScene];

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 900,
    height: 640,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 900,
      height: 640,
    },
    backgroundColor: "#1a1a2e",
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    dom: { createContainer: true },
    input: { activePointers: 3 },
    scene: scenes,
  });
}
