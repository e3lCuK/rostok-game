import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

const router = Router();

// POST /api/auth/register
router.post("/auth/register", async (req: any, res: any) => {
  const { username, nickname, password } = req.body ?? {};

  if (!username || !nickname || !password) {
    return res.status(400).json({ error: "Все поля обязательны" });
  }
  const u = String(username).trim();
  const n = String(nickname).trim();
  const p = String(password);

  if (u.length < 3 || u.length > 30) {
    return res.status(400).json({ error: "Логин: от 3 до 30 символов" });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    return res.status(400).json({ error: "Логин: только латиница, цифры и _" });
  }
  if (n.length < 1 || n.length > 50) {
    return res.status(400).json({ error: "Ник: от 1 до 50 символов" });
  }
  if (p.length < 6) {
    return res.status(400).json({ error: "Пароль: минимум 6 символов" });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [u.toLowerCase()],
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Логин уже занят" });
    }

    const hash = await bcrypt.hash(p, 10);
    const result = await pool.query(
      "INSERT INTO users (username, nickname, password_hash) VALUES ($1, $2, $3) RETURNING id, username, nickname",
      [u.toLowerCase(), n, hash],
    );
    const user = result.rows[0];
    req.session.userId = user.id;
    req.log.info({ username: user.username }, "User registered");
    return res.json({ id: user.id, username: user.username, nickname: user.nickname });
  } catch (err) {
    req.log.error({ err }, "Register error");
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/auth/login
router.post("/auth/login", async (req: any, res: any) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: "Введите логин и пароль" });
  }

  try {
    const result = await pool.query(
      "SELECT id, username, nickname, password_hash FROM users WHERE username = $1",
      [String(username).toLowerCase()],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }
    req.session.userId = user.id;
    req.log.info({ username: user.username }, "User logged in");
    return res.json({ id: user.id, username: user.username, nickname: user.nickname });
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req: any, res: any) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.json({ success: true });
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req: any, res: any) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(
      "SELECT id, username, nickname FROM users WHERE id = $1",
      [userId],
    );
    if (result.rows.length === 0) return res.status(401).json({ error: "Not found" });
    const user = result.rows[0];
    return res.json({ id: user.id, username: user.username, nickname: user.nickname });
  } catch (err) {
    req.log.error({ err }, "Me error");
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
