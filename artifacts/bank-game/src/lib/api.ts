// API client — thin wrapper around fetch for game endpoints
const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...restOptions } = options ?? {};
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders as Record<string, string> ?? {}),
    },
    ...restOptions,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

export interface AuthUser {
  id: number;
  username: string;
  nickname: string;
}

export interface GameStateResponse {
  exists: boolean;
  balances?: {
    standard: number;
    active: number;
    standardEarned: number;
    activeEarned: number;
    totalDaysEarned: number;
    startDate: number;
  };
  game?: {
    lastSessionTime: number | null;
    sessionInProgress: boolean;
    water: boolean;
    sun: boolean;
    fertilizer: boolean;
    streakDays: number;
    missedSessions: number;
    pendingBaseReward: number;
    pendingBonusReward: number;
    pendingStoredSessions: number;
    treeGrowthMM: number;
    treeGrowthRemainder: number;
    playerXP: number;
    playerLevel: number;
  };
  history?: { amount: number; type: "standard" | "active" | "base" | "bonus"; date: string }[];
}

export const api = {
  // Auth
  authMe: () => request<AuthUser>("/auth/me"),
  login: (username: string, password: string) =>
    request<AuthUser>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, nickname: string, password: string) =>
    request<AuthUser>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, nickname, password }),
    }),
  logout: () =>
    request<{ success: boolean }>("/auth/logout", { method: "POST" }),

  // Game
  getState: () => request<GameStateResponse>("/game/state"),

  initAccount: (startingCapital: number) =>
    request<{ success: boolean }>("/game/init", {
      method: "POST",
      body: JSON.stringify({ startingCapital }),
    }),

  accrue: () =>
    request<{ accrued: number; days: number }>("/game/accrue", { method: "POST" }),

  startSession: () =>
    request<{ success: boolean }>("/game/session/start", { method: "POST" }),

  doAction: (action: "water" | "sun" | "fertilizer", skillScore?: number) =>
    request<{
      success: boolean;
      sessionComplete: boolean;
      baseReward: number;
      bonusReward: number;
      storedSessions: number;
      xpGained?: number;
      newLevel?: number;
      prevLevel?: number;
      levelUp?: boolean;
      xpHistory?: import("@/lib/engine").XpHistoryEntry[];
    }>(
      "/game/session/action",
      { method: "POST", body: JSON.stringify({ action, skillScore }) },
    ),

  claim: (type: "base" | "bonus") =>
    request<{ success: boolean; amount: number; treeGrowthMM: number; treeGrowthRemainder: number }>(
      "/game/session/claim",
      { method: "POST", body: JSON.stringify({ type }) },
    ),

  debugAddSessions: () =>
    request<{ success: boolean; missedSessions: number; lastSessionTime: number }>("/game/debug/add-sessions", {
      method: "POST",
    }),

  debugAddXP: (xp: number) =>
    request<{ success: boolean; playerXP: number }>("/game/debug/add-xp", {
      method: "POST",
      body: JSON.stringify({ xp }),
    }),

  debugResetAll: () =>
    request<{ success: boolean }>("/game/debug/reset-all", { method: "DELETE" }),

  getLeaderboard: () =>
    request<{ players: LeaderboardPlayer[] }>("/game/leaderboard"),
};

export interface LeaderboardPlayer {
  rank: number;
  nickname: string;
  xp: number;
  level: number;
  streakDays: number;
  treeGrowthMM: number;
  lastSessionXp: number;
  isMe: boolean;
}
