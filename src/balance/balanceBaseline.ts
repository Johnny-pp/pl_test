export const BALANCE_BASELINE = {
  highlandUnlock: {
    battlesWon: 3,
    captures: 2,
  },
  recommendedBossLevel: 8,
  maximumTrainingBattles: 40,
  maximumIncubationMs: 120_000,
  simulatedDexEntries: 500,
  maximumBackupBytes: 1_000_000,
  endgame: {
    /** 终局基线：至少两种构筑在推荐等级下都应通过这些塔层数。 */
    towerFloors: 3,
    recommendedLevel: 40,
  },
} as const;
