// ============================================================
//  SINGLE SOURCE OF TRUTH — all calculations live here
//  UI must NOT compute anything; call these functions instead
// ============================================================

export const APP_VERSION = "v0.1";
export const APP_NAME = "Банк";

// ---- Constants ----
export const SESSION_COOLDOWN_MS = 8 * 60 * 60 * 1000;
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
export const SESSIONS_PER_DAY = 3; // 1 session per 8 hours → 3 sessions/day

// Starting capital options
export const CAPITAL_OPTIONS = [20_000, 200_000, 2_000_000] as const;
export type CapitalOption = (typeof CAPITAL_OPTIONS)[number];

// ---- Canonical user state shape ----
export interface UserState {
  balances: {
    standard: number;
    active: number;
    standardEarned: number;
    activeEarned: number;
    totalDaysEarned: number;
    startDate: number;
  };
  game: {
    lastSessionTime: number | null;
    sessionInProgress: boolean;
    water: boolean;
    sun: boolean;
    fertilizer: boolean;
    streakDays: number;
    missedSessions: number;
    pendingBaseReward: number;
    pendingBonusReward: number;
    treeGrowthMM: number;
    treeGrowthRemainder: number;
  };
  history: {
    date: string;
    amount: number;
    type: "standard" | "active" | "base" | "bonus";
  }[];
}

// ---- Income formulas ----
export function calcStandardDaily(standardBalance: number): number {
  return standardBalance * 0.12 / 365;
}

// ---- New economy: missed-sessions cap ----
// Returns bonus cap as a decimal (e.g. 0.03 = 3%)
export function getCap(missedSessions: number): number {
  if (missedSessions <= 3) return 0.03;
  if (missedSessions <= 9) return 0.02;
  if (missedSessions <= 21) return 0.01;
  return 0.005;
}

// ---- Capital part based on total balance ----
export function getCapitalPart(totalBalance: number): number {
  if (totalBalance >= 2_000_000) return 0.20;
  if (totalBalance >= 200_000) return 0.18;
  return 0.16;
}

// ---- Activity bonus degradation (for badge display) ----
// Returns percentage points: 3 / 2 / 1 / 0.5
export function calcActivityBonus(missedSessions: number): number {
  if (missedSessions <= 3) return 3;
  if (missedSessions <= 9) return 2;
  if (missedSessions <= 21) return 1;
  return 0.5;
}

// ---- Estimate bonus percent for UI display (no actual payout) ----
// bonusPercent = cap * skillFactor
// cap = max possible for this activity tier
// skillFactor = 0..1, defaults to 0.5 (average expected performance)
// Pass the real skillFactor after a session for post-session display
export function estimateBonusPercent(missedSessions: number, skillFactor = 0.5): number {
  return getCap(missedSessions) * Math.min(Math.max(skillFactor, 0), 1);
}

// ---- SINGLE reward calculation formula — used everywhere ----
// daily  = balance * rate / 365
// session = daily / SESSIONS_PER_DAY
export interface SessionRewards {
  dailyBase: number;
  dailyBonus: number;
  basePerSession: number;
  bonusPerSession: number;
}

export function calculateRewards(balance: number, bonusPercent: number): SessionRewards {
  const dailyBase = balance * 0.12 / 365;
  const dailyBonus = balance * bonusPercent / 365;
  const basePerSession = dailyBase / SESSIONS_PER_DAY;
  const bonusPerSession = dailyBonus / SESSIONS_PER_DAY;
  return { dailyBase, dailyBonus, basePerSession, bonusPerSession };
}

// ---- Tree progression ----
function balanceMultiplier(total: number): number {
  if (total >= 1_000_000) return 3;
  if (total >= 100_000) return 2;
  return 1;
}

export function getTreeProgress(startDate: number, now: number, totalBalance: number): number {
  const elapsed = now - startDate;
  const effectiveTime = elapsed * balanceMultiplier(totalBalance);
  return Math.min(effectiveTime / ONE_YEAR_MS, 1);
}

export function getTreeStage(progress: number): 0 | 1 | 2 | 3 | 4 {
  if (progress < 0.05) return 0;
  if (progress < 0.2)  return 1;
  if (progress < 0.5)  return 2;
  if (progress < 0.85) return 3;
  return 4;
}

export const TREE_STAGE_NAMES = ["Росток", "Саженец", "Деревце", "Молодое дерево", "Могучее дерево"];

// ---- Session helpers ----
export function isSessionLocked(lastSessionTime: number | null, now: number): boolean {
  if (!lastSessionTime) return false;
  return now - lastSessionTime < SESSION_COOLDOWN_MS;
}

export function getNextSessionTime(lastSessionTime: number | null): number | null {
  if (!lastSessionTime) return null;
  return lastSessionTime + SESSION_COOLDOWN_MS;
}

export function getSessionActionsLeft(game: UserState["game"]): number {
  if (!game.sessionInProgress) return 0;
  let n = 0;
  if (!game.water) n++;
  if (!game.sun) n++;
  if (!game.fertilizer) n++;
  return n;
}

// ---- Tree growth formatter ----
export function formatTreeGrowth(mm: number): string {
  if (mm < 10) return `${mm} мм`;
  if (mm < 1000) return `${(mm / 10).toFixed(1)} см`;
  return `${(mm / 1000).toFixed(2)} м`;
}

// ---- Formatters ----
export function formatRub(n: number): string {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

export function formatTimer(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatCapital(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("ru-RU")} млн ₽`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("ru-RU")} тыс. ₽`;
  return formatRub(n);
}

// ---- Offline accrual (local) — used as optimistic update ----
export function applyOfflineAccrual(state: UserState): { state: UserState; accrued: number } {
  const now = Date.now();
  const { startDate, totalDaysEarned, standard: standardBalance } = state.balances;
  const daysSinceStart = (now - startDate) / 86_400_000;
  const daysToAccrue = Math.floor(daysSinceStart) - totalDaysEarned;
  if (daysToAccrue <= 0) return { state, accrued: 0 };

  const daily = calcStandardDaily(standardBalance);
  const income = daily * daysToAccrue;

  const newHistory = Array.from({ length: daysToAccrue }, (_, i) => ({
    date: new Date(startDate + (totalDaysEarned + i + 1) * 86_400_000).toLocaleDateString("ru-RU"),
    amount: daily,
    type: "standard" as "standard",
  }));

  return {
    accrued: income,
    state: {
      ...state,
      balances: {
        ...state.balances,
        standard: standardBalance + income,
        standardEarned: state.balances.standardEarned + income,
        totalDaysEarned: totalDaysEarned + daysToAccrue,
      },
      history: [...state.history, ...newHistory].slice(-30),
    },
  };
}
