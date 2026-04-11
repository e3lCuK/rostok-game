import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Home, PiggyBank, Gamepad2, LogOut } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { APP_NAME, APP_VERSION, UserState, applyOfflineAccrual } from "@/lib/engine";
import HomePage from "@/pages/HomePage";
import SavingsPage from "@/pages/SavingsPage";
import GamePage from "@/pages/GamePage";
import OnboardingPage from "@/pages/OnboardingPage";
import "@/bank.css";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

// ---- Auth pages ----
function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="auth-center">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="auth-center">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

// ---- Landing for signed-out users ----
function LandingPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="landing-page">
      <div className="landing-hero">
        <span className="landing-icon">🌳</span>
        <h1 className="landing-title">{APP_NAME}</h1>
        <p className="landing-subtitle">Вкладывайте и наблюдайте за ростом своего дерева</p>
        <div className="landing-badge">{APP_VERSION} · Бета</div>
      </div>
      <div className="landing-features">
        <div className="landing-feature">
          <span>📈</span>
          <p>12% на стандартный вклад</p>
        </div>
        <div className="landing-feature">
          <span>⚡</span>
          <p>до 15% на активный вклад</p>
        </div>
        <div className="landing-feature">
          <span>🌱</span>
          <p>Дерево растёт вместе с балансом</p>
        </div>
      </div>
      <div className="landing-actions">
        <button className="landing-btn-primary" onClick={() => setLocation("/sign-up")}>
          Начать
        </button>
        <button className="landing-btn-secondary" onClick={() => setLocation("/sign-in")}>
          Войти
        </button>
      </div>
    </div>
  );
}

// ---- Home redirect ----
function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/app" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

// ---- Main app shell ----
type Tab = "home" | "savings" | "game";
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Главная", icon: Home },
  { id: "savings", label: "Вклады", icon: PiggyBank },
  { id: "game", label: "Игра", icon: Gamepad2 },
];

function AppShell() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, setLocation] = useLocation();
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
      // Accrue offline days
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

  function handleStateChange(next: UserState) {
    setState(next);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
  }

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
            <div className="bank-header-badge">Бета | {APP_VERSION}</div>
            {user && (
              <button
                className="bank-header-signout"
                onClick={() => signOut(() => setLocation("/"))}
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
            {tab === "home" && <HomePage state={state} />}
            {tab === "savings" && <SavingsPage state={state} onTabChange={handleTabChange} />}
            {tab === "game" && (
              <GamePage
                state={state}
                onStateChange={handleStateChange}
                onResetToOnboarding={() => { setState(null); setOnboarding(true); }}
              />
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
    </div>
  );
}

function ProtectedApp() {
  return (
    <>
      <Show when="signed-in">
        <AppShell />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

// ---- Query cache invalidation on user change ----
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    return addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== uid) {
        qc.clear();
      }
      prevUserIdRef.current = uid;
    });
  }, [addListener, qc]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/app" component={ProtectedApp} />
          <Route><Redirect to="/" /></Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}
