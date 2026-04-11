// API client — thin wrapper around fetch for game endpoints
const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
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
    streakDays: number;
    sun: boolean;
    fertilizer: boolean;
  };
  history?: { amount: number; type: "standard" | "active"; date: string }[];
}

export const api = {
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
    request<{ success: boolean; sessionComplete: boolean; reward: number }>(
      "/game/session/action",
      { method: "POST", body: JSON.stringify({ action, skillScore }) },
    ),
};
