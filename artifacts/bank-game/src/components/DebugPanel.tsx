import { useState } from "react";
import { UserState } from "@/lib/engine";
import { api } from "@/lib/api";

interface Props {
  state: UserState;
  onStateChange: (s: UserState) => void;
  onResetPending: () => void;
  onTriggerOnboarding: () => void;
}

export default function DebugPanel({ state, onStateChange, onResetPending, onTriggerOnboarding }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { balances, game } = state;

  async function resetSession() {
    if (busy) return;
    setBusy(true);
    try {
      await api.debugResetSession();
      console.log("[Debug] Session reset in DB");
    } catch (e) {
      console.warn("[Debug] DB reset-session failed, resetting locally only", e);
    }
    onResetPending();
    onStateChange({
      ...state,
      game: {
        ...game,
        lastSessionTime: null,
        sessionInProgress: false,
        water: false,
        sun: false,
        fertilizer: false,
        streakDays: 0,
      },
    });
    setBusy(false);
  }

  function addMoney() {
    onStateChange({
      ...state,
      balances: {
        ...balances,
        active: balances.active + 1000,
        activeEarned: balances.activeEarned + 1000,
      },
    });
  }

  function maxStreak() {
    onStateChange({
      ...state,
      game: { ...game, streakDays: 7 },
    });
  }

  function resetStreak() {
    onStateChange({
      ...state,
      game: { ...game, streakDays: 0 },
    });
  }

  async function clearAll() {
    if (busy) return;
    setBusy(true);
    try {
      await api.debugResetAll();
      console.log("[Debug] All user data deleted from DB");
    } catch (e) {
      console.warn("[Debug] DB reset-all failed", e);
    }
    onResetPending();
    localStorage.clear();
    setBusy(false);
    onTriggerOnboarding();
  }

  const buttons: { label: string; fn: () => void; danger?: boolean }[] = [
    { label: "Сброс сессии", fn: resetSession },
    { label: "+1000 ₽ (активный)", fn: addMoney },
    { label: "Макс серия (7)", fn: maxStreak },
    { label: "Сброс серии", fn: resetStreak },
    { label: "Очистить всё", fn: clearAll, danger: true },
  ];

  return (
    <div className="debug-panel">
      <button className="debug-toggle" onClick={() => setOpen(o => !o)}>
        {open ? "✕ DEV" : "🐞 DEV"}
      </button>

      {open && (
        <div className="debug-body">
          <p className="debug-title">ОТЛАДКА</p>
          <div className="debug-info">
            <span>серия: {game.streakDays}</span>
            <span>активный баланс: {Math.round(balances.active)} ₽</span>
          </div>
          <div className="debug-buttons">
            {buttons.map(b => (
              <button
                key={b.label}
                className={`debug-btn ${b.danger ? "debug-btn-danger" : ""}`}
                onClick={b.fn}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
