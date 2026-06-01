import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getLevelProgress } from "@/lib/levels";

interface Props {
  totalXP: number;
  level: number;
  xpGain?: number | null;
}

export default function LevelWidget({ totalXP, level, xpGain }: Props) {
  const progress = getLevelProgress(totalXP);
  const [showGain, setShowGain] = useState(false);
  const [gainVal, setGainVal] = useState(0);
  const [barPct, setBarPct] = useState(() =>
    progress.xpNeeded ? Math.min(100, (progress.xpInLevel / progress.xpNeeded) * 100) : 100
  );
  const barTarget = progress.xpNeeded
    ? Math.min(100, (progress.xpInLevel / progress.xpNeeded) * 100)
    : 100;
  const barAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (xpGain) {
      setGainVal(xpGain);
      setShowGain(true);
      const t = setTimeout(() => setShowGain(false), 1400);
      return () => clearTimeout(t);
    }
  }, [xpGain]);

  useEffect(() => {
    if (barAnimRef.current) clearTimeout(barAnimRef.current);
    barAnimRef.current = setTimeout(() => setBarPct(barTarget), 80);
    return () => { if (barAnimRef.current) clearTimeout(barAnimRef.current); };
  }, [barTarget]);

  return (
    <div className="level-widget-wrap">
      <motion.div
        className="level-widget"
        animate={showGain
          ? { scale: [1, 1.1, 1], boxShadow: ["0 0 0px rgba(134,239,172,0)", "0 0 14px rgba(134,239,172,0.8)", "0 0 0px rgba(134,239,172,0)"] }
          : { scale: 1, boxShadow: "0 0 0px rgba(134,239,172,0)" }
        }
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <div className="level-widget-top">
          <span className="level-widget-lvl">Ур.{level}</span>
        </div>
        <span className="level-widget-xp">
          {progress.isMax ? "MAX" : `${progress.xpInLevel} / ${progress.xpNeeded} опыт`}
        </span>
        <div className="level-widget-bar-track">
          <div
            className="level-widget-bar-fill"
            style={{ width: `${barPct}%`, transition: "width 0.5s ease" }}
          />
        </div>
      </motion.div>

      <AnimatePresence>
        {showGain && (
          <motion.div
            key={gainVal}
            className="level-widget-gain"
            initial={{ opacity: 1, y: 0, x: "-50%" }}
            animate={{ opacity: 0, y: -32, x: "-50%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            +{gainVal} опыт
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
