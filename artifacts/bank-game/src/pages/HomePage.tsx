import { useState } from "react";
import {
  UserState,
  formatRub,
  formatTreeGrowth,
  getTreeStage,
  getTreeProgressFromMM,
  calcStandardDaily,
  TREE_STAGE_NAMES,
} from "@/lib/engine";
import TreeSVG from "@/components/TreeSVG";
import { motion } from "framer-motion";
import { TrendingUp, Sprout, Zap } from "lucide-react";

interface Props {
  state: UserState;
  notif?: boolean;
  onClearNotif?: () => void;
}

export default function HomePage({ state, notif, onClearNotif }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { standard, active, standardEarned, activeEarned } = state.balances;
  const totalBalance = standard + active;
  const totalEarned = standardEarned + activeEarned;

  const treeGrowthMM = state.game.treeGrowthMM ?? 0;
  const stage = getTreeStage(treeGrowthMM);
  const treeGrowthPct = getTreeProgressFromMM(treeGrowthMM) * 100;

  const dailyStd = calcStandardDaily(standard);
  const dailyAct = active * 0.15 / 365;

  return (
    <div className="home-page">
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
            <TreeSVG stage={stage} size={90} />
          </div>
        </div>

        <div className="tree-growth-section">
          <div className="tree-growth-header">
            <span className="tree-stage-name">
              <Sprout size={13} />
              {TREE_STAGE_NAMES[stage]}
            </span>
            <span className="tree-growth-pct">Рост дерева: {formatTreeGrowth(treeGrowthMM)}</span>
          </div>
          <p className="tree-growth-caption">Дерево растёт вместе с активным доходом</p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="stat-label">Стандартный</p>
            <p className="stat-value">{formatRub(standard)}</p>
            <p className="stat-sub">до {formatRub(dailyStd)}/день</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">
            <Zap size={18} />
          </div>
          <div>
            <p className="stat-label">Активный</p>
            <p className="stat-value">{formatRub(active)}</p>
            <p className="stat-sub">до {formatRub(dailyAct)}/день</p>
          </div>
        </div>
      </div>

      {(() => {
        const merged: { date: string; amount: number; label: string }[] = [];
        const reversed = [...state.history].reverse();
        let i = 0;
        while (i < reversed.length) {
          const item = reversed[i];
          const next = reversed[i + 1];
          if (
            (item.type === "base" || item.type === "bonus") &&
            next && (next.type === "base" || next.type === "bonus") &&
            next.type !== item.type
          ) {
            merged.push({ date: item.date, amount: item.amount + next.amount, label: "Активный вклад" });
            i += 2;
          } else {
            merged.push({
              date: item.date,
              amount: item.amount,
              label: item.type === "standard" ? "Стандартный вклад" : "Активный вклад",
            });
            i += 1;
          }
        }
        return (
          <div className="history-card">
            <div className="history-title-row" onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) onClearNotif?.(); }}>
              <h3 className="history-title">
                История начислений
                {notif && <span className="history-notif-dot" />}
              </h3>
              <span className="history-chevron">{historyOpen ? "▼" : "▶"}</span>
            </div>
            {historyOpen && (
              merged.length === 0 ? (
                <p className="history-empty">Начисления появятся после первой сессии</p>
              ) : (
                <div className="history-list history-list-scroll">
                  {merged.map((item, idx) => (
                    <div key={idx} className="history-item">
                      <div className="history-cell-left">
                        <span className="history-type">{item.label}</span>
                        <span className="history-date">{item.date}</span>
                      </div>
                      <span className="history-amount">+{formatRub(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        );
      })()}
    </div>
  );
}
