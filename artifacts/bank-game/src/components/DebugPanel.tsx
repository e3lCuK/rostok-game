import { useState } from "react";
import { UserState } from "@/lib/engine";
import { api } from "@/lib/api";

interface Props {
  state: UserState;
  onStateChange: (s: UserState) => void;
  onDeleteAll: () => void;
}

export default function DebugPanel({ state, onStateChange, onDeleteAll }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { game } = state;

  async function resetSession() {
    if (busy) return;
    setBusy(true);
    try {
      await api.debugResetSession();
    } catch (e) {
      console.warn("[Debug] reset-session failed", e);
    }
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
        pendingBaseReward: 0,
        pendingBonusReward: 0,
      },
    });
    setBusy(false);
  }

  async function deleteSession() {
    if (busy) return;
    setBusy(true);
    try {
      await api.debugResetAll();
    } catch (e) {
      console.warn("[Debug] reset-all failed", e);
    }
    localStorage.clear();
    setBusy(false);
    onDeleteAll();
  }

  return (
    <div className="debug-panel">
      <button className="debug-toggle" onClick={() => setOpen(o => !o)}>
        {open ? "✕" : "Отладка"}
      </button>

      {open && (
        <div className="debug-body">
          <p className="debug-title">Отладка</p>
          <div className="debug-buttons">
            <button className="debug-btn" onClick={resetSession} disabled={busy}>
              Сброс сессии
            </button>
            <button className="debug-btn debug-btn-danger" onClick={deleteSession} disabled={busy}>
              Удалить сессию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
