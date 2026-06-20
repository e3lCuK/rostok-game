import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { CAPITAL_OPTIONS, formatCapital, calcStandardDaily } from "@/lib/engine";

interface Props {
  onComplete: (capital: number) => Promise<void>;
}

export default function OnboardingPage({ onComplete }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const isSubmitting = useRef(false);

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

    isSubmitting.current = true;
    setError(null);
    setLoading(true);
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

      <div className="onboarding-info">
        <button className="onboarding-info-toggle" onClick={() => setInfoOpen(v => !v)}>
          <span>Как это работает?</span>
          <motion.span
            animate={{ rotate: infoOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: "flex" }}
          >
            <ChevronDown size={16} />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {infoOpen && (
            <motion.div
              key="info-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <p className="onboarding-info-text">
                Вкладывать ничего не нужно — это учебный счёт. В дальнейшем рост дерева зависит от того, сколько вы готовы выделить под накопления: чем больше сумма, тем заметнее влияние на скорость роста.
              </p>
              <div className="onboarding-rates">
                <span className="onboarding-rate-badge">Стандартный вклад — <strong>12%</strong> годовых</span>
                <span className="onboarding-rate-badge">Активный вклад — <strong>15%</strong> годовых</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="onboarding-options">
        {CAPITAL_OPTIONS.map((cap) => {
          const half = cap / 2;
          const daily = calcStandardDaily(half);
          const dailyActiveMax = half * 0.15 / 365;
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
                  <p className="capital-stat-label">В день (стан.)</p>
                  <p className="capital-stat-value">до {daily.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</p>
                </div>
                <div className="capital-stat">
                  <p className="capital-stat-label">В день (акт.)</p>
                  <p className="capital-stat-value">до {dailyActiveMax.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</p>
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
