import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GameState,
  formatRub,
  formatTimer,
  getAvailableSessions,
  getNextSessionTime,
  getTreeProgress,
  getTreeStage,
  startSession,
  doAction,
  SESSION_REWARD,
  MAX_SESSIONS,
} from "@/lib/storage";
import TreeSVG from "@/components/TreeSVG";
import { Droplets, Sun, Leaf, Clock, Play, CheckCircle2 } from "lucide-react";

interface Props {
  state: GameState;
  onStateChange: (s: GameState) => void;
}

interface Floater {
  id: number;
  x: number;
  y: number;
  label: string;
}

export default function GamePage({ state, onStateChange }: Props) {
  const [now, setNow] = useState(Date.now());
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floaterRef = useRef(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const available = getAvailableSessions(state.sessionTimestamps, now);
  const nextTime = getNextSessionTime(state.sessionTimestamps, now);
  const msLeft = nextTime ? Math.max(0, nextTime - now) : null;

  const progress = getTreeProgress(state.startDate, now);
  const stage = getTreeStage(progress);
  const treeGrowthPct = Math.round(progress * 100);

  const stageNames = ["Росток", "Саженец", "Деревце", "Молодое дерево", "Могучее дерево"];
  const sessionInProgress = !!state.currentSession?.active;

  function addFloater(label: string, x: number, y: number) {
    const id = ++floaterRef.current;
    setFloaters(f => [...f, { id, x, y, label }]);
    setTimeout(() => setFloaters(f => f.filter(fl => fl.id !== id)), 1000);
  }

  function handleStartSession() {
    const updated = startSession(state, now);
    onStateChange(updated);
  }

  function handleAction(action: "water" | "sun" | "fertilizer", e: React.MouseEvent) {
    const rect = gameAreaRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0);
    const y = e.clientY - (rect?.top ?? 0);
    const updated = doAction(state, action);
    if (updated !== state) {
      onStateChange(updated);
      const labels: Record<string, string> = { water: "+💧", sun: "+☀️", fertilizer: "+🌱" };
      addFloater(labels[action], x, y);
      if (!updated.currentSession) {
        addFloater(`+${formatRub(SESSION_REWARD)}`, x - 30, y - 40);
      }
    }
  }

  const s = state.currentSession;

  return (
    <div className="game-page">
      {/* Session counter */}
      <div className="session-counter-card">
        <div className="session-counter-left">
          <p className="session-counter-label">Доступных сессий</p>
          <div className="session-dots">
            {Array.from({ length: MAX_SESSIONS }).map((_, i) => (
              <div key={i} className={`session-dot ${i < available ? "session-dot-active" : "session-dot-empty"}`} />
            ))}
          </div>
          <p className="session-counter-num">{available} / {MAX_SESSIONS}</p>
        </div>
        <div className="session-counter-right">
          {msLeft !== null && msLeft > 0 ? (
            <>
              <Clock size={14} className="session-clock-icon" />
              <p className="session-timer-label">Следующая через</p>
              <p className="session-timer">{formatTimer(msLeft)}</p>
            </>
          ) : available < MAX_SESSIONS && msLeft === 0 ? (
            <p className="session-ready-text">Сессия готова!</p>
          ) : available === MAX_SESSIONS ? (
            <p className="session-ready-text">Все сессии готовы</p>
          ) : null}
          <p className="session-earn-hint">~{formatRub(SESSION_REWARD)} за сессию</p>
        </div>
      </div>

      {/* Tree + game area */}
      <div className="game-area" ref={gameAreaRef}>
        {/* Floaters */}
        {floaters.map(fl => (
          <div key={fl.id} className="game-floater" style={{ left: fl.x, top: fl.y }}>
            {fl.label}
          </div>
        ))}

        {/* Tree */}
        <div className="game-tree-wrap">
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.08, opacity: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <TreeSVG stage={stage} size={180} />
            </motion.div>
          </AnimatePresence>
          <p className="game-tree-stage">{stageNames[stage]} · {treeGrowthPct}% роста</p>
        </div>

        {/* Start session button or action buttons */}
        {!sessionInProgress ? (
          <motion.button
            className={`start-session-btn ${available === 0 ? "start-session-btn-disabled" : ""}`}
            onClick={handleStartSession}
            disabled={available === 0}
            whileTap={available > 0 ? { scale: 0.96 } : {}}
          >
            <Play size={16} />
            {available > 0 ? "Начать сессию" : "Нет доступных сессий"}
          </motion.button>
        ) : (
          <div className="session-actions">
            <p className="session-actions-title">
              Осталось действий: <strong>{s?.actionsLeft}</strong>
            </p>
            <div className="action-buttons-row">
              {[
                { key: "water", icon: <Droplets size={22} />, label: "Вода", color: "#3b82f6", done: s?.water },
                { key: "sun", icon: <Sun size={22} />, label: "Свет", color: "#f59e0b", done: s?.sun },
                { key: "fertilizer", icon: <Leaf size={22} />, label: "Удобрение", color: "#22c55e", done: s?.fertilizer },
              ].map(btn => (
                <motion.button
                  key={btn.key}
                  className={`action-btn-bank ${btn.done ? "action-btn-done" : ""}`}
                  style={{ "--ac": btn.color } as React.CSSProperties}
                  onClick={(e) => handleAction(btn.key as "water" | "sun" | "fertilizer", e)}
                  disabled={!!btn.done}
                  whileTap={!btn.done ? { scale: 0.91 } : {}}
                >
                  {btn.done ? <CheckCircle2 size={22} /> : btn.icon}
                  <span>{btn.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Balance summary */}
      <div className="game-balance-bar">
        <div>
          <p className="game-balance-label">Активный вклад</p>
          <p className="game-balance-value">{formatRub(state.activeBalance)}</p>
        </div>
        <div className="text-right">
          <p className="game-balance-label">Заработано</p>
          <p className="game-balance-earned">+{formatRub(state.activeEarned)}</p>
        </div>
      </div>
    </div>
  );
}
