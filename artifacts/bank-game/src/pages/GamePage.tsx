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
  getStreakBonusSeconds,
  SESSION_COOLDOWN_MS,
} from "@/lib/engine";
import { api, type LeaderboardPlayer } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import TreeSVG from "@/components/TreeSVG";
import FallingGameWater, { GameType } from "@/components/FallingGameWater";
import ClickGameSun from "@/components/ClickGameSun";
import FertilizerMatchGame from "@/components/FertilizerMatchGame";
import { Droplets, Sun, Leaf, Clock, Play, CheckCircle2, HelpCircle, X, TreePine } from "lucide-react";
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
  const { user, logout, updateNickname } = useAuth();
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
  const [historyNotif, setHistoryNotif] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
  const [xpGainAmount, setXpGainAmount] = useState<number | null>(null);
  const [activeAnim, setActiveAnim] = useState<GameType | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animParticlesRef = useRef<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showXpHistory, setShowXpHistory] = useState(false);
  const [showStreakWidget, setShowStreakWidget] = useState(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const seen = localStorage.getItem("streak_widget_date");
    const notMidSession = !state.game.sessionInProgress;
    const noPending = (state.game.pendingBaseReward ?? 0) === 0 && (state.game.pendingBonusReward ?? 0) === 0;
    return seen !== todayStr && notMidSession && noPending;
  });
  const [xpModalTab, setXpModalTab] = useState<"history" | "rating">("history");
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  function dismissStreakWidget() {
    const todayStr = new Date().toISOString().slice(0, 10);
    localStorage.setItem("streak_widget_date", todayStr);
    setShowStreakWidget(false);
  }
  const [helpPulsing, setHelpPulsing] = useState(() => !localStorage.getItem("active_help_seen"));
  useEffect(() => {
    if (!helpPulsing) return;
    const t = setTimeout(() => {
      setHelpPulsing(false);
      localStorage.setItem("active_help_seen", "true");
    }, 10000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!showXpHistory || xpModalTab !== "rating") return;
    setLeaderboardLoading(true);
    api.getLeaderboard()
      .then(r => setLeaderboard(r.players))
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false));
  }, [showXpHistory, xpModalTab]);

  const [sessionScores, setSessionScores] = useState<{ water: number; sun: number; fert: number; xp: number; base: number; bonus: number; mm: number } | null>(null);
  const [historyHighlight, setHistoryHighlight] = useState(false);

  useEffect(() => {
    if (showHelp) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [showHelp]);
  const floaterRef = useRef(0);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const pendingXpRef = useRef<{ xpGained: number; newLevel?: number; xpHistory?: unknown[]; levelUp?: boolean; newMM: number; newRemainder: number } | null>(null);
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
    const px = pendingXpRef.current;
    pendingXpRef.current = null;

    // Step 1 — tree grow animation + apply MM (с задержкой)
    setTimeout(() => {
      treeControls.start({
        scale: [1, 1.20, 1],
        filter: ["brightness(1)", "brightness(1.65)", "brightness(1)"],
        transition: { duration: 0.85, ease: "easeInOut" },
      });
      if (px) {
        const cur = stateRef.current;
        onStateChange({
          ...cur,
          game: {
            ...cur.game,
            playerXP: (cur.game.playerXP ?? 0) + px.xpGained,
            playerLevel: px.newLevel ?? cur.game.playerLevel,
            xpHistory: (px.xpHistory as typeof cur.game.xpHistory) ?? cur.game.xpHistory,
            treeGrowthMM: px.newMM,
            treeGrowthRemainder: px.newRemainder,
          },
        });
        animateGrowth(displayGrowthMMRef.current, px.newMM);
        if (px.levelUp && px.newLevel) setLevelUpData({ level: px.newLevel });
      }
    }, 1000);

    const scores = sessionScores;

    // Step 2 — XP floater on level widget
    setTimeout(() => {
      if (scores) setXpGainAmount(scores.xp);
    }, 3000);

    // Step 3 — history highlight + fade widget + open rewards
    setTimeout(() => {
      setHistoryHighlight(true);
      setTimeout(() => setHistoryHighlight(false), 2800);
      setFadeActivities(true);
      setTimeout(() => {
        setShowRewards(true);
        setFadeActivities(false);
      }, 400);
    }, 4000);
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
    animTimerRef.current = setTimeout(() => setActiveAnim(null), 2800);

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
          // XP/level applied later in handleGoToRewards
        };
        console.log(`[Session complete] base=${result.baseReward} bonus=${result.bonusReward} xp=+${result.xpGained} level=${result.newLevel}`);
        const wPct = Math.round((waterScoreRef.current / 80) * 100);
        const sPct = Math.round((sunScoreRef.current / 80) * 100);
        const fPct = Math.round((fertilizerScoreRef.current / 80) * 100);
        const totalReward = (result.baseReward ?? 0) + (result.bonusReward ?? 0);
        const { newMM: mmAfter, newRemainder: remAfter } = applyTreeGrowth(totalReward, game.treeGrowthMM ?? 0, game.treeGrowthRemainder ?? 0);
        const mmGained = mmAfter - (game.treeGrowthMM ?? 0);
        setSessionScores({ water: wPct, sun: sPct, fert: fPct, xp: result.xpGained ?? 0, base: result.baseReward ?? 0, bonus: result.bonusReward ?? 0, mm: mmGained });
        // Save XP/level/MM to apply on "Ухаживать" click
        pendingXpRef.current = {
          xpGained: result.xpGained ?? 0,
          newLevel: result.newLevel,
          xpHistory: result.xpHistory,
          levelUp: result.levelUp,
          newMM: mmAfter,
          newRemainder: remAfter,
        };
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
      const cur = stateRef.current;
      onStateChange({
        ...cur,
        balances: {
          ...cur.balances,
          active: cur.balances.active + amount,
          activeEarned: cur.balances.activeEarned + amount,
        },
        game: { ...cur.game, pendingBaseReward: 0 },
        history: [
          ...cur.history,
          { date: new Date().toLocaleDateString("ru-RU"), amount, type: "base" as const },
        ].slice(-30),
      });
      if ((stateRef.current.game.pendingBonusReward ?? 0) === 0) setHistoryNotif(true);
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
      const cur = stateRef.current;
      onStateChange({
        ...cur,
        balances: {
          ...cur.balances,
          active: cur.balances.active + amount,
          activeEarned: cur.balances.activeEarned + amount,
        },
        game: { ...cur.game, pendingBonusReward: 0 },
        history: [
          ...cur.history,
          { date: new Date().toLocaleDateString("ru-RU"), amount, type: "bonus" as const },
        ].slice(-30),
      });
      if ((stateRef.current.game.pendingBaseReward ?? 0) === 0) setHistoryNotif(true);
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
    : 0;

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

        <div className="game-left-widgets">
          <LevelWidget level={game.playerLevel ?? 1} totalXP={game.playerXP ?? 0} xpGain={xpGainAmount} onClick={() => setShowXpHistory(true)} />
        </div>

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

        <p className="tree-growth-label">{formatTreeGrowth(displayGrowthMM)}</p>

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

        <AnimatePresence>
          {showCompletionStage && !showRewards && sessionScores && (
            <motion.div
              className="xp-result-badge"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.15 }}
            >
              <div className="xp-result-row">
                <span className="xp-result-xp">+{sessionScores.xp} оп.</span>
              </div>
              {sessionScores.mm > 0 && (
                <span className="xp-result-mm">+{sessionScores.mm} мм.</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
                <p className="session-actions-title">Дождитесь следующей сессии</p>
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
            <div
              className={`session-actions ${fadeActivities ? "activities-fade" : ""}${showCompletionStage ? " session-actions-ready" : ""}`}
              onClick={showCompletionStage ? handleGoToRewards : undefined}
              style={showCompletionStage ? { cursor: "pointer" } : undefined}
            >
              <p className="session-actions-title">
                {showCompletionStage ? "Ухаживать" : "Ухаживайте за деревом"}
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
                        {btn.pct !== null && (
                          <div className="action-btn-fill" style={{ height: `${btn.pct}%` }} />
                        )}
                        <div className="action-btn-top">
                          <CheckCircle2 size={20} />
                          <span>{btn.label}</span>
                        </div>
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

      {false && showCompletionStage && !showRewards && (
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
        <div className="history-title-row" onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) setHistoryNotif(false); }}>
          <h3 className="history-title">
            История начислений
            {historyNotif && <span className="history-notif-dot" />}
          </h3>
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

      {/* Streak widget — first visit today */}
      <AnimatePresence>
        {showStreakWidget && (
          <motion.div
            className="help-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={dismissStreakWidget}
          >
            <motion.div
              className="help-modal streak-widget-modal"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="streak-widget-header">
                <span className="streak-widget-title">Награды посещений</span>
                <button className="help-modal-close" onClick={dismissStreakWidget}>✕</button>
              </div>
              <p className="streak-widget-sub">Заходите каждый день, чтобы получать бонусы</p>

              {(() => {
                const cycleDay = state.game.streakDays > 0 ? (state.game.streakDays - 1) % 5 : 0; // 0-indexed today's slot
                const days = [
                  { label: "День 1", reward: "+1 сек" },
                  { label: "День 2", reward: "+2 сек" },
                  { label: "День 3", reward: "+3 сек" },
                  { label: "День 4", reward: "+4 сек" },
                  { label: "День 5", reward: "+5 сек" },
                ];
                return (
                  <div className="streak-days-row">
                    {days.map((d, i) => {
                      const done = i < cycleDay;
                      const active = i === cycleDay;
                      return (
                        <div key={i} className={`streak-day-slot${done ? " streak-day-done" : active ? " streak-day-active" : " streak-day-upcoming"}`}>
                          <div className="streak-day-icon">
                            {done ? "✓" : active ? "⭐" : "🔒"}
                          </div>
                          <div className="streak-day-label">{d.label}</div>
                          <div className="streak-day-reward">{d.reward}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="streak-widget-streak">
                {state.game.streakDays > 0
                  ? `Текущая серия: ${state.game.streakDays} ${state.game.streakDays === 1 ? "день" : state.game.streakDays < 5 ? "дня" : "дней"}`
                  : "Начните ухаживать сегодня!"}
              </div>
              <button className="streak-widget-btn" onClick={dismissStreakWidget}>
                Забрать
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen mini-game modal — outside game-area to avoid clipping */}
      {activeMinigame && (
        <div className="water-game-overlay">
          {activeMinigame === "sun" ? (
            <ClickGameSun
              onComplete={(score) => handleMinigameComplete("sun", score)}
              bonusSeconds={getStreakBonusSeconds(game.streakDays)}
            />
          ) : activeMinigame === "fertilizer" ? (
            <FertilizerMatchGame
              onComplete={(score) => handleMinigameComplete("fertilizer", score)}
              bonusSeconds={getStreakBonusSeconds(game.streakDays)}
            />
          ) : (
            <FallingGameWater
              type={activeMinigame}
              onComplete={(score) => handleMinigameComplete(activeMinigame, score)}
              bonusSeconds={getStreakBonusSeconds(game.streakDays)}
            />
          )}
        </div>
      )}
      <AnimatePresence>
        {showXpHistory && (
          <motion.div
            className="help-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowXpHistory(false)}
          >
            <motion.div
              className="help-modal xp-history-modal"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="xp-history-modal-topbar">
                <div className="xp-nick-row">
                  <TreePine size={15} className="xp-nick-tree-icon" />
                  <span className="xp-history-modal-nick">{user?.nickname ?? user?.username}</span>
                </div>
                <button className="help-modal-close" onClick={() => setShowXpHistory(false)}>✕</button>
              </div>

              <div className="xp-modal-tabs">
                <button
                  className={`xp-modal-tab${xpModalTab === "history" ? " xp-modal-tab-active" : ""}`}
                  onClick={() => setXpModalTab("history")}
                >История</button>
                <button
                  className={`xp-modal-tab${xpModalTab === "rating" ? " xp-modal-tab-active" : ""}`}
                  onClick={() => setXpModalTab("rating")}
                >Рейтинг</button>
              </div>

              {xpModalTab === "history" && (
                (game.xpHistory ?? []).length === 0 ? (
                  <p className="xp-history-empty">Пока нет сессий</p>
                ) : (
                  <div className="xp-history-list">
                    {(game.xpHistory ?? []).map((e, i) => {
                      const [y, m, d] = e.date.split("-");
                      return (
                        <div key={i} className={`xp-history-row${i === 0 && historyHighlight ? " xp-history-row-new" : ""}`}>
                          <span className="xp-history-date">{d}.{m}.{y.slice(2)} <span className="xp-history-n">#{e.n}</span></span>
                          <span className="xp-history-xp">+{e.xp} опыт</span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {xpModalTab === "rating" && (
                leaderboardLoading ? (
                  <p className="xp-history-empty">Загрузка...</p>
                ) : leaderboard.length === 0 ? (
                  <p className="xp-history-empty">Пока нет игроков</p>
                ) : (
                  <div className="xp-leaderboard-list">
                    {leaderboard.map((p) => (
                      <div key={p.rank} className={`xp-lb-row${p.isMe ? " xp-lb-row-me" : ""}`}>
                        <span className={`xp-lb-rank${p.rank <= 3 ? ` xp-lb-rank-top${p.rank}` : ""}`}>
                          {p.rank <= 3 ? ["🥇","🥈","🥉"][p.rank - 1] : `#${p.rank}`}
                        </span>
                        <div className="xp-lb-info">
                          <span className="xp-lb-nick">{p.nickname}{p.isMe ? " (я)" : ""}</span>
                          <span className="xp-lb-meta">Ур.{p.level} · {p.streakDays > 0 ? `🔥${p.streakDays}д` : "нет стрика"}</span>
                        </div>
                        <div className="xp-lb-right">
                          <span className="xp-lb-xp">{p.xp} оп.</span>
                          {p.lastSessionXp > 0 && <span className="xp-lb-last">+{p.lastSessionXp}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
