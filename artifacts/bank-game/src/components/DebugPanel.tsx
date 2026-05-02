import { useState } from "react";
import { UserState } from "@/lib/engine";
import { api } from "@/lib/api";

interface Props {
  state: UserState;
  onStateChange: (s: UserState) => void;
  onResetAccount: () => void;
  onSignOut: () => Promise<void>;
}

export default function DebugPanel({ state, onStateChange, onResetAccount, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mmInput, setMmInput] = useState("");

  const { game } = state;

  function addTreeGrowthMm() {
    const value = Number(mmInput);
    if (isNaN(value) || value <= 0) return;
    onStateChange({
      ...state,
      game: { ...game, treeGrowthMM: (game.treeGrowthMM ?? 0) + value },
    });
    setMmInput("");
  }

  function resetTreeGrowth() {
    onStateChange({
      ...state,
      game: { ...game, treeGrowthMM: 0, treeGrowthRemainder: 0 },
    });
  }

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

  async function resetAccount() {
    if (busy) return;
    setBusy(true);
    try {
      await api.debugResetAll();
    } catch (e) {
      console.warn("[Debug] reset-all failed", e);
    }
    localStorage.clear();
    setBusy(false);
    onResetAccount();
  }

  async function deleteAccount() {
    if (busy) return;
    setBusy(true);
    try {
      await api.debugResetAll();
    } catch (e) {
      console.warn("[Debug] reset-all failed", e);
    }
    localStorage.clear();
    setBusy(false);
    setConfirmDelete(false);
    setOpen(false);
    await onSignOut();
  }

  return (
    <div className="debug-panel">
      <button className="debug-toggle" onClick={() => { setOpen(o => !o); setConfirmDelete(false); }}>
        {open ? "✕" : "Отладка"}
      </button>

      {open && (
        <div className="debug-body">
          <p className="debug-title">Отладка</p>
          <div className="debug-buttons">
            <div className="debug-mm-row">
              <input
                className="debug-mm-input"
                type="number"
                value={mmInput}
                placeholder="мм"
                onChange={e => setMmInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTreeGrowthMm()}
              />
              <button className="debug-btn" onClick={addTreeGrowthMm} disabled={busy}>
                + мм дереву
              </button>
            </div>

            <button className="debug-btn" onClick={resetTreeGrowth} disabled={busy}>
              Сброс роста
            </button>

            <button className="debug-btn" onClick={resetSession} disabled={busy}>
              Сброс сессии
            </button>

            <button className="debug-btn" onClick={resetAccount} disabled={busy}>
              Сброс аккаунта
            </button>

            {!confirmDelete ? (
              <button
                className="debug-btn debug-btn-danger"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Удалить аккаунт
              </button>
            ) : (
              <div className="debug-confirm">
                <p className="debug-confirm-text">Вы уверены? Это действие нельзя отменить</p>
                <div className="debug-confirm-buttons">
                  <button className="debug-btn debug-btn-danger" onClick={deleteAccount} disabled={busy}>
                    Да, удалить
                  </button>
                  <button className="debug-btn" onClick={() => setConfirmDelete(false)} disabled={busy}>
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
