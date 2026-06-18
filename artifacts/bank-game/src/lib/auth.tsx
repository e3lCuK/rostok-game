import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, type AuthUser } from "./api";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, nickname: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.authMe()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const u = await api.login(username, password);
    setUser(u);
  }

  async function register(username: string, nickname: string, password: string) {
    const u = await api.register(username, nickname, password);
    setUser(u);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  async function updateNickname(nickname: string) {
    const u = await api.updateNickname(nickname);
    setUser(u);
  }

  async function updateEmail(email: string) {
    const u = await api.updateEmail(email);
    setUser(u);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api.changePassword(currentPassword, newPassword);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateNickname, updateEmail, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
