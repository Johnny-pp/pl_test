export type ElementType =
  | "neutral" | "fire" | "water" | "grass" | "electric"
  | "ice" | "ground" | "wind" | "dark" | "dragon"
  | "rock" | "normal";

export type WorkType =
  | "planting" | "handiwork" | "gathering" | "kindling"
  | "watering" | "transport" | "farming" | "electricity"
  | "generating" | "lumbering" | "mining" | "medicine"
  | "cooling" | "sorting";

export interface PalName {
  zh: string;
  en: string;
}

export interface PalStats {
  hp: number;
  attack: number;
  defense: number;
  workSpeed: number;
  moveSpeed: number;
  rideSprintSpeed: number;
  price?: number;
}

export interface WorkSuitability {
  type: WorkType;
  level: number;
}

export interface PartnerSkill {
  name: string;
  description: string;
  ranks?: string[];
}

export interface Drop {
  item: string;
  rate: number;
}

export interface Breeding {
  power: number;
  parents?: [string, string][];
}

export interface Pal {
  id: number;
  name: PalName;
  description?: string;
  rarity: number;
  size?: "small" | "medium" | "large";
  elements: ElementType[];
  catchRate?: number;
  foodAmount?: number;
  stats: PalStats;
  workSuitability: WorkSuitability[];
  partnerSkill?: PartnerSkill;
  /** References data/active-skills.json by id. */
  activeSkills?: string[];
  passiveSkills?: string[];
  drops?: Drop[];
  spawnLocations?: string[];
  breeding?: Breeding;
}
