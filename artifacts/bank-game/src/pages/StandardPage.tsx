import { useState } from "react";
import {
  UserState,
  formatRub,
  calcStandardDaily,
} from "@/lib/engine";
import { TrendingUp, Lock } from "lucide-react";

interface Props {
  state: UserState;
}

export default function StandardPage({ state }: Props) {
  const [historyOpen, setHistoryOpen] = useState(true);
  const { standard, standardEarned } = state.balances;
  const stdDaily = calcStandardDaily(standard);
  const standardAnnual = standard * 0.12;

  const stdHistory = [...state.history]
    .filter(h => h.type === "standard")
    .reverse();

  return (
    <div className="savings-page">
      <h2 className="page-title">Стандартный вклад</h2>

      <div className="deposit-card deposit-card-standard">
        <div className="deposit-header">
          <div className="deposit-icon-wrap deposit-icon-blue">
            <Lock size={20} />
          </div>
          <div>
            <p className="deposit-name">Стандартный вклад</p>
            <span className="deposit-badge deposit-badge-blue">12,0% годовых</span>
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
            <p className="deposit-stat-label">Ставка</p>
            <p className="deposit-stat-value">12% годовых</p>
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
          <p>Пассивный доход начисляется автоматически каждые 24 часа</p>
        </div>
      </div>

      <div className="history-card">
        <div className="history-title-row" onClick={() => setHistoryOpen(!historyOpen)}>
          <h3 className="history-title">История начислений</h3>
          <span className="history-chevron">{historyOpen ? "▼" : "▶"}</span>
        </div>
        {historyOpen && (
          stdHistory.length === 0 ? (
            <p className="std-history-empty">Начисления появятся через 24 часа</p>
          ) : (
            <div className="history-list history-list-scroll">
              {stdHistory.slice(0, 30).map((item, idx) => (
                <div key={idx} className="history-item">
                  <div className="history-cell-left">
                    <span className="history-type">Стандартный вклад</span>
                    <span className="history-date">{item.date}</span>
                  </div>
                  <span className="history-amount">+{formatRub(item.amount)}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
