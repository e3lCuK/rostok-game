import { useState } from "react";
import { motion } from "framer-motion";
import { CAPITAL_OPTIONS, formatCapital, calcStandardDaily, calcSessionReward } from "@/lib/engine";

interface Props {
  onComplete: (capital: number) => Promise<void>;
}

export default function OnboardingPage({ onComplete }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const labels: Record<number, string> = {
    20_000: "Начальный",
    200_000: "Стандартный",
    2_000_000: "Премиум",
  };

  const descriptions: Record<number, string> = {
    20_000: "Подходит для знакомства с приложением",
    200_000: "Оптимальный баланс роста",
    2_000_000: "Максимальная скорость роста дерева",
  };

  async function handleStart() {
    if (!selected) return;
    setLoading(true);
    try {
      await onComplete(selected);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-header">
        <span className="onboarding-icon">🌱</span>
        <h1 className="onboarding-title">Выберите стартовый капитал</h1>
        <p className="onboarding-sub">Капитал делится поровну между стандартным и активным вкладами</p>
      </div>

      <div className="onboarding-options">
        {CAPITAL_OPTIONS.map((cap) => {
          const half = cap / 2;
          const daily = calcStandardDaily(half);
          const sessionR = calcSessionReward(half);
          const isSelected = selected === cap;

          return (
            <motion.button
              key={cap}
              className={`capital-option ${isSelected ? "capital-option-selected" : ""}`}
              onClick={() => setSelected(cap)}
              whileTap={{ scale: 0.97 }}
            >
              <div className="capital-option-header">
                <div>
                  <p className="capital-option-label">{labels[cap]}</p>
                  <p className="capital-option-amount">{formatCapital(cap)}</p>
                </div>
                <div className={`capital-option-radio ${isSelected ? "capital-option-radio-active" : ""}`} />
              </div>
              <p className="capital-option-desc">{descriptions[cap]}</p>
              <div className="capital-option-stats">
                <div className="capital-stat">
                  <p className="capital-stat-label">В день (пасс.)</p>
                  <p className="capital-stat-value">~{daily.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</p>
                </div>
                <div className="capital-stat">
                  <p className="capital-stat-label">За сессию</p>
                  <p className="capital-stat-value">~{sessionR.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <motion.button
        className={`onboarding-start-btn ${!selected ? "onboarding-start-btn-disabled" : ""}`}
        onClick={handleStart}
        disabled={!selected || loading}
        whileTap={selected ? { scale: 0.97 } : {}}
      >
        {loading ? "Создание счёта..." : "Открыть счёт"}
      </motion.button>
    </div>
  );
}
