const SCENE_LABELS: Record<string, string> = {
  DexScene: "幻兽图鉴。可搜索、筛选并前往战斗、队伍、地图、基地、任务或配种。",
  DetailScene: "幻兽详情。",
  PassiveSkillsScene: "被动技能详情。使用滚轮浏览列表。",
  SelectPalScene: "战斗选角。选择一只幻兽开始演示战斗。",
  BattleScene: "回合战斗。选择技能、更换队员，或继续本次探索挂机。",
  TeamScene: "我的队伍。可编组、治疗和管理存档备份。",
  WorldScene: "探索地图。可开启自动巡逻挂机；方向键或 W A S D 移动会停止挂机，按 E 交互。",
  BaseScene: "远征基地。可分配岗位、升级设施和制造道具。",
  BreedingScene: "共鸣孵化所。选择两名父母进行配种。",
  CompareScene: "幻兽属性对比。",
  QuestScene: "远征任务。查看目标并领取已完成任务的奖励。",
  BuildScene: "个体构筑。可解锁技能树、配置主动技能并穿戴装备。",
  ShopScene: "芦灯港商店。可购买用品与装备，并出售掉落物与制造品换取星币。",
};

export function announceGameStatus(message: string): void {
  const region = document.querySelector<HTMLElement>("#game-status");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 0);
}

export function announceScene(sceneKey: string): void {
  announceGameStatus(SCENE_LABELS[sceneKey] ?? `已进入${sceneKey}`);
}

export function prepareGameCanvas(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#game canvas");
  if (!canvas) return;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", "幻兽远征游戏画布");
}
