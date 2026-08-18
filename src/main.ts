import Phaser from "phaser";
import { DexScene } from "./scenes/DexScene";
import { DetailScene } from "./scenes/DetailScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 900,
  height: 640,
  backgroundColor: "#1a1a2e",
  scene: [DexScene, DetailScene],
});
