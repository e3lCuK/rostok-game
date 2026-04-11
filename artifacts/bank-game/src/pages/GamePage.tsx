import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserState,
  formatRub,
  formatTimer,
  isSessionLocked,
  getNextSessionTime,
  getTreeProgress,
  getTreeStage,
  TREE_STAGE_NAMES,
  calcSessionReward,
  getSessionActionsLeft,
} from "@/lib/engine";
import { api } from "@/lib/api";
import TreeSVG from "@/components/TreeSVG";
import FallingGameWater from "@/components/FallingGameWater";
import DebugPanel from "@/components/DebugPanel";
import { Droplets, Sun, Leaf, Clock, Play, CheckCircle2 } from "lucide-react";

interface Props {
  state: UserState;
  onStateChange: (s: UserState) => void;
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
  const [actionLoading, setActionLoading] = useState(false);
  const [showWaterGame, setShowWaterGame] = useState(false);
  const [pendingReward, setPendingReward] = useState(0);
  const [sessionPerformance, setSessionPerformance] = useState(0);
  const [collectLoading, setCollectLoading] = useState(false);
  const floaterRef = useRef(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const skillScoreRef = useRef<number>(40);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { balances, game } = state;
  const totalBalance = balances.standard + balances.active;

  const locked = isSessionLocked(game.lastSessionTime, now);
  const nextTime = getNextSessionTime(game.lastSessionTime);
  const msLeft = nextTime ? Math.max(0, nextTime - now) : null;
  const sessionReward = calcSessionReward(balances.active, totalBalance, game.streakDays);
  const actionsLeft = getSessionActionsLeft(game);

  const progress = getTreeProgress(balances.startDate, now, totalBalance);
  const stage = getTreeStage(progress);
  const treeGrowthPct = Math.round(progress * 100);

  function addFloater(label: string, x: number, y: number) {
    const id = ++floaterRef.current;
    setFloaters(f => [...f, { id, x, y, label }]);
    setTimeout(() => setFloaters(f => f.filter(fl => fl.id !== id)), 1200);
  }

  async function handleStartSession() {
    if (locked || game.sessionInProgress || actionLoading) return;
    setActionLoading(true);
    try {
      await api.startSession();
      onStateChange({
        ...state,
        game: { ...game, sessionInProgress: true, water: false, sun: false, fertilizer: false },
      });
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  function handleWaterGameComplete(skillScore: number) {
    setShowWaterGame(false);
    skillScoreRef.current = typeof skillScore === "number" && !isNaN(skillScore) ? skillScore : 40;
    console.log("[Water mini-game] skillScore saved:", skillScoreRef.current);
    const rect = gameAreaRef.current?.getBoundingClientRect();
    const x = (rect?.width ?? 200) / 2;
    const y = (rect?.height ?? 200) / 2;
    doAction("water", x, y);
  }

  async function handleAction(action: "water" | "sun" | "fertilizer", e: React.MouseEvent) {
    if (game[action] || actionLoading) return;
    const rect = gameAreaRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0);
    const y = e.clientY - (rect?.top ?? 0);
    doAction(action, x, y);
  }

  async function doAction(action: "water" | "sun" | "fertilizer", x: number, y: number) {
    if (game[action] || actionLoading) return;

    setActionLoading(true);
    try {
      const result = await api.doAction(action, skillScoreRef.current);
      const labels: Record<string, string> = { water: "💧", sun: "☀️", fertilizer: "🌱" };
      addFloater(labels[action], x, y);

      let nextGame = { ...game, [action]: true };

      if (result.sessionComplete) {
        addFloater(`+${formatRub(result.reward)}`, x - 30, y - 50);
        const finishedTime = Date.now();
        nextGame = {
          ...nextGame,
          water: true, sun: true, fertilizer: true,
          sessionInProgress: false,
          lastSessionTime: finishedTime,
        };
        const safeReward = Math.max(0, result.reward || 0);
        const safeF = Math.max(0, result.f || 0);
        setPendingReward(safeReward);
        setSessionPerformance(safeF);
        console.log(`[Session complete] F=${safeF}%, reward=${safeReward}`);
        onStateChange({ ...state, game: nextGame });
      } else {
        onStateChange({ ...state, game: nextGame });
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCollect() {
    if (pendingReward <= 0 || collectLoading) return;
    setCollectLoading(true);
    const amount = Math.max(0, pendingReward);
    setPendingReward(0);
    setSessionPerformance(0);
    onStateChange({
      ...state,
      balances: {
        ...balances,
        active: balances.active + amount,
        activeEarned: balances.activeEarned + amount,
      },
      history: [
        ...state.history,
        {
          date: new Date().toLocaleDateString("ru-RU"),
          amount,
          type: "active",
        },
      ].slice(-30),
    });
    setCollectLoading(false);
  }

  return (
    <div className="game-page">
      {/* Session status card */}
      <div className="session-counter-card">
        <div className="session-counter-left">
          <p className="session-counter-label">Статус сессии</p>
          <div className={`session-status-badge ${locked ? "session-status-locked" : "session-status-ready"}`}>
            {game.sessionInProgress ? "В процессе" : locked ? "Перезарядка" : "Готова"}
          </div>
        </div>

        {sessionPerformance > 0 && (
          <div className="care-pct-block">
            <p className="session-counter-label">Уход</p>
            <p className="care-pct-value">{Math.round(sessionPerformance)}%</p>
          </div>
        )}

        <div className="session-counter-right">
          {locked && msLeft !== null && msLeft > 0 ? (
            <>
              <Clock size={14} className="session-clock-icon" />
              <p className="session-timer-label">Следующая через</p>
              <p className="session-timer">{formatTimer(msLeft)}</p>
            </>
          ) : !game.sessionInProgress ? (
            <p className="session-ready-text">Сессия готова!</p>
          ) : (
            <p className="session-ready-text">Осталось: {actionsLeft} действия</p>
          )}
          <p className="session-earn-hint">~{formatRub(sessionReward)} за сессию</p>
        </div>
      </div>

      {/* Tree + game area */}
      <div className="game-area" ref={gameAreaRef}>
        {floaters.map(fl => (
          <div key={fl.id} className="game-floater" style={{ left: fl.x, top: fl.y }}>
            {fl.label}
          </div>
        ))}

        {/* Water mini-game overlay */}
        {showWaterGame && (
          <div className="water-game-overlay">
            <FallingGameWater onComplete={handleWaterGameComplete} />
          </div>
        )}

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
          <p className="game-tree-stage">{TREE_STAGE_NAMES[stage]} · {treeGrowthPct}% роста</p>
        </div>

        {!game.sessionInProgress ? (
          <motion.button
            className={`start-session-btn ${locked ? "start-session-btn-disabled" : ""}`}
            onClick={handleStartSession}
            disabled={locked || actionLoading}
            whileTap={!locked ? { scale: 0.96 } : {}}
          >
            <Play size={16} />
            {locked ? "Сессия недоступна" : "Начать сессию"}
          </motion.button>
        ) : (
          <div className="session-actions">
            <p className="session-actions-title">
              Ухаживайте за деревом
            </p>
            <div className="action-buttons-row">
              {[
                { key: "water" as const, icon: <Droplets size={22} />, label: "Вода", color: "#3b82f6", done: game.water },
                { key: "sun" as const, icon: <Sun size={22} />, label: "Свет", color: "#f59e0b", done: game.sun },
                { key: "fertilizer" as const, icon: <Leaf size={22} />, label: "Удобрение", color: "#22c55e", done: game.fertilizer },
              ].map(btn => (
                <motion.button
                  key={btn.key}
                  className={`action-btn-bank ${btn.done ? "action-btn-done" : ""}`}
                  style={{ "--ac": btn.color } as React.CSSProperties}
                  onClick={
                    btn.key === "water" && !btn.done
                      ? () => setShowWaterGame(true)
                      : (e) => handleAction(btn.key, e)
                  }
                  disabled={!!btn.done || actionLoading}
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

      {/* Collect reward area */}
      {pendingReward > 0 && (
        <div className="collect-area">
          <motion.button
            className="collect-btn"
            onClick={handleCollect}
            disabled={collectLoading}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            Забрать +{formatRub(pendingReward)}
          </motion.button>
        </div>
      )}

      {/* Balance summary */}
      <div className="game-balance-bar">
        <div>
          <p className="game-balance-label">Активный вклад</p>
          <p className="game-balance-value">{formatRub(balances.active)}</p>
        </div>
        <div className="text-right">
          <p className="game-balance-label">Заработано</p>
          <p className="game-balance-earned">+{formatRub(balances.activeEarned)}</p>
        </div>
      </div>

      <DebugPanel
        state={state}
        onStateChange={onStateChange}
        onResetPending={() => { setPendingReward(0); setSessionPerformance(0); }}
      />
    </div>
  );
}
