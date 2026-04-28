import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  onResetAccount: () => void;
  onSignOut: () => Promise<void>;
}

export default function DebugPanel({ onResetAccount, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
            <button className="debug-btn debug-btn-danger" onClick={resetAccount} disabled={busy}>
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
