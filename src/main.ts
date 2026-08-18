import Phaser from "phaser";
import { DexScene } from "./scenes/DexScene";
import { DetailScene } from "./scenes/DetailScene";
import { PassiveSkillsScene } from "./scenes/PassiveSkillsScene";
import { SelectPalScene } from "./scenes/SelectPalScene";
import { BattleScene } from "./scenes/BattleScene";
import { TeamScene } from "./scenes/TeamScene";
import { WorldScene } from "./scenes/WorldScene";
import { BaseScene } from "./scenes/BaseScene";
import { BreedingScene } from "./scenes/BreedingScene";
import { CompareScene } from "./scenes/CompareScene";

const defaultScenes = [
  DexScene,
  DetailScene,
  PassiveSkillsScene,
  SelectPalScene,
  BattleScene,
  TeamScene,
  WorldScene,
  BaseScene,
  BreedingScene,
  CompareScene,
];
const scenes =
  new URLSearchParams(window.location.search).get("start") === "world"
    ? [WorldScene, ...defaultScenes.filter((scene) => scene !== WorldScene)]
    : defaultScenes;

new Phaser.Game({
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
