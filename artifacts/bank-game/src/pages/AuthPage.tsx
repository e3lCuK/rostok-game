import { useState } from "react";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "register";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (password !== confirm) {
        setError("Пароли не совпадают");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), nickname.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🌳</span>
          <span className="auth-logo-text">Банк</span>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === "login" ? " auth-tab-active" : ""}`}
            onClick={() => switchMode("login")}
            type="button"
          >
            Войти
          </button>
          <button
            className={`auth-tab${mode === "register" ? " auth-tab-active" : ""}`}
            onClick={() => switchMode("register")}
            type="button"
          >
            Зарегистрироваться
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="off">
          <div className="auth-field">
            <label className="auth-label">Логин</label>
            <input
              className="auth-input"
              type="text"
              placeholder="только латиница, цифры, _"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          {mode === "register" && (
            <div className="auth-field">
              <label className="auth-label">Ник</label>
              <input
                className="auth-input"
                type="text"
                placeholder="отображаемое имя"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label">Пароль</label>
            <input
              className="auth-input"
              type="password"
              placeholder={mode === "register" ? "минимум 6 символов" : ""}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === "register" && (
            <div className="auth-field">
              <label className="auth-label">Повторить пароль</label>
              <input
                className="auth-input"
                type="password"
                placeholder=""
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? "..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        {mode === "register" && (
          <p className="auth-note">Сброс пароля будет добавлен позже</p>
        )}
      </div>
    </div>
  );
}
