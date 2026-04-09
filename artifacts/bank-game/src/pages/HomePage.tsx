import { GameState, formatRub, getTreeProgress, getTreeStage } from "@/lib/storage";
import TreeSVG from "@/components/TreeSVG";
import { motion } from "framer-motion";
import { TrendingUp, Sprout, Zap } from "lucide-react";

interface Props {
  state: GameState;
}

export default function HomePage({ state }: Props) {
  const now = Date.now();
  const totalBalance = state.standardBalance + state.activeBalance;
  const totalEarned = state.standardEarned + state.activeEarned;
  const progress = getTreeProgress(state.startDate, now);
  const stage = getTreeStage(progress);
  const pct = Math.round(progress * 100);

  const stageNames = ["Росток", "Саженец", "Деревце", "Молодое дерево", "Могучее дерево"];

  return (
    <div className="home-page">
      {/* Hero balance card */}
      <div className="hero-card">
        <div className="hero-card-inner">
          <div className="hero-left">
            <p className="hero-label">Общий баланс</p>
            <h1 className="hero-balance">{formatRub(totalBalance)}</h1>
            <div className="hero-earned">
              <TrendingUp size={14} />
              <span>+{formatRub(totalEarned)} всего заработано</span>
            </div>
          </div>
          <div className="hero-tree">
            <TreeSVG stage={stage} size={120} />
          </div>
        </div>

        {/* Tree growth bar */}
        <div className="tree-growth-section">
          <div className="tree-growth-header">
            <span className="tree-stage-name">
              <Sprout size={13} />
              {stageNames[stage]}
            </span>
            <span className="tree-growth-pct">{pct}% роста</span>
          </div>
          <div className="tree-progress-bar">
            <motion.div
              className="tree-progress-fill"
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
          </div>
          <p className="tree-growth-caption">
            {progress < 1 ? "Дерево вырастет через 1 год от начала" : "Дерево достигло максимума!"}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="stat-label">Стандартный</p>
            <p className="stat-value">{formatRub(state.standardBalance)}</p>
            <p className="stat-sub">12% год.</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <Zap size={18} />
          </div>
          <div>
            <p className="stat-label">Активный</p>
            <p className="stat-value">{formatRub(state.activeBalance)}</p>
            <p className="stat-sub">до 15% год.</p>
          </div>
        </div>
      </div>

      {/* Recent history */}
      {state.history.length > 0 && (
        <div className="history-card">
          <h3 className="history-title">Последние начисления</h3>
          <div className="history-list">
            {[...state.history].reverse().slice(0, 6).map((item, i) => (
              <div key={i} className="history-item">
                <div className="history-dot" data-type={item.type} />
                <div className="history-info">
                  <span className="history-type">{item.type === "standard" ? "Стандартный вклад" : "Активный вклад"}</span>
                  <span className="history-date">{item.date}</span>
                </div>
                <span className="history-amount">+{formatRub(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
