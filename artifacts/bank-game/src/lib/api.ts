// API client — thin wrapper around fetch for game endpoints
const BASE = "/api";

type TokenGetter = () => Promise<string | null>;
let _getToken: TokenGetter | null = null;

export function setTokenGetter(fn: TokenGetter) {
  _getToken = fn;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = _getToken ? await _getToken() : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const { headers: _h, ...restOptions } = options ?? {};
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers,
    ...restOptions,
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
    request<{ success: boolean; sessionComplete: boolean; reward: number; f: number }>(
      "/game/session/action",
      { method: "POST", body: JSON.stringify({ action, skillScore }) },
    ),

  debugResetSession: () =>
    request<{ success: boolean }>("/game/debug/reset-session", { method: "POST" }),

  debugResetAll: () =>
    request<{ success: boolean }>("/game/debug/reset-all", { method: "DELETE" }),
};
