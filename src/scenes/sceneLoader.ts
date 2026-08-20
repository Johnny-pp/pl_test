import type Phaser from "phaser";
import { announceScene } from "../ui/accessibility";

type SceneLoader = () => Promise<typeof Phaser.Scene>;

const sceneLoaders: Record<string, SceneLoader> = {
  DetailScene: () => import("./DetailScene").then((module) => module.DetailScene),
  PassiveSkillsScene: () => import("./PassiveSkillsScene").then((module) => module.PassiveSkillsScene),
  SelectPalScene: () => import("./SelectPalScene").then((module) => module.SelectPalScene),
  BattleScene: () => import("./BattleScene").then((module) => module.BattleScene),
  TeamScene: () => import("./TeamScene").then((module) => module.TeamScene),
  WorldScene: () => import("./WorldScene").then((module) => module.WorldScene),
  BaseScene: () => import("./BaseScene").then((module) => module.BaseScene),
  BreedingScene: () => import("./BreedingScene").then((module) => module.BreedingScene),
  CompareScene: () => import("./CompareScene").then((module) => module.CompareScene),
  QuestScene: () => import("./QuestScene").then((module) => module.QuestScene),
  BuildScene: () => import("./BuildScene").then((module) => module.BuildScene),
};

export async function loadScene(key: string): Promise<typeof Phaser.Scene> {
  const loader = sceneLoaders[key];
  if (!loader) throw new Error(`未知场景：${key}`);

  return loader();
}

export async function startScene(current: Phaser.Scene, key: string, data?: object): Promise<void> {
  if (!current.scene.manager.keys[key]) {
    const SceneClass = await loadScene(key);
    current.scene.add(key, SceneClass, false);
  }
  announceScene(key);
  current.scene.start(key, data);
}
