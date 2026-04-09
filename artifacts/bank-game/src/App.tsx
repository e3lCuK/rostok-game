import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Home, PiggyBank, Gamepad2 } from "lucide-react";
import { loadState, saveState, accrueDailyIncome, GameState } from "@/lib/storage";
import HomePage from "@/pages/HomePage";
import SavingsPage from "@/pages/SavingsPage";
import GamePage from "@/pages/GamePage";
import "@/bank.css";

type Tab = "home" | "savings" | "game";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Главная", icon: Home },
  { id: "savings", label: "Вклады", icon: PiggyBank },
  { id: "game", label: "Игра", icon: Gamepad2 },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [state, setState] = useState<GameState>(() => {
    const s = loadState();
    return accrueDailyIncome(s);
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  const handleStateChange = useCallback((next: GameState) => {
    setState(next);
  }, []);

  function handleTabChange(t: Tab | "game") {
    setTab(t as Tab);
  }

  return (
    <div className="bank-app">
      {/* Status bar space */}
      <div className="status-bar" />

      {/* App header */}
      <header className="bank-header">
        <div className="bank-header-inner">
          <div className="bank-logo">
            <span className="bank-logo-icon">🌳</span>
            <span className="bank-logo-text">TreeBank</span>
          </div>
          <div className="bank-header-badge">Бета</div>
        </div>
      </header>

      {/* Page content */}
      <main className="bank-main">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="bank-page"
        >
          {tab === "home" && <HomePage state={state} />}
          {tab === "savings" && <SavingsPage state={state} onTabChange={handleTabChange} />}
          {tab === "game" && <GamePage state={state} onStateChange={handleStateChange} />}
        </motion.div>
      </main>

      {/* Bottom tabs */}
      <nav className="bank-nav">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`bank-nav-btn ${tab === id ? "bank-nav-btn-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.6} />
            <span>{label}</span>
            {id === "game" && (
              <span className="bank-nav-badge" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
