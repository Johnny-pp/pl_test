import type { ActiveSkill } from "../types/activeSkill.ts";
import { getEffectiveness, getSkillEnergyCost, type BattleState, type Combatant } from "./battleEngine.ts";

function expectedDamageScore(attacker: Combatant, defender: Combatant, skill: ActiveSkill): number {
  const sameTypeBonus = attacker.elements.includes(skill.element) ? 1.2 : 1;
  const effectiveness = getEffectiveness(skill.element, defender.elements);
  const elementBonus = 1 + (attacker.passiveBonuses.elementDamagePercent[skill.element] ?? 0) / 100;
  return skill.power * (skill.accuracy / 100) * sameTypeBonus * effectiveness * elementBonus;
}

export function chooseAutoBattleSkill(
  attacker: Combatant,
  defender: Combatant,
  skillsById: ReadonlyMap<string, ActiveSkill>
): ActiveSkill | undefined {
  const learned = attacker.skillIds
    .map((id, index) => ({ skill: skillsById.get(id), index }))
    .filter((entry): entry is { skill: ActiveSkill; index: number } => Boolean(entry.skill));
  if (learned.length === 0) return undefined;

  const affordable = learned.filter(({ skill }) => getSkillEnergyCost(attacker, skill) <= attacker.energy);
  const candidates = affordable.length > 0 ? affordable : learned;
  return [...candidates].sort((left, right) => {
    if (affordable.length === 0) {
      const costDifference =
        getSkillEnergyCost(attacker, left.skill) - getSkillEnergyCost(attacker, right.skill);
      if (costDifference !== 0) return costDifference;
    }
    const scoreDifference =
      expectedDamageScore(attacker, defender, right.skill) -
      expectedDamageScore(attacker, defender, left.skill);
    if (scoreDifference !== 0) return scoreDifference;
    const costDifference =
      getSkillEnergyCost(attacker, left.skill) - getSkillEnergyCost(attacker, right.skill);
    return costDifference || left.index - right.index;
  })[0]?.skill;
}

export function chooseAutoSwitchIndex(state: BattleState): number | undefined {
  const index = state.playerParty.findIndex(
    (fighter, index) => index !== state.activePlayerIndex && fighter.hp > 0
  );
  return index >= 0 ? index : undefined;
}
