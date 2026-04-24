import { useState } from "react";
import {
  UserState,
  formatRub,
  calcStandardDaily,
  calcActiveDaily,
  calcSessionReward,
  calcActivityBonus,
} from "@/lib/engine";
import { TrendingUp, Zap, Lock, ChevronRight, HelpCircle, X } from "lucide-react";

interface Props {
  state: UserState;
  onTabChange: (tab: "game") => void;
}

export default function SavingsPage({ state, onTabChange }: Props) {
  const { standard, active, standardEarned, activeEarned } = state.balances;
  const { streakDays, missedSessions } = state.game;
  const totalBalance = standard + active;
  const [showTooltip, setShowTooltip] = useState(false);

  const standardAnnual = standard * 0.12;
  const activeAnnual = active * 0.15;
  const stdDaily = calcStandardDaily(standard);
  const actDaily = calcActiveDaily(active);
  const sessionReward = calcSessionReward(active, totalBalance, streakDays, 80, missedSessions);
  const activityBonus = calcActivityBonus(missedSessions);

  return (
    <div className="savings-page">
      <h2 className="page-title">Мои вклады</h2>

      <div className="deposit-card deposit-card-standard">
        <div className="deposit-header">
          <div className="deposit-icon-wrap deposit-icon-blue">
            <Lock size={20} />
          </div>
          <div>
            <p className="deposit-name">Стандартный вклад</p>
            <span className="deposit-badge deposit-badge-blue">12% годовых</span>
          </div>
          <TrendingUp size={18} className="deposit-trend" />
        </div>

        <div className="deposit-balance-row">
          <div>
            <p className="deposit-balance-label">Баланс</p>
            <p className="deposit-balance">{formatRub(standard)}</p>
          </div>
          <div className="text-right">
            <p className="deposit-balance-label">Заработано</p>
            <p className="deposit-earned">+{formatRub(standardEarned)}</p>
          </div>
        </div>

        <div className="deposit-divider" />

        <div className="deposit-stats">
          <div className="deposit-stat">
            <p className="deposit-stat-label">Годовой доход</p>
            <p className="deposit-stat-value">{formatRub(standardAnnual)}</p>
          </div>
          <div className="deposit-stat">
            <p className="deposit-stat-label">В день</p>
            <p className="deposit-stat-value">{formatRub(stdDaily)}</p>
          </div>
          <div className="deposit-stat">
            <p className="deposit-stat-label">Режим</p>
            <p className="deposit-stat-value">Авто</p>
          </div>
        </div>

        <div className="deposit-info-box deposit-info-box-blue">
          <p>Пассивный доход начисляется автоматически каждые 24 часа. Никаких действий не требуется.</p>
        </div>
      </div>

      <div className="deposit-card deposit-card-green" onClick={() => onTabChange("game")}>
        <div className="deposit-header">
          <div className="deposit-icon-wrap deposit-icon-green">
            <Zap size={20} />
          </div>
          <div>
            <p className="deposit-name">Активный вклад</p>
            <span className="deposit-badge deposit-badge-green">до {(12 + activityBonus).toFixed(1)}% годовых</span>
          </div>
          <ChevronRight size={18} className="deposit-trend" />
        </div>

        <div className="deposit-balance-row">
          <div>
            <p className="deposit-balance-label">Баланс</p>
            <p className="deposit-balance">{formatRub(active)}</p>
          </div>
          <div className="text-right">
            <p className="deposit-balance-label">Заработано</p>
            <p className="deposit-earned deposit-earned-green">+{formatRub(activeEarned)}</p>
          </div>
        </div>

        <div className="deposit-divider" />

        <div className="deposit-stats">
          <div className="deposit-stat">
            <p className="deposit-stat-label">Макс. доход/год</p>
            <p className="deposit-stat-value">{formatRub(activeAnnual)}</p>
          </div>
          <div className="deposit-stat">
            <p className="deposit-stat-label">В день</p>
            <p className="deposit-stat-value">{formatRub(actDaily)}</p>
          </div>
          <div className="deposit-stat">
            <p className="deposit-stat-label">За сессию</p>
            <p className="deposit-stat-value">~{formatRub(sessionReward)}</p>
          </div>
        </div>

        {missedSessions > 1 && (
          <div
            className="missed-sessions-row"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="missed-sessions-label">
              Пропущенные сессии: <strong>{missedSessions}</strong>
            </span>
            <button className="super-session-btn" disabled>
              Супер-сессия
            </button>
            <button
              className="missed-sessions-help"
              onClick={(e) => { e.stopPropagation(); setShowTooltip(true); }}
              title="Подробнее"
            >
              <HelpCircle size={18} />
            </button>
          </div>
        )}

        <div className="deposit-info-box deposit-info-box-green">
          <p>Доход зависит от активности. Ухаживайте за деревом раз в 8 часов — получайте повышенный процент.</p>
        </div>
      </div>

      {showTooltip && (
        <div className="tooltip-overlay" onClick={() => setShowTooltip(false)}>
          <div className="tooltip-modal" onClick={(e) => e.stopPropagation()}>
            <button className="tooltip-close" onClick={() => setShowTooltip(false)}>
              <X size={18} />
            </button>
            <h3 className="tooltip-title">Бонус активности</h3>
            <p className="tooltip-body">
              Бонус к доходу уменьшается, если вы пропускаете сессии:
            </p>
            <div className="tooltip-table">
              <div className={`tooltip-row ${missedSessions <= 3 ? "tooltip-row-active" : ""}`}>
                <span>1–3 сессии</span><span>+3%</span>
              </div>
              <div className={`tooltip-row ${missedSessions > 3 && missedSessions <= 9 ? "tooltip-row-active" : ""}`}>
                <span>4–9 сессий</span><span>+2%</span>
              </div>
              <div className={`tooltip-row ${missedSessions > 9 && missedSessions <= 21 ? "tooltip-row-active" : ""}`}>
                <span>10–21 сессия</span><span>+1%</span>
              </div>
              <div className={`tooltip-row ${missedSessions > 21 ? "tooltip-row-active" : ""}`}>
                <span>Более 21</span><span>+0.5%</span>
              </div>
            </div>
            <p className="tooltip-hint">Вы можете восстановить бонус, играя регулярно.</p>
          </div>
        </div>
      )}
    </div>
  );
}
