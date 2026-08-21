import exploreAbilitiesJson from "../../data/explore-abilities.json";
import type { ExploreAbility } from "../types/exploreAbility";

export const exploreAbilities = exploreAbilitiesJson as ExploreAbility[];

export const exploreAbilitiesById = new Map(exploreAbilities.map((ability) => [ability.id, ability]));
