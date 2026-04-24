import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/react";
import { CAPITAL_OPTIONS, formatCapital, calcStandardDaily, calcSessionReward } from "@/lib/engine";

interface Props {
  onComplete: (capital: number) => Promise<void>;
}

export default function OnboardingPage({ onComplete }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSubmitting = useRef(false);
  const { getToken } = useAuth();

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
    if (selected === null) return;
    if (loading) return;
    if (isSubmitting.current) return;

    const token = await getToken();
    if (!token) {
      console.warn("Token not ready");
      setError("Сессия не готова. Попробуйте снова.");
      return;
    }

    isSubmitting.current = true;
    setError(null);
    setLoading(true);
    console.log("CLICK FIRED", selected);
    console.log("loading:", loading);

    try {
      await onComplete(selected);
    } catch (e: unknown) {
      console.error("Account creation failed:", e);
      setError("Ошибка создания счёта. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
      isSubmitting.current = false;
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

      {error && <p style={{ color: "red", textAlign: "center", fontSize: 14, marginBottom: 8 }}>{error}</p>}

      <motion.button
        className={`onboarding-start-btn ${selected === null ? "onboarding-start-btn-disabled" : ""}`}
        onClick={handleStart}
        disabled={selected === null || loading}
        whileTap={selected !== null ? { scale: 0.97 } : {}}
      >
        {loading ? "Создание счёта..." : "Открыть счёт"}
      </motion.button>
    </div>
  );
}
