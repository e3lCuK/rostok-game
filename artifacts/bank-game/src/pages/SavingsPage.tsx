import {
  UserState,
  formatRub,
  calcStandardDaily,
  calcActiveDaily,
  calcSessionReward,
} from "@/lib/engine";
import { TrendingUp, Zap, Lock, ChevronRight } from "lucide-react";

interface Props {
  state: UserState;
  onTabChange: (tab: "game") => void;
}

export default function SavingsPage({ state, onTabChange }: Props) {
  const { standard, active, standardEarned, activeEarned } = state.balances;

  const { streakDays } = state.game;
  const totalBalance = standard + active;

  const standardAnnual = standard * 0.12;
  const activeAnnual = active * 0.15;
  const stdDaily = calcStandardDaily(standard);
  const actDaily = calcActiveDaily(active);
  const sessionReward = calcSessionReward(active, totalBalance, streakDays);

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
            <span className="deposit-badge deposit-badge-green">до 15% годовых</span>
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

        <div className="deposit-info-box deposit-info-box-green">
          <p>Доход зависит от активности. Ухаживайте за деревом раз в 8 часов — получайте повышенный процент.</p>
        </div>
      </div>
    </div>
  );
}
