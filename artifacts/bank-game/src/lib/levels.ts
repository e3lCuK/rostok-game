// ============================================================
//  LEVEL SYSTEM — single source of truth for all level logic
// ============================================================

export const MAX_LEVEL = 5;

// Total XP required to reach each level (index = level - 1)
export const LEVEL_THRESHOLDS: readonly number[] = [0, 300, 1000, 2500, 5000];

export const LEVEL_NAMES = [
  "Новичок",
  "Садовник",
  "Умелец",
  "Мастер",
  "Хранитель",
] as const;

// XP gained per session = average care percentage (0–100)
export function calcXPGain(
  waterScore: number,  // 0–80
  sunScore: number,    // 0–80
  fertScore: number,   // 0–80
): number {
  const w = Math.round((Math.min(Math.max(waterScore, 0), 80) / 80) * 100);
  const s = Math.round((Math.min(Math.max(sunScore, 0), 80) / 80) * 100);
  const f = Math.round((Math.min(Math.max(fertScore, 0), 80) / 80) * 100);
  return Math.round((w + s + f) / 3);
}

// Level from total accumulated XP (1–5)
export function calcLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

// XP progress within the current level
export interface LevelProgress {
  level: number;
  name: string;
  xpInLevel: number;    // XP earned since this level started
  xpNeeded: number | null;  // XP needed to reach next level (null if max)
  isMax: boolean;
}

export function getLevelProgress(totalXP: number): LevelProgress {
  const level = calcLevel(totalXP);
  const floor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const ceil = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] ?? null : null;
  return {
    level,
    name: LEVEL_NAMES[level - 1] ?? LEVEL_NAMES[0],
    xpInLevel: totalXP - floor,
    xpNeeded: ceil !== null ? ceil - floor : null,
    isMax: level >= MAX_LEVEL,
  };
}
