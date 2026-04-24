// ============================================================
//  SINGLE SOURCE OF TRUTH — all calculations live here
//  UI must NOT compute anything; call these functions instead
// ============================================================

export const APP_VERSION = "v0.4";
export const APP_NAME = "Bank";

// ---- Constants ----
export const SESSION_COOLDOWN_MS = 8 * 60 * 60 * 1000;
export const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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
  };
  history: { date: string; amount: number; type: "standard" | "active" }[];
}

// ---- Income formulas ----
export function calcStandardDaily(standardBalance: number): number {
  return standardBalance * 0.12 / 365;
}

export function calcActiveDaily(activeBalance: number): number {
  return activeBalance * 0.15 / 365;
}

// ---- Session reward formula (single source of truth) ----
// F = baseBonus + skillResult + streakBonus, capped at 100%
// sessionReward = dailyIncome * (F / 100) / 3
//
// baseBonus:    10k→8%  100k→10%  1M→12%
// skillResult:  0–80% (80 = all 3 mini-game actions completed)
// streakBonus:  1% per consecutive day, max 7%
export function calcSessionReward(
  activeBalance: number,
  totalBalance: number,
  streakDays: number = 0,
  skillResult: number = 80,
): number {
  const baseBonus = totalBalance >= 1_000_000 ? 12 : totalBalance >= 100_000 ? 10 : 8;
  const streakBonus = Math.min(Math.max(Math.floor(streakDays), 0), 7);
  const F = Math.min(baseBonus + skillResult + streakBonus, 100);
  const dailyIncome = calcActiveDaily(activeBalance);
  return dailyIncome * (F / 100) / 3;
}

// ---- Tree progression ----
// Growth speed depends on balance size (higher balance = faster tree growth)
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
    type: "standard" as const,
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
