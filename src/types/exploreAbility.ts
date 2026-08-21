export interface ExploreAbility {
  id: string;
  name: {
    zh: string;
    en: string;
  };
  description: string;
}

export const EXPLORE_ABILITY_LABELS: Record<string, string> = {
  "vine-cut": "砍藤",
  "rock-break": "碎岩",
  wading: "涉水",
  glide: "滑翔",
  illuminate: "照明",
};
