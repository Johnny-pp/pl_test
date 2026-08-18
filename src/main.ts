import Phaser from "phaser";
import { DexScene } from "./scenes/DexScene";
import { DetailScene } from "./scenes/DetailScene";
import { PassiveSkillsScene } from "./scenes/PassiveSkillsScene";
import { SelectPalScene } from "./scenes/SelectPalScene";
import { BattleScene } from "./scenes/BattleScene";
import { TeamScene } from "./scenes/TeamScene";
import { WorldScene } from "./scenes/WorldScene";

const defaultScenes = [DexScene, DetailScene, PassiveSkillsScene, SelectPalScene, BattleScene, TeamScene, WorldScene];
const scenes = new URLSearchParams(window.location.search).get("start") === "world"
  ? [WorldScene, ...defaultScenes.filter((scene) => scene !== WorldScene)]
  : defaultScenes;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 900,
  height: 640,
  backgroundColor: "#1a1a2e",
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  dom: { createContainer: true },
  scene: scenes,
});
