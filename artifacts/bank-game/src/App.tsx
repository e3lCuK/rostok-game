import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { Home, PiggyBank, TrendingUp, Zap, LogOut } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { APP_NAME, APP_VERSION, UserState, applyOfflineAccrual } from "@/lib/engine";
import HomePage from "@/pages/HomePage";
import SavingsPage from "@/pages/SavingsPage";
import StandardPage from "@/pages/StandardPage";
import GamePage from "@/pages/GamePage";
import OnboardingPage from "@/pages/OnboardingPage";
import AuthPage from "@/pages/AuthPage";
import DebugPanel from "@/components/DebugPanel";
import "@/bank.css";

// ---- Tab bar ----
type Tab = "home" | "savings" | "standard" | "active";
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home",     label: "Главная",     icon: Home },
  { id: "savings",  label: "Вклады",      icon: PiggyBank },
  { id: "standard", label: "Стандартный", icon: TrendingUp },
  { id: "active",   label: "Активный",    icon: Zap },
];

// ---- Main app shell (authenticated) ----
function AppShell() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<UserState | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getState();
      if (!data.exists) {
        setOnboarding(true);
        setLoading(false);
        return;
      }
      let userState: UserState = {
        balances: data.balances!,
        game: data.game!,
        history: data.history!,
      };
      const { state: accrued } = applyOfflineAccrual(userState);
      if (accrued !== userState) {
        api.accrue().catch(() => {});
        userState = accrued;
      }
      setState(userState);
    } catch {
      // silent retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  async function handleOnboardingComplete(capital: number) {
    await api.initAccount(capital);
    setOnboarding(false);
    await loadState();
  }

  function handleStateChange(next: UserState) { setState(next); }
  function handleTabChange(t: Tab) { setTab(t); }

  if (loading) {
    return (
      <div className="bank-app">
        <div className="bank-loading">
          <span className="bank-loading-icon">🌳</span>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (onboarding) {
    return (
      <div className="bank-app">
        <OnboardingPage onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="bank-app">
        <div className="bank-loading">
          <p>Ошибка загрузки. Попробуйте обновить страницу.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bank-app">
      <div className="status-bar" />
      <header className="bank-header">
        <div className="bank-header-inner">
          <div className="bank-logo">
            <span className="bank-logo-icon">🌳</span>
            <span className="bank-logo-text">{APP_NAME}</span>
          </div>
          <div className="bank-header-right">
            <div className="bank-header-badge">Бета {APP_VERSION}</div>
            {user && (
              <button
                className="bank-header-signout"
                onClick={() => logout()}
                title="Выйти"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="bank-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="bank-page"
          >
            {tab === "home"     && <HomePage state={state} />}
            {tab === "savings"  && <SavingsPage state={state} onTabChange={handleTabChange} />}
            {tab === "standard" && <StandardPage state={state} />}
            {tab === "active"   && (
              <GamePage state={state} onStateChange={handleStateChange} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bank-nav">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`bank-nav-btn ${tab === id ? "bank-nav-btn-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.6} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {state && (
        <DebugPanel
          state={state}
          onStateChange={handleStateChange}
          onResetAccount={() => { setState(null); setOnboarding(true); }}
          onSignOut={logout}
        />
      )}
    </div>
  );
}

// ---- Root ----
function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="bank-app">
        <div className="bank-loading">
          <span className="bank-loading-icon">🌳</span>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <AppShell />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </QueryClientProvider>
  );
}
