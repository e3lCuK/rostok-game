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
  getTreeStage,
  getSessionActionsLeft,
  SESSION_COOLDOWN_MS,
} from "@/lib/engine";
import { api } from "@/lib/api";
import TreeSVG from "@/components/TreeSVG";
import FallingGameWater, { GameType } from "@/components/FallingGameWater";
import ClickGameSun from "@/components/ClickGameSun";
import FertilizerMatchGame from "@/components/FertilizerMatchGame";
import { Droplets, Sun, Leaf, Clock, Play, CheckCircle2, HelpCircle, X } from "lucide-react";
import LevelWidget from "@/components/LevelWidget";
import LevelUpAnimation from "@/components/LevelUpAnimation";

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
  const [historyOpen, setHistoryOpen] = useState(false); // collapsed by default
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
  const [xpGainAmount, setXpGainAmount] = useState<number | null>(null);
  const [activeAnim, setActiveAnim] = useState<GameType | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animParticlesRef = useRef<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [helpPulsing, setHelpPulsing] = useState(() => !localStorage.getItem("active_help_seen"));

  useEffect(() => {
    if (showHelp) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [showHelp]);
  const floaterRef = useRef(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const prevLevelRef = useRef(state.game.playerLevel ?? 1);
  const skillScoreRef = useRef<number>(40);
  const waterScoreRef = useRef<number>(40);
  const sunScoreRef = useRef<number>(40);
  const fertilizerScoreRef = useRef<number>(40);
  const treeControls = useAnimation();
  const animFrameRef = useRef<number | null>(null);
  const displayGrowthMMRef = useRef(state.game.treeGrowthMM ?? 0);
  const [displayGrowthMM, setDisplayGrowthMM] = useState(state.game.treeGrowthMM ?? 0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentStage, setCurrentStage] = useState<0|1|2|3|4>(() => getTreeStage(state.game.treeGrowthMM ?? 0) as 0|1|2|3|4);
  const currentStageRef = useRef<0|1|2|3|4>(getTreeStage(state.game.treeGrowthMM ?? 0) as 0|1|2|3|4);
  const stageTransTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      if (animTimerRef.current !== null) clearTimeout(animTimerRef.current);
    };
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

  useEffect(() => {
    const cur = game.playerLevel ?? 1;
    if (cur > prevLevelRef.current) {
      setLevelUpData({ level: cur });
    }
    prevLevelRef.current = cur;
  }, [game.playerLevel]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const mm = game.treeGrowthMM ?? 0;

    // Sync display counter (animates if different from current display)
    if (mm !== displayGrowthMMRef.current) {
      const from = displayGrowthMMRef.current;
      displayGrowthMMRef.current = mm;
      setDisplayGrowthMM(mm);
      if (mm > from) animateGrowth(from, mm);
    }

    // Stage transition
    const newStage = getTreeStage(mm) as 0|1|2|3|4;
    if (newStage !== currentStageRef.current) {
      currentStageRef.current = newStage;
      stageTransTimers.current.forEach(clearTimeout);
      setIsTransitioning(true);
      const t1 = setTimeout(() => setCurrentStage(newStage), 300);
      const t2 = setTimeout(() => setIsTransitioning(false), 900);
      stageTransTimers.current = [t1, t2];
    }
  }, [game.treeGrowthMM]);

  const locked = isSessionLocked(game.lastSessionTime, now);
  const nextTime = getNextSessionTime(game.lastSessionTime);
  const msLeft = nextTime ? Math.max(0, nextTime - now) : null;
  const sessionMax = balances.active * 0.15 / 365 / 3;
  const actionsLeft = getSessionActionsLeft(game);

  // Compute stored sessions dynamically (missed sessions accumulate until played)
  // When lastSessionTime is null (never played) fall back to startDate — mirrors server logic.
  const computedMissed = (() => {
    if (game.sessionInProgress) return game.missedSessions ?? 0;
    const referenceTime = game.lastSessionTime ?? balances.startDate ?? null;
    if (!referenceTime) return game.missedSessions ?? 0;
    const elapsed = now - referenceTime;
    const additionalMissed = Math.max(0, Math.floor(elapsed / SESSION_COOLDOWN_MS) - 1);
    return (game.missedSessions ?? 0) + additionalMissed;
  })();
  const storedSessions = 1 + computedMissed;
  const pendingStoredSessions = game.pendingStoredSessions ?? 1;

  const stage = getTreeStage(game.treeGrowthMM ?? 0);

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

  function addTreeGrowthMm(mm: number) {
    const currentMM = game.treeGrowthMM ?? 0;
    const newMM = currentMM + mm;
    onStateChange({ ...state, game: { ...game, treeGrowthMM: newMM } });
    animateGrowth(displayGrowthMMRef.current, newMM);
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

    animParticlesRef.current = [14, 22, 31, 40, 50, 60, 69, 78];
    setActiveAnim(type);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setActiveAnim(null), 1800);

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
          missedSessions: 0,
          pendingBaseReward: (game.pendingBaseReward ?? 0) + (result.baseReward ?? 0),
          pendingBonusReward: (game.pendingBonusReward ?? 0) + (result.bonusReward ?? 0),
          pendingStoredSessions: result.storedSessions ?? 1,
          playerXP: (game.playerXP ?? 0) + (result.xpGained ?? 0),
          playerLevel: result.newLevel ?? game.playerLevel,
        };
        console.log(`[Session complete] base=${result.baseReward} bonus=${result.bonusReward} xp=+${result.xpGained} level=${result.newLevel}`);
        if (result.xpGained) {
          setXpGainAmount(result.xpGained);
        }
        if (result.levelUp && result.newLevel) {
          setLevelUpData({ level: result.newLevel });
        }
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

  function formatPercent(value: number) {
    return value.toFixed(2) + " %";
  }

  const sessionHistory = (() => {
    const activeItems = [...state.history].reverse().filter(h => h.type === "base" || h.type === "bonus");
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
    return sessions;
  })();

  const avgPercent = sessionHistory.length > 0
    ? sessionHistory.reduce((sum, s) => sum + (s.base > 0 ? (s.total / s.base) * 12 : 12), 0) / sessionHistory.length
    : 12;

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
            <p className="session-ready-text" style={{ color: storedSessions > 1 ? '#dc2626' : undefined }}>
              Сессий к получению: {storedSessions}
            </p>
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

        <LevelWidget level={game.playerLevel ?? 1} totalXP={game.playerXP ?? 0} xpGain={xpGainAmount} />

        <button
          className={`help-icon${helpPulsing ? " help-icon-pulse" : ""}`}
          onClick={() => {
            setShowHelp(true);
            if (helpPulsing) {
              setHelpPulsing(false);
              localStorage.setItem("active_help_seen", "true");
            }
          }}
          aria-label="Справка"
        >
          <HelpCircle size={20} />
        </button>

        <p className="tree-growth-label">Рост дерева: {formatTreeGrowth(displayGrowthMM)}</p>

        <AnimatePresence>
          {levelUpData && (
            <LevelUpAnimation
              newLevel={levelUpData.level}
              onComplete={() => setLevelUpData(null)}
            />
          )}
        </AnimatePresence>

        <div className="game-tree-wrap">
          <motion.div animate={treeControls} style={{ display: "inline-block" }}>
            <div className={`tree-wrapper${isTransitioning ? " transitioning" : ""}`}>
              {isTransitioning && <div className="tree-cloud" />}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStage}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.08, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 180, damping: 18 }}
                >
                  <TreeSVG stage={currentStage} size={110} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
          {activeAnim && (
            <div className="tree-anim-layer">
              {activeAnim === "water" && (
                <>
                  {animParticlesRef.current.map((left, i) => (
                    <div key={i} className="water-drop" style={{ left: `${left}%`, animationDelay: `${i * 0.09}s` }} />
                  ))}
                  <div className="water-ripple" />
                </>
              )}
              {activeAnim === "sun" && (
                <>
                  <div className="light-glow" />
                  <div className="light-rays" />
                </>
              )}
              {activeAnim === "fertilizer" && animParticlesRef.current.map((left, i) => (
                <div key={i} className="fertilizer-particle" style={{ left: `${left}%`, animationDelay: `${i * 0.09}s` }} />
              ))}
            </div>
          )}
        </div>

        {!game.sessionInProgress && !showCompletionStage ? (
          <AnimatePresence mode="wait">
            {locked ? (
              <motion.div
                key="cooldown"
                className="session-actions activities-disabled"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35 }}
              >
                <p className="session-actions-title">Ухаживайте за деревом</p>
                <div className="action-buttons-row">
                  {[
                    { key: "water", icon: <Droplets size={22} />, label: "Вода" },
                    { key: "sun",   icon: <Sun size={22} />,      label: "Свет" },
                    { key: "fertilizer", icon: <Leaf size={22} />, label: "Удобрение" },
                  ].map(btn => (
                    <div
                      key={btn.key}
                      className="action-btn-bank"
                      style={{ "--ac": "#9ca3af" } as React.CSSProperties}
                    >
                      <div className="action-btn-content">
                        {btn.icon}
                        <span>{btn.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="start"
                className="start-session-btn"
                onClick={handleStartSession}
                disabled={actionLoading}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35 }}
              >
                <Play size={16} />
                {storedSessions > 1 ? "Начать суперсессию" : "Начать сессию"}
              </motion.button>
            )}
          </AnimatePresence>
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
                    {btn.done ? (
                      <>
                        <div className="action-btn-top">
                          <CheckCircle2 size={20} />
                          <span>{btn.label}</span>
                        </div>
                        {btn.pct !== null && (
                          <div className="action-btn-percent">{btn.pct}%</div>
                        )}
                      </>
                    ) : (
                      <div className="action-btn-content">
                        {btn.icon}
                        <span>{btn.label}</span>
                      </div>
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
              Базовый доход ×{pendingStoredSessions} +{formatRub(pendingBase)}
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
              Бонус за активность ×{pendingStoredSessions} +{formatRub(pendingBonus)}
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
          <p className="game-balance-earned">+{formatRub(balances.activeEarned)} · {formatPercent(avgPercent)}</p>
        </div>
      </div>

      {/* Session history */}
      <div className="history-card">
        <div className="history-title-row" onClick={() => setHistoryOpen(!historyOpen)}>
          <h3 className="history-title">История начислений</h3>
          <span className="history-chevron">{historyOpen ? "▼" : "▶"}</span>
        </div>
        {historyOpen && (
          sessionHistory.length === 0 ? (
            <p className="history-empty">Начисления появятся после первой сессии</p>
          ) : (
            <div className="history-items-scroll">
              {sessionHistory.map((s, idx) => {
                const pct = s.base > 0 ? (s.total / s.base) * 12 : 12;
                return (
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
                      <span>+{formatRub(s.total)} · {formatPercent(pct)} год.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

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
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className="help-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              className="help-modal"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="help-modal-header">
                <h3 className="help-modal-title">Активный вклад</h3>
                <button className="help-modal-close" onClick={() => setShowHelp(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="help-sections">
                <div className="help-section">
                  <span className="help-section-icon">🌱</span>
                  <div>
                    <p className="help-section-heading">Рост дерева</p>
                    <ul className="help-section-list">
                      <li>1 ₽ дохода = 1 мм роста</li>
                      <li>Рост идёт только от активного дохода</li>
                    </ul>
                  </div>
                </div>

                <div className="help-section">
                  <span className="help-section-icon">⚡</span>
                  <div>
                    <p className="help-section-heading">Сессии</p>
                    <ul className="help-section-list">
                      <li>Доступны каждые 8 часов</li>
                      <li>3 активности за сессию: Вода, Свет, Удобрение</li>
                    </ul>
                  </div>
                </div>

                <div className="help-section">
                  <span className="help-section-icon">🎮</span>
                  <div>
                    <p className="help-section-heading">Мини-игры</p>
                    <ul className="help-section-list">
                      <li>Каждая активность — своя игра</li>
                      <li>Результат в % влияет на бонус</li>
                    </ul>
                  </div>
                </div>

                <div className="help-section">
                  <span className="help-section-icon">💰</span>
                  <div>
                    <p className="help-section-heading">Доход</p>
                    <ul className="help-section-list">
                      <li>Базовый: 12% годовых</li>
                      <li>Бонус: до +3% за результат игр</li>
                    </ul>
                  </div>
                </div>

                <div className="help-section">
                  <span className="help-section-icon">🌳</span>
                  <div>
                    <p className="help-section-heading">Уровни</p>
                    <ul className="help-section-list">
                      <li>Опыт — результат трёх мини-игр</li>
                      <li>Опыт начисляется за каждую сессию</li>
                      <li>Чем лучше сыграли — тем больше опыта</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
