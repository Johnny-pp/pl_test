import type { ElementType, WorkType } from "./pal";

export const ELEMENT_COLORS: Record<ElementType, number> = {
  neutral: 0xb0b0b0,
  fire: 0xff6b35,
  water: 0x4fc3f7,
  grass: 0x66bb6a,
  electric: 0xffd54f,
  ice: 0x80deea,
  ground: 0xc2a36b,
  wind: 0x9ccc65,
  dark: 0x7e57c2,
  dragon: 0xef5350,
  rock: 0xa1887f,
  normal: 0xcfd8dc,
};

export const ELEMENT_LABELS: Record<ElementType, string> = {
  neutral: "无",
  fire: "火",
  water: "水",
  grass: "草",
  electric: "电",
  ice: "冰",
  ground: "地",
  wind: "风",
  dark: "暗",
  dragon: "龙",
  rock: "岩",
  normal: "普通",
};

export const WORK_LABELS: Record<WorkType, string> = {
  planting: "种植",
  handiwork: "手工",
  gathering: "采集",
  kindling: "点火",
  watering: "浇水",
  transport: "搬运",
  farming: "农业",
  electricity: "发电",
  generating: "生电",
  lumbering: "伐木",
  mining: "采矿",
  medicine: "制药",
  cooling: "冷却",
  sorting: "分拣",
};
