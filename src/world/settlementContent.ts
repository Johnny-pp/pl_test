import { TILE_SIZE } from "./worldMap.ts";

export type NpcRole = "talk" | "shop" | "healer" | "quest";

export interface NpcDefinition {
  id: string;
  name: string;
  title: string;
  role: NpcRole;
  x: number;
  y: number;
  /** 首次对话时展示的固定台词。 */
  dialogue: string[];
  /** 对话后附加的引导文字。 */
  hint?: string;
}

/** 星潮群岛「芦灯港」安全聚落的原创 NPC。 */
export const SETTLEMENT_NPCS: NpcDefinition[] = [
  {
    id: "npc-alu",
    name: "阿芦",
    title: "灯港商贩",
    role: "shop",
    x: 4 * TILE_SIZE,
    y: 7 * TILE_SIZE,
    dialogue: ["“潮声一响，生意也跟着涨。”", "阿芦拨了拨摊上的珠串，等你挑选。"],
    hint: "可打开商店购买用品，或出售掉落物与制造品换取星币。",
  },
  {
    id: "npc-ying",
    name: "荧",
    title: "疗愈师",
    role: "healer",
    x: 8 * TILE_SIZE,
    y: 11 * TILE_SIZE,
    dialogue: ["“带着伤赶路可不行，歇一歇吧。”", "荧摊开药匣，海风里有淡淡的草药香。"],
    hint: "可为队伍全体回复生命，每次消耗少量星币。",
  },
  {
    id: "npc-bo",
    name: "泊",
    title: "云游旅人",
    role: "quest",
    x: 5 * TILE_SIZE,
    y: 13 * TILE_SIZE,
    dialogue: [
      "“我从云脊一路走来，群岛的风与高地截然不同。”",
      "泊摊开卷着潮痕的地图，向你讲起这一带的传闻。",
    ],
    hint: "前往任务页查看可以接取的支线。",
  },
  {
    id: "npc-tao",
    name: "涛",
    title: "渔人",
    role: "talk",
    x: 10 * TILE_SIZE,
    y: 8 * TILE_SIZE,
    dialogue: ["“涨潮时暗礁会藏起整条水路，只有退潮才见真容。”", "涛把网兜里跃动的鳞光盖得严严实实。"],
    hint: "他惦记着潮位与长明灯，或许愿意讲更多。",
  },
  {
    id: "npc-xi",
    name: "汐",
    title: "守灯长老",
    role: "quest",
    x: 6 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    dialogue: ["“遗迹深处仍有执念未散，别让队伍困在暗处。”", "汐望向沉星遗迹的方向，目光沉静。"],
    hint: "他知道哪些幻兽能破开藤岩、点亮幽洞。",
  },
];

export const npcsById = new Map(SETTLEMENT_NPCS.map((npc) => [npc.id, npc]));

/** 治疗费用：队伍回复到满血所需的星币（与受伤总量无关，固定低价）。 */
export const HEAL_COST = 20;
