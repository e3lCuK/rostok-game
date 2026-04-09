import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Stage = 0 | 1 | 2 | 3 | 4;

interface GameState {
  water: number;
  sun: number;
  fertilizer: number;
  stage: Stage;
  totalPoints: number;
}

const STAGE_THRESHOLDS = [0, 15, 40, 80, 140];
const MAX_STAGE: Stage = 4;

const STAGE_LABELS = ["Росток", "Саженец", "Деревце", "Молодое дерево", "Могучее дерево"];

function TreeSVG({ stage }: { stage: Stage }) {
  const trees = [
    // Stage 0 — seedling (tiny sprout)
    <svg key={0} viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="245" rx="60" ry="10" fill="#a3855a" opacity="0.25" />
      <rect x="96" y="200" width="8" height="45" rx="4" fill="#8B6340" />
      <ellipse cx="100" cy="190" rx="22" ry="22" fill="#6dbf67" />
      <ellipse cx="88" cy="198" rx="13" ry="13" fill="#5aac54" />
      <ellipse cx="112" cy="195" rx="10" ry="10" fill="#7dd177" />
      <ellipse cx="100" cy="182" rx="12" ry="12" fill="#83c97d" />
    </svg>,
    // Stage 1 — small tree
    <svg key={1} viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="248" rx="70" ry="10" fill="#a3855a" opacity="0.3" />
      <rect x="94" y="170" width="12" height="80" rx="5" fill="#8B6340" />
      <ellipse cx="100" cy="155" rx="38" ry="38" fill="#5aac54" />
      <ellipse cx="78" cy="168" rx="25" ry="25" fill="#4d9c47" />
      <ellipse cx="124" cy="164" rx="22" ry="22" fill="#62b95c" />
      <ellipse cx="100" cy="138" rx="28" ry="28" fill="#6dbf67" />
      <ellipse cx="86" cy="148" rx="18" ry="18" fill="#5aac54" />
    </svg>,
    // Stage 2 — medium tree
    <svg key={2} viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="250" rx="75" ry="11" fill="#a3855a" opacity="0.35" />
      <rect x="91" y="140" width="18" height="112" rx="6" fill="#7a5330" />
      <rect x="91" y="180" width="10" height="6" rx="3" fill="#9a6b40" transform="rotate(-20 91 180)" />
      <rect x="109" y="190" width="10" height="6" rx="3" fill="#9a6b40" transform="rotate(20 109 190)" />
      <ellipse cx="100" cy="120" rx="55" ry="48" fill="#4d9c47" />
      <ellipse cx="68" cy="138" rx="38" ry="35" fill="#449040" />
      <ellipse cx="134" cy="132" rx="34" ry="32" fill="#56a850" />
      <ellipse cx="100" cy="100" rx="42" ry="38" fill="#5aac54" />
      <ellipse cx="80" cy="115" rx="26" ry="24" fill="#4d9c47" />
      <ellipse cx="120" cy="108" rx="24" ry="22" fill="#6dbf67" />
      <ellipse cx="100" cy="90" rx="28" ry="25" fill="#7acc74" />
    </svg>,
    // Stage 3 — tall tree
    <svg key={3} viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="252" rx="80" ry="12" fill="#8B6340" opacity="0.4" />
      <rect x="88" y="110" width="24" height="145" rx="7" fill="#6b4423" />
      <rect x="88" y="155" width="12" height="8" rx="3" fill="#8a5a2e" transform="rotate(-25 88 155)" />
      <rect x="112" y="168" width="14" height="8" rx="3" fill="#8a5a2e" transform="rotate(25 112 168)" />
      <rect x="88" y="190" width="10" height="6" rx="3" fill="#8a5a2e" transform="rotate(-15 88 190)" />
      <ellipse cx="100" cy="90" rx="68" ry="58" fill="#3d8c38" />
      <ellipse cx="58" cy="110" rx="46" ry="42" fill="#368030" />
      <ellipse cx="144" cy="104" rx="42" ry="38" fill="#449040" />
      <ellipse cx="100" cy="72" rx="52" ry="46" fill="#4d9c47" />
      <ellipse cx="72" cy="88" rx="34" ry="30" fill="#3d8c38" />
      <ellipse cx="130" cy="80" rx="30" ry="28" fill="#56a850" />
      <ellipse cx="100" cy="58" rx="36" ry="32" fill="#5aac54" />
      <ellipse cx="85" cy="70" rx="22" ry="20" fill="#4d9c47" />
      <ellipse cx="116" cy="64" rx="20" ry="18" fill="#6dbf67" />
      <ellipse cx="100" cy="45" rx="22" ry="20" fill="#7acc74" />
    </svg>,
    // Stage 4 — mighty ancient tree
    <svg key={4} viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="254" rx="90" ry="14" fill="#6b4423" opacity="0.45" />
      {/* Roots */}
      <path d="M90 240 Q75 250 55 255" stroke="#5a3a1a" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M110 240 Q125 250 145 255" stroke="#5a3a1a" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <path d="M95 242 Q88 252 80 258" stroke="#5a3a1a" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      {/* Trunk */}
      <rect x="84" y="85" width="32" height="165" rx="9" fill="#5a3a1a" />
      <rect x="84" y="105" width="16" height="10" rx="4" fill="#7a5330" transform="rotate(-30 84 105)" />
      <rect x="116" y="120" width="18" height="10" rx="4" fill="#7a5330" transform="rotate(30 116 120)" />
      <rect x="84" y="150" width="14" height="8" rx="4" fill="#7a5330" transform="rotate(-20 84 150)" />
      <rect x="116" y="165" width="14" height="8" rx="4" fill="#7a5330" transform="rotate(20 116 165)" />
      <rect x="88" y="195" width="10" height="7" rx="3" fill="#7a5330" transform="rotate(-15 88 195)" />
      {/* Canopy layers — rich and dense */}
      <ellipse cx="100" cy="65" rx="82" ry="70" fill="#2d7028" />
      <ellipse cx="50" cy="90" rx="52" ry="48" fill="#286623" />
      <ellipse cx="152" cy="84" rx="48" ry="44" fill="#307a2b" />
      <ellipse cx="100" cy="48" rx="64" ry="56" fill="#3d8c38" />
      <ellipse cx="62" cy="68" rx="42" ry="38" fill="#2d7028" />
      <ellipse cx="140" cy="60" rx="38" ry="34" fill="#368030" />
      <ellipse cx="100" cy="32" rx="50" ry="42" fill="#449040" />
      <ellipse cx="76" cy="46" rx="30" ry="28" fill="#3d8c38" />
      <ellipse cx="126" cy="40" rx="28" ry="26" fill="#4d9c47" />
      <ellipse cx="100" cy="18" rx="34" ry="28" fill="#5aac54" />
      <ellipse cx="88" cy="28" rx="20" ry="18" fill="#449040" />
      <ellipse cx="114" cy="22" rx="18" ry="16" fill="#6dbf67" />
      <ellipse cx="100" cy="8" rx="20" ry="16" fill="#7acc74" />
      {/* Fruit/flowers */}
      <circle cx="68" cy="72" r="5" fill="#ff6b6b" />
      <circle cx="132" cy="65" r="5" fill="#ff6b6b" />
      <circle cx="100" cy="38" r="4" fill="#ffb347" />
      <circle cx="80" cy="55" r="3.5" fill="#ff6b6b" />
      <circle cx="120" cy="50" r="3.5" fill="#ffb347" />
      <circle cx="58" cy="88" r="3" fill="#ffb347" />
      <circle cx="145" cy="80" r="3" fill="#ff6b6b" />
    </svg>
  ];
  return trees[stage];
}

function ResourceBar({ label, value, max, color, icon }: { label: string; value: number; max: number; color: string; icon: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="resource-bar">
      <span className="resource-icon">{icon}</span>
      <div className="resource-track">
        <div
          className="resource-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="resource-value">{Math.floor(value)}</span>
    </div>
  );
}

export default function Game() {
  const [state, setState] = useState<GameState>({
    water: 0,
    sun: 0,
    fertilizer: 0,
    stage: 0,
    totalPoints: 0,
  });

  const [pressing, setPressing] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<{ id: number; x: number; y: number; type: string }[]>([]);
  const [growing, setGrowing] = useState(false);
  const [showStageLabel, setShowStageLabel] = useState(false);
  const floaterIdRef = useRef(0);

  const totalPoints = state.water + state.sun + state.fertilizer;

  // Check for stage upgrade
  useEffect(() => {
    if (state.stage < MAX_STAGE) {
      const nextThreshold = STAGE_THRESHOLDS[state.stage + 1];
      if (totalPoints >= nextThreshold) {
        setGrowing(true);
        setShowStageLabel(true);
        setTimeout(() => setGrowing(false), 700);
        setTimeout(() => setShowStageLabel(false), 2200);
        setState(prev => ({ ...prev, stage: (prev.stage + 1) as Stage }));
      }
    }
  }, [totalPoints, state.stage]);

  function addFloater(x: number, y: number, type: string) {
    const id = ++floaterIdRef.current;
    setFloaters(f => [...f, { id, x, y, type }]);
    setTimeout(() => setFloaters(f => f.filter(fl => fl.id !== id)), 900);
  }

  function handleAction(type: "water" | "sun" | "fertilizer", e: React.MouseEvent | React.TouchEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    setState(prev => ({
      ...prev,
      [type]: prev[type] + (type === "fertilizer" ? 3 : type === "sun" ? 2 : 1.5),
    }));

    const icons: Record<string, string> = { water: "💧", sun: "☀️", fertilizer: "🌱" };
    addFloater(x, y, icons[type]);
    setPressing(type);
    setTimeout(() => setPressing(null), 200);
  }

  const nextThreshold = state.stage < MAX_STAGE ? STAGE_THRESHOLDS[state.stage + 1] : STAGE_THRESHOLDS[MAX_STAGE];
  const prevThreshold = STAGE_THRESHOLDS[state.stage];
  const progressPct = state.stage < MAX_STAGE
    ? Math.min(((totalPoints - prevThreshold) / (nextThreshold - prevThreshold)) * 100, 100)
    : 100;

  return (
    <div className="game-root">
      {/* Floating point indicators */}
      {floaters.map(fl => (
        <div
          key={fl.id}
          className="floater"
          style={{ left: fl.x, top: fl.y }}
        >
          {fl.type}
        </div>
      ))}

      {/* Header */}
      <div className="game-header">
        <div className="stage-label-wrap">
          <span className="stage-name">{STAGE_LABELS[state.stage]}</span>
          {state.stage < MAX_STAGE && (
            <span className="stage-num">Стадия {state.stage + 1} / {MAX_STAGE}</span>
          )}
          {state.stage === MAX_STAGE && (
            <span className="stage-num max">Максимум!</span>
          )}
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar">
            <motion.div
              className="progress-fill"
              animate={{ width: `${progressPct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          {state.stage < MAX_STAGE && (
            <span className="progress-label">{Math.floor(totalPoints)} / {nextThreshold}</span>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="main-area">
        {/* Action buttons */}
        <div className="action-buttons">
          {[
            { key: "water", icon: "💧", label: "Вода", color: "#4fc3f7" },
            { key: "sun", icon: "☀️", label: "Свет", color: "#ffd54f" },
            { key: "fertilizer", icon: "🌱", label: "Удобрение", color: "#a5d6a7" },
          ].map(btn => (
            <motion.button
              key={btn.key}
              className={`action-btn ${pressing === btn.key ? "pressing" : ""}`}
              style={{ "--btn-color": btn.color } as React.CSSProperties}
              onClick={(e) => handleAction(btn.key as "water" | "sun" | "fertilizer", e)}
              whileTap={{ scale: 0.88 }}
              animate={pressing === btn.key ? { boxShadow: `0 0 0 8px ${btn.color}55` } : { boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}
              transition={{ duration: 0.15 }}
            >
              <span className="btn-icon">{btn.icon}</span>
              <span className="btn-label">{btn.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Tree display */}
        <div className="tree-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.stage}
              className={`tree-img-wrap ${growing ? "growing" : ""}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
            >
              <TreeSVG stage={state.stage} />
            </motion.div>
          </AnimatePresence>

          {/* Stage-up popup */}
          <AnimatePresence>
            {showStageLabel && (
              <motion.div
                className="stage-up-popup"
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: -20, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.9 }}
                transition={{ duration: 0.5 }}
              >
                🌳 Дерево выросло!
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Resource bars */}
      <div className="resource-bars">
        <ResourceBar label="Вода" value={state.water} max={50} color="#4fc3f7" icon="💧" />
        <ResourceBar label="Свет" value={state.sun} max={50} color="#ffd54f" icon="☀️" />
        <ResourceBar label="Удобрение" value={state.fertilizer} max={50} color="#a5d6a7" icon="🌱" />
      </div>
    </div>
  );
}
