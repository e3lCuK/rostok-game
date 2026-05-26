import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      nickname VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS missed_sessions INT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS pending_stored_sessions INT NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS pending_base_reward NUMERIC NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS pending_bonus_reward NUMERIC NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS player_xp INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS player_level SMALLINT NOT NULL DEFAULT 1`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS session_water_score SMALLINT NOT NULL DEFAULT 40`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS session_sun_score SMALLINT NOT NULL DEFAULT 40`);
  await pool.query(`ALTER TABLE game_state ADD COLUMN IF NOT EXISTS session_fertilizer_score SMALLINT NOT NULL DEFAULT 40`);
  logger.info("DB migrations applied");
}

runMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Migration failed, aborting startup");
    process.exit(1);
  });
