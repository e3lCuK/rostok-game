import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import {
  UserState,
  formatRub,
  formatTimer,
  formatTreeGrowth,
  applyTreeGrowth,
  isSessionLocked,
  getNextSessionTime,
  getTreeProgress,
  getTreeStage,
  TREE_STAGE_NAMES,
  getSessionActionsLeft,
} from "@/lib/engine";
import { api } from "@/lib/api";
import TreeSVG from "@/components/TreeSVG";
import FallingGameWater, { GameType } from "@/components/FallingGameWater";
import ClickGameSun from "@/components/ClickGameSun";
import FertilizerMatchGame from "@/components/FertilizerMatchGame";
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
  const [activeMinigame, setActiveMinigame] = useState<GameType | null>(null);
  const [claimingBase, setClaimingBase] = useState(false);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [waterResultPct, setWaterResultPct] = useState<number | null>(null);
  const [lightResultPct, setLightResultPct] = useState<number | null>(null);
  const [fertilizerResultPct, setFertilizerResultPct] = useState<number | null>(null);
  const hasPendingInit = (state.game.pendingBaseReward ?? 0) > 0 || (state.game.pendingBonusReward ?? 0) > 0;
  const notInSessionInit = !state.game.sessionInProgress;
  const [showCompletionStage, setShowCompletionStage] = useState(hasPendingInit && notInSessionInit);
  const [showRewards, setShowRewards] = useState(hasPendingInit && notInSessionInit);
  const [fadeActivities, setFadeActivities] = useState(false);
  const floaterRef = useRef(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const skillScoreRef = useRef<number>(40);
  const waterScoreRef = useRef<number>(40);
  const sunScoreRef = useRef<number>(40);
  const fertilizerScoreRef = useRef<number>(40);
  const treeControls = useAnimation();
  const animFrameRef = useRef<number | null>(null);
  const displayGrowthMMRef = useRef(state.game.treeGrowthMM ?? 0);
  const [displayGrowthMM, setDisplayGrowthMM] = useState(state.game.treeGrowthMM ?? 0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => { if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  useEffect(() => {
    const pb = state.game.pendingBaseReward ?? 0;
    const pbo = state.game.pendingBonusReward ?? 0;
    if (pb === 0 && pbo === 0 && showCompletionStage) {
      setShowCompletionStage(false);
      setShowRewards(false);
      setFadeActivities(false);
    }
  }, [state.game.pendingBaseReward, state.game.pendingBonusReward, showCompletionStage]);

  const { balances, game } = state;
  const totalBalance = balances.standard + balances.active;

  const locked = isSessionLocked(game.lastSessionTime, now);
  const nextTime = getNextSessionTime(game.lastSessionTime);
  const msLeft = nextTime ? Math.max(0, nextTime - now) : null;
  const sessionMax = balances.active * 0.15 / 365 / 3;
  const actionsLeft = getSessionActionsLeft(game);

  const progress = getTreeProgress(balances.startDate, now, totalBalance);
  const stage = getTreeStage(progress);
  const treeGrowthPct = Math.round(progress * 100);

  const pendingBase = game.pendingBaseReward ?? 0;
  const pendingBonus = game.pendingBonusReward ?? 0;

  function addFloater(label: string, x: number, y: number) {
    const id = ++floaterRef.current;
    setFloaters(f => [...f, { id, x, y, label }]);
    setTimeout(() => setFloaters(f => f.filter(fl => fl.id !== id)), 1200);
  }

  function animateGrowth(fromMM: number, toMM: number) {
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    if (fromMM === toMM) return;
    const start = performance.now();
    const duration = 750;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(fromMM + (toMM - fromMM) * eased);
      displayGrowthMMRef.current = current;
      setDisplayGrowthMM(current);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }

  function triggerTreeAnim() {
    void treeControls.start({
      scale: [1, 1.13, 1],
      y: [0, -12, 0],
      filter: [
        "drop-shadow(0 0 0px rgba(34,197,94,0))",
        "drop-shadow(0 0 14px rgba(34,197,94,0.85))",
        "drop-shadow(0 0 0px rgba(34,197,94,0))",
      ],
      transition: { duration: 0.75, times: [0, 0.38, 1], ease: "easeOut" },
    });
  }

  async function handleStartSession() {
    if (locked || game.sessionInProgress || actionLoading) return;
    console.log("[Session] Start button clicked, locked:", locked, "inProgress:", game.sessionInProgress);
    setActionLoading(true);
    try {
      await api.startSession();
      console.log("[Session] Started successfully");
      // reset per-session scores and result display
      waterScoreRef.current = 40;
      sunScoreRef.current = 40;
      fertilizerScoreRef.current = 40;
      skillScoreRef.current = 40;
      setWaterResultPct(null);
      setLightResultPct(null);
      setFertilizerResultPct(null);
      setShowCompletionStage(false);
      setShowRewards(false);
      setFadeActivities(false);
      onStateChange({
        ...state,
        game: { ...game, sessionInProgress: true, water: false, sun: false, fertilizer: false },
      });
    } catch (err: any) {
      const status = err?.status ?? 0;
      if (status === 429) {
        console.warn("[Session] Still on cooldown (429) — try Debug > Сброс сессии");
      } else {
        console.error("[Session] Failed to start:", err);
      }
    } finally {
      setActionLoading(false);
    }
  }

  function handleGoToRewards() {
    setFadeActivities(true);
    setTimeout(() => {
      setShowRewards(true);
      setFadeActivities(false);
    }, 300);
  }

  function handleMinigameComplete(type: GameType, skillScore: number) {
    setActiveMinigame(null);
    const safe = typeof skillScore === "number" && !isNaN(skillScore) ? skillScore : 40;
    if (type === "water")      waterScoreRef.current = safe;
    if (type === "sun")        sunScoreRef.current = safe;
    if (type === "fertilizer") fertilizerScoreRef.current = safe;
    const pct = Math.min(100, Math.max(0, Math.round((safe / 80) * 100)));
    if (type === "water")      setWaterResultPct(pct);
    if (type === "sun")        setLightResultPct(pct);
    if (type === "fertilizer") setFertilizerResultPct(pct);

    const waterScore      = waterScoreRef.current || 0;
    const sunScore        = sunScoreRef.current || 0;
    const fertilizerScore = fertilizerScoreRef.current || 0;
    // Combined score 0-80: average of three normalized scores
    const combined = Math.min(80, Math.round((waterScore + sunScore + fertilizerScore) / 3));
    skillScoreRef.current = combined;

    console.log({ waterScore, sunScore, fertilizerScore, skillScore: combined });
    const rect = gameAreaRef.current?.getBoundingClientRect();
    const x = (rect?.width ?? 200) / 2;
    const y = (rect?.height ?? 200) / 2;
    doAction(type, x, y);
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
        const finishedTime = Date.now();
        nextGame = {
          ...nextGame,
          water: true, sun: true, fertilizer: true,
          sessionInProgress: false,
          lastSessionTime: finishedTime,
          pendingBaseReward: (game.pendingBaseReward ?? 0) + (result.baseReward ?? 0),
          pendingBonusReward: (game.pendingBonusReward ?? 0) + (result.bonusReward ?? 0),
        };
        console.log(`[Session complete] base=${result.baseReward} bonus=${result.bonusReward}`);
        setShowCompletionStage(true);
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

  async function handleClaimBase() {
    if (claimingBase || pendingBase <= 0) return;
    setClaimingBase(true);
    try {
      const result = await api.claim("base");
      const amount = result.amount ?? 0;
      const rect = gameAreaRef.current?.getBoundingClientRect();
      addFloater(`+${formatRub(amount)}`, (rect?.width ?? 200) / 2, 40);
      const { newMM, newRemainder } = applyTreeGrowth(amount, game.treeGrowthMM ?? 0, game.treeGrowthRemainder ?? 0);
      onStateChange({
        ...state,
        balances: {
          ...balances,
          active: balances.active + amount,
          activeEarned: balances.activeEarned + amount,
        },
        game: { ...game, pendingBaseReward: 0, treeGrowthMM: newMM, treeGrowthRemainder: newRemainder },
        history: [
          ...state.history,
          { date: new Date().toLocaleDateString("ru-RU"), amount, type: "base" as const },
        ].slice(-30),
      });
      animateGrowth(displayGrowthMMRef.current, newMM);
      triggerTreeAnim();
    } catch (err) {
      console.error("[Claim base] failed:", err);
    } finally {
      setClaimingBase(false);
    }
  }

  async function handleClaimBonus() {
    if (claimingBonus || pendingBonus <= 0) return;
    setClaimingBonus(true);
    try {
      const result = await api.claim("bonus");
      const amount = result.amount ?? 0;
      const rect = gameAreaRef.current?.getBoundingClientRect();
      addFloater(`+${formatRub(amount)}`, (rect?.width ?? 200) / 2 + 60, 40);
      const { newMM, newRemainder } = applyTreeGrowth(amount, game.treeGrowthMM ?? 0, game.treeGrowthRemainder ?? 0);
      onStateChange({
        ...state,
        balances: {
          ...balances,
          active: balances.active + amount,
          activeEarned: balances.activeEarned + amount,
        },
        game: { ...game, pendingBonusReward: 0, treeGrowthMM: newMM, treeGrowthRemainder: newRemainder },
        history: [
          ...state.history,
          { date: new Date().toLocaleDateString("ru-RU"), amount, type: "bonus" as const },
        ].slice(-30),
      });
      animateGrowth(displayGrowthMMRef.current, newMM);
      triggerTreeAnim();
    } catch (err) {
      console.error("[Claim bonus] failed:", err);
    } finally {
      setClaimingBonus(false);
    }
  }

  return (
    <div className="game-page">
      {/* Session status card */}
      <div className="session-counter-card">
        <div className="session-counter-left">
          <p className="session-counter-label">Статус сессии</p>
          <div className={`session-status-badge ${showCompletionStage && !showRewards ? "session-status-ready" : locked ? "session-status-locked" : "session-status-ready"}`}>
            {game.sessionInProgress || (showCompletionStage && !showRewards) ? "В процессе" : locked ? "Перезарядка" : "Готова"}
          </div>
        </div>

        <div className="session-counter-right">
          {showCompletionStage && !showRewards ? (
            <p className="session-ready-text">Осталось: 0 действия</p>
          ) : locked && msLeft !== null && msLeft > 0 ? (
            <>
              <p className="session-timer-label">Следующая через</p>
              <div className="session-timer">
                <Clock size={14} />
                <span>{formatTimer(msLeft)}</span>
              </div>
            </>
          ) : !game.sessionInProgress ? (
            <p className="session-ready-text">Сессия готова!</p>
          ) : (
            <p className="session-ready-text">Осталось: {actionsLeft} действия</p>
          )}
        </div>

        <p className="session-earn-hint">до {formatRub(sessionMax)} за сессию</p>
      </div>

      {/* Tree + game area */}
      <div className="game-area" ref={gameAreaRef}>
        {floaters.map(fl => (
          <div key={fl.id} className="game-floater" style={{ left: fl.x, top: fl.y }}>
            {fl.label}
          </div>
        ))}

        <div className="game-tree-wrap">
          <motion.div animate={treeControls} style={{ display: "inline-block" }}>
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
          </motion.div>
          <p className="game-tree-stage">{TREE_STAGE_NAMES[stage]} · Рост дерева: {formatTreeGrowth(displayGrowthMM)}</p>
        </div>

        {!game.sessionInProgress && !showCompletionStage ? (
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
          !showRewards && (
            <div className={`session-actions ${fadeActivities ? "activities-fade" : ""}`}>
              <p className="session-actions-title">
                Ухаживайте за деревом
              </p>
              <div className="action-buttons-row">
                {[
                  { key: "water" as const, icon: <Droplets size={22} />, label: "Вода", color: "#3b82f6", done: game.water, pct: waterResultPct },
                  { key: "sun" as const, icon: <Sun size={22} />, label: "Свет", color: "#f59e0b", done: game.sun, pct: lightResultPct },
                  { key: "fertilizer" as const, icon: <Leaf size={22} />, label: "Удобрение", color: "#22c55e", done: game.fertilizer, pct: fertilizerResultPct },
                ].map(btn => (
                  <motion.button
                    key={btn.key}
                    className={`action-btn-bank ${btn.done ? "action-btn-done" : ""}`}
                    style={{ "--ac": btn.color } as React.CSSProperties}
                    onClick={!btn.done ? () => setActiveMinigame(btn.key) : undefined}
                    disabled={!!btn.done || actionLoading}
                    whileTap={!btn.done ? { scale: 0.91 } : {}}
                  >
                    {btn.done ? <CheckCircle2 size={22} /> : btn.icon}
                    <span>{btn.label}</span>
                    {btn.done && btn.pct !== null && (
                      <span className="action-btn-pct" style={{ color: btn.color }}>{btn.pct}%</span>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {showCompletionStage && !showRewards && (
        <button className="transition-btn" onClick={handleGoToRewards}>
          Перейти к начислениям
        </button>
      )}

      {/* Reward claim area — shown after session complete */}
      {showRewards && (pendingBase > 0 || pendingBonus > 0) && (
        <div className="collect-area">
          {pendingBase > 0 && (
            <motion.button
              className="collect-btn collect-btn-base"
              onClick={handleClaimBase}
              disabled={claimingBase}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              Базовый доход +{formatRub(pendingBase)}
            </motion.button>
          )}
          {pendingBonus > 0 && (
            <motion.button
              className="collect-btn collect-btn-bonus"
              onClick={handleClaimBonus}
              disabled={claimingBonus}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.07 }}
            >
              Бонус за активность +{formatRub(pendingBonus)}
            </motion.button>
          )}
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

      {/* Session history */}
      {(() => {
        const activeItems = [...state.history].reverse().filter(h => h.type === "base" || h.type === "bonus");
        if (activeItems.length === 0) return null;
        const sessions: { date: string; base: number; bonus: number; total: number }[] = [];
        let i = 0;
        while (i < activeItems.length) {
          const item = activeItems[i];
          const next = activeItems[i + 1];
          if (next && next.type !== item.type) {
            sessions.push({
              date: item.date,
              base: item.type === "base" ? item.amount : next.amount,
              bonus: item.type === "bonus" ? item.amount : next.amount,
              total: item.amount + next.amount,
            });
            i += 2;
          } else {
            sessions.push({
              date: item.date,
              base: item.type === "base" ? item.amount : 0,
              bonus: item.type === "bonus" ? item.amount : 0,
              total: item.amount,
            });
            i += 1;
          }
        }
        return (
          <div className="session-history">
            <h3 className="session-history-title">История сессий</h3>
            {sessions.map((s, idx) => (
              <div key={idx} className="session-item">
                <p className="session-title">{s.date}</p>
                {s.base > 0 && (
                  <div className="session-row">
                    <span>База</span>
                    <span>+{formatRub(s.base)}</span>
                  </div>
                )}
                {s.bonus > 0 && (
                  <div className="session-row session-row-bonus">
                    <span>Бонус</span>
                    <span>+{formatRub(s.bonus)}</span>
                  </div>
                )}
                <div className="session-total">
                  <span>Итого</span>
                  <span>+{formatRub(s.total)}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Full-screen mini-game modal — outside game-area to avoid clipping */}
      {activeMinigame && (
        <div className="water-game-overlay">
          {activeMinigame === "sun" ? (
            <ClickGameSun
              onComplete={(score) => handleMinigameComplete("sun", score)}
            />
          ) : activeMinigame === "fertilizer" ? (
            <FertilizerMatchGame
              onComplete={(score) => handleMinigameComplete("fertilizer", score)}
            />
          ) : (
            <FallingGameWater
              type={activeMinigame}
              onComplete={(score) => handleMinigameComplete(activeMinigame, score)}
            />
          )}
        </div>
      )}
    </div>
  );
}
