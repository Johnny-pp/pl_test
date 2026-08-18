import Phaser from "phaser";
import { DexScene } from "./scenes/DexScene";
import { DetailScene } from "./scenes/DetailScene";
import { PassiveSkillsScene } from "./scenes/PassiveSkillsScene";
import { SelectPalScene } from "./scenes/SelectPalScene";
import { BattleScene } from "./scenes/BattleScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 900,
  height: 640,
  backgroundColor: "#1a1a2e",
  dom: { createContainer: true },
  scene: [DexScene, DetailScene, PassiveSkillsScene, SelectPalScene, BattleScene],
});
