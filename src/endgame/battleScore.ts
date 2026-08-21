/**
 * 终局挑战的战斗评分：以剩余 HP 为主、回合与换宠为负项。
 * 失败记 0 分，保证可解释且可用自动化测试验证。
 */
export interface BattleScoreInput {
  victory: boolean;
  /** 战斗结束时的总回合数。 */
  rounds: number;
  /** 队伍剩余 HP 总和。 */
  totalRemainingHp: number;
  /** 队伍最大 HP 总和。 */
  totalMaxHp: number;
  /** 战斗中的主动换宠次数。 */
  switchCount: number;
  /** 挑战基础难度（敌方层数/等级折算），用于区分低层与高层。 */
  baseLevel: number;
}

export function computeBattleScore(input: BattleScoreInput): number {
  if (!input.victory) return 0;
  const base = 200 + input.baseLevel * 10;
  const hpRatio = input.totalMaxHp > 0 ? input.totalRemainingHp / input.totalMaxHp : 0;
  const hpBonus = Math.round(hpRatio * 300);
  const roundPenalty = input.rounds * 5;
  const switchPenalty = input.switchCount * 8;
  return Math.max(0, Math.floor(base + hpBonus - roundPenalty - switchPenalty));
}

/** 新成绩是否优于现有最佳纪录。 */
export function isBetterScore(best: number | undefined, candidate: number): boolean {
  return candidate > (best ?? 0);
}

/** 保存最佳纪录（无提升时返回原纪录）。 */
export function recordBestScore(
  bestScores: Record<string, number>,
  challengeId: string,
  score: number
): Record<string, number> {
  if (!isBetterScore(bestScores[challengeId], score)) return bestScores;
  return { ...bestScores, [challengeId]: score };
}
