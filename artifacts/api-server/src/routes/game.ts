import { Router } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";

const COOLDOWN_MS = 8 * 60 * 60 * 1000;

function calcActivityBonus(missedSessions: number): number {
  if (missedSessions <= 3) return 3;
  if (missedSessions <= 9) return 2;
  if (missedSessions <= 21) return 1;
  return 0.5;
}

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.userId = userId;
  next();
}

// GET /api/game/state — load full user state
router.get("/game/state", requireAuth, async (req: any, res) => {
  const userId = req.userId;
  try {
    const [accRow, gameRow, historyRows] = await Promise.all([
      pool.query("SELECT * FROM accounts WHERE user_id = $1", [userId]),
      pool.query("SELECT * FROM game_state WHERE user_id = $1", [userId]),
      pool.query(
        "SELECT amount, type, earned_date FROM income_history WHERE user_id = $1 ORDER BY id DESC LIMIT 30",
        [userId],
      ),
    ]);

    if (accRow.rows.length === 0) {
      return res.json({ exists: false });
    }

    const acc = accRow.rows[0];
    const game = gameRow.rows[0] || {};

    return res.json({
      exists: true,
      balances: {
        standard: parseFloat(acc.standard_balance),
        active: parseFloat(acc.active_balance),
        standardEarned: parseFloat(acc.standard_earned),
        activeEarned: parseFloat(acc.active_earned),
        totalDaysEarned: acc.total_days_earned,
        startDate: parseInt(acc.start_date),
      },
      game: {
        lastSessionTime: game.last_session_time ? parseInt(game.last_session_time) : null,
        sessionInProgress: game.session_in_progress || false,
        water: game.current_session_water || false,
        sun: game.current_session_sun || false,
        fertilizer: game.current_session_fertilizer || false,
        streakDays: game.streak_days || 0,
        missedSessions: game.missed_sessions || 0,
      },
      history: historyRows.rows.map((r: any) => ({
        amount: parseFloat(r.amount),
        type: r.type,
        date: r.earned_date,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching game state");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/game/init — create account with starting capital
router.post("/game/init", requireAuth, async (req: any, res) => {
  const userId = req.userId;
  const { startingCapital } = req.body;

  const capital = Number(startingCapital);
  if (!capital || capital <= 0 || !Number.isFinite(capital)) {
    return res.status(400).json({ error: "Invalid starting capital" });
  }

  const half = capital / 2;
  const now = Date.now();

  try {
    const existing = await pool.query("SELECT user_id FROM accounts WHERE user_id = $1", [userId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Account already exists" });
    }

    await pool.query(
      `INSERT INTO accounts(user_id, standard_balance, active_balance, standard_earned, active_earned, total_days_earned, start_date)
       VALUES($1, $2, $3, 0, 0, 0, $4)`,
      [userId, half, half, now],
    );
    await pool.query(
      `INSERT INTO game_state(user_id, last_session_time, session_in_progress, current_session_water, current_session_sun, current_session_fertilizer)
       VALUES($1, NULL, FALSE, FALSE, FALSE, FALSE)`,
      [userId],
    );

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error initializing account");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/game/accrue — accrue daily passive income
router.post("/game/accrue", requireAuth, async (req: any, res) => {
  const userId = req.userId;
  try {
    const accRow = await pool.query("SELECT * FROM accounts WHERE user_id = $1", [userId]);
    if (accRow.rows.length === 0) return res.status(404).json({ error: "Account not found" });

    const acc = accRow.rows[0];
    const startDate = parseInt(acc.start_date);
    const now = Date.now();
    const daysSinceStart = (now - startDate) / 86_400_000;
    const daysToAccrue = Math.floor(daysSinceStart) - acc.total_days_earned;

    if (daysToAccrue <= 0) return res.json({ accrued: 0 });

    const stdBalance = parseFloat(acc.standard_balance);
    const stdDaily = stdBalance * 0.12 / 365;
    const stdIncome = stdDaily * daysToAccrue;

    const history = Array.from({ length: daysToAccrue }, (_, i) => ({
      date: new Date(startDate + (acc.total_days_earned + i + 1) * 86_400_000).toLocaleDateString("ru-RU"),
      amount: stdDaily,
    }));

    await pool.query(
      `UPDATE accounts SET
        standard_balance = standard_balance + $1,
        standard_earned = standard_earned + $1,
        total_days_earned = total_days_earned + $2
       WHERE user_id = $3`,
      [stdIncome, daysToAccrue, userId],
    );

    for (const h of history) {
      await pool.query(
        "INSERT INTO income_history(user_id, amount, type, earned_date) VALUES($1, $2, 'standard', $3)",
        [userId, h.amount, h.date],
      );
    }

    return res.json({ accrued: stdIncome, days: daysToAccrue });
  } catch (err) {
    req.log.error({ err }, "Error accruing income");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/game/session/start — begin a session
router.post("/game/session/start", requireAuth, async (req: any, res) => {
  const userId = req.userId;

  try {
    const gameRow = await pool.query("SELECT * FROM game_state WHERE user_id = $1", [userId]);
    if (gameRow.rows.length === 0) return res.status(404).json({ error: "Account not found" });

    const g = gameRow.rows[0];
    const now = Date.now();

    if (g.session_in_progress) {
      return res.status(409).json({ error: "Session already in progress" });
    }

    if (g.last_session_time && now - parseInt(g.last_session_time) < COOLDOWN_MS) {
      const nextAvailable = parseInt(g.last_session_time) + COOLDOWN_MS;
      return res.status(429).json({ error: "Session locked", nextAvailable });
    }

    // Calculate how many sessions were missed since the last one
    let additionalMissed = 0;
    if (g.last_session_time) {
      const elapsed = now - parseInt(g.last_session_time);
      // Each COOLDOWN_MS window is one session slot; first one is the expected slot
      additionalMissed = Math.max(0, Math.floor(elapsed / COOLDOWN_MS) - 1);
    }
    const newMissedSessions = (g.missed_sessions || 0) + additionalMissed;

    await pool.query(
      `UPDATE game_state
       SET session_in_progress = TRUE,
           current_session_water = FALSE,
           current_session_sun = FALSE,
           current_session_fertilizer = FALSE,
           missed_sessions = $2,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, newMissedSessions],
    );

    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error starting session");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/game/session/action — perform water/sun/fertilizer
router.post("/game/session/action", requireAuth, async (req: any, res) => {
  const userId = req.userId;
  const { action, skillScore: rawSkillScore } = req.body;
  const skillScore: number = typeof rawSkillScore === "number" && !isNaN(rawSkillScore) && rawSkillScore >= 0 && rawSkillScore <= 80
    ? rawSkillScore
    : 40;

  if (!["water", "sun", "fertilizer"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    const [gameRow, accRow] = await Promise.all([
      pool.query("SELECT * FROM game_state WHERE user_id = $1", [userId]),
      pool.query("SELECT * FROM accounts WHERE user_id = $1", [userId]),
    ]);

    if (gameRow.rows.length === 0 || accRow.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const g = gameRow.rows[0];
    const acc = accRow.rows[0];

    if (!g.session_in_progress) {
      return res.status(409).json({ error: "No active session" });
    }

    if (g[`current_session_${action}`]) {
      return res.status(409).json({ error: "Action already performed" });
    }

    await pool.query(
      `UPDATE game_state SET current_session_${action} = TRUE, updated_at = NOW() WHERE user_id = $1`,
      [userId],
    );

    // Check if all 3 actions done
    const updated = await pool.query("SELECT * FROM game_state WHERE user_id = $1", [userId]);
    const u = updated.rows[0];
    const allDone = u.current_session_water && u.current_session_sun && u.current_session_fertilizer;

    let reward = 0;
    let sessionF = 0;
    if (allDone) {
      const activeBalance = parseFloat(acc.active_balance);
      const standardBalance = parseFloat(acc.standard_balance);
      const totalBalance = activeBalance + standardBalance;
      const now = Date.now();

      // Streak logic: increment if last session was within 48h, reset otherwise
      const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;
      const lastSessionTime = g.last_session_time ? parseInt(g.last_session_time) : null;
      const currentStreak: number = g.streak_days || 0;
      let newStreak: number;
      if (!lastSessionTime || now - lastSessionTime > STREAK_WINDOW_MS) {
        newStreak = 1;
      } else {
        newStreak = Math.min(currentStreak + 1, 7);
      }

      // F = activityBonus + skillScore + streakBonus, capped at 100%
      const activityBonus = calcActivityBonus(g.missed_sessions || 0);
      const streakBonus = Math.min(newStreak, 7);
      const F = Math.min(activityBonus + skillScore + streakBonus, 100);
      const dailyIncome = activeBalance * 0.15 / 365;
      reward = dailyIncome * (F / 100) / 3;

      sessionF = F;
      req.log.info({ skillScore, activityBonus, streakBonus, F, reward }, "Session reward calculated");

      const earnedDate = new Date(now).toLocaleDateString("ru-RU");

      await pool.query(
        `UPDATE game_state SET
          session_in_progress = FALSE,
          last_session_time = $1,
          streak_days = $2,
          current_session_water = FALSE,
          current_session_sun = FALSE,
          current_session_fertilizer = FALSE,
          updated_at = NOW()
         WHERE user_id = $3`,
        [now, newStreak, userId],
      );
      await pool.query(
        `UPDATE accounts SET active_balance = active_balance + $1, active_earned = active_earned + $1 WHERE user_id = $2`,
        [reward, userId],
      );
      await pool.query(
        "INSERT INTO income_history(user_id, amount, type, earned_date) VALUES($1, $2, 'active', $3)",
        [userId, reward, earnedDate],
      );
    }

    return res.json({ success: true, sessionComplete: allDone, reward, f: sessionF });
  } catch (err) {
    req.log.error({ err }, "Error processing action");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/game/debug/reset-session — clear cooldown only (debug)
router.post("/game/debug/reset-session", requireAuth, async (req: any, res) => {
  const userId = req.userId;
  try {
    await pool.query(
      `UPDATE game_state SET
        last_session_time = NULL,
        session_in_progress = FALSE,
        current_session_water = FALSE,
        current_session_sun = FALSE,
        current_session_fertilizer = FALSE,
        streak_days = 0,
        missed_sessions = 0,
        updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error resetting session (debug)");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/game/debug/reset-all — wipe all user data (debug)
router.delete("/game/debug/reset-all", requireAuth, async (req: any, res) => {
  const userId = req.userId;
  try {
    await pool.query("DELETE FROM income_history WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM game_state WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM accounts WHERE user_id = $1", [userId]);
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error wiping user data (debug)");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
