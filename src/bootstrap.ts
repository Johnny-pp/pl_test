import Phaser from "phaser";
import { DexScene } from "./scenes/DexScene";
import { loadScene } from "./scenes/sceneLoader";
import { announceScene, prepareGameCanvas } from "./ui/accessibility";

export async function startGame(): Promise<Phaser.Game> {
  const search = new URLSearchParams(window.location.search);
  const start = search.get("start");
  const firstScene = start === "world" ? await loadScene("WorldScene") : DexScene;
  const scenes = firstScene === DexScene ? [DexScene] : [firstScene, DexScene];
  document.querySelector("#game > .game-loading")?.remove();

  const game = new Phaser.Game({
    type: search.get("renderer") === "canvas" ? Phaser.CANVAS : Phaser.AUTO,
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
  window.setTimeout(prepareGameCanvas, 0);
  announceScene(start === "world" ? "WorldScene" : "DexScene");
  if (search.get("e2e") === "1") {
    window.__PL_TEST__ = {
      game,
      startScene: async (key, data) => {
        if (!game.scene.keys[key]) {
          const SceneClass = await loadScene(key);
          game.scene.add(key, SceneClass, false);
        }
        announceScene(key);
        game.scene.start(key, data);
      },
    };
  }
  return game;
}

declare global {
  interface Window {
    __PL_TEST__?: {
      game: Phaser.Game;
      startScene: (key: string, data?: object) => Promise<void>;
    };
  }
}
