import { useState } from "react";
import { UserState } from "@/lib/engine";

interface Props {
  state: UserState;
  onStateChange: (s: UserState) => void;
  onResetPending: () => void;
}

export default function DebugPanel({ state, onStateChange, onResetPending }: Props) {
  const [open, setOpen] = useState(false);

  const { balances, game } = state;

  function resetSession() {
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
      },
    });
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

  function clearAll() {
    onResetPending();
    onStateChange({
      ...state,
      balances: {
        ...balances,
        standard: 0,
        active: 0,
        standardEarned: 0,
        activeEarned: 0,
        totalDaysEarned: 0,
      },
      game: {
        lastSessionTime: null,
        sessionInProgress: false,
        water: false,
        sun: false,
        fertilizer: false,
        streakDays: 0,
      },
      history: [],
    });
  }

  const buttons: { label: string; fn: () => void; danger?: boolean }[] = [
    { label: "Reset Session", fn: resetSession },
    { label: "+1000 ₽ Active", fn: addMoney },
    { label: "Max Streak (7)", fn: maxStreak },
    { label: "Reset Streak", fn: resetStreak },
    { label: "Clear All Data", fn: clearAll, danger: true },
  ];

  return (
    <div className="debug-panel">
      <button className="debug-toggle" onClick={() => setOpen(o => !o)}>
        {open ? "✕ DEV" : "🐞 DEV"}
      </button>

      {open && (
        <div className="debug-body">
          <p className="debug-title">Debug Panel</p>
          <div className="debug-info">
            <span>streak: {game.streakDays}</span>
            <span>active: {Math.round(balances.active)} ₽</span>
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
