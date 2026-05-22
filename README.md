# 🌳 Rostok

> A gamified banking simulator with real progression mechanics, session-based mini-games, and a living tree that grows with your balance.

---

## What is this?

Rostok is a fullstack pet project that wraps personal finance concepts in a game loop. You manage two deposits, play mini-games every 8 hours to earn bonus yield, and watch a tree grow as your active income accumulates. Miss sessions and your bonus efficiency degrades. Come back consistently and unlock super sessions with multiplied rewards.

Built as a portfolio/learning project to explore real game economy design, session state management, and fullstack TypeScript architecture.

---

## Features

- **Active & passive deposits** — two separate balances with different income mechanics
- **Session system** — play every 8 hours to claim active income
- **Super sessions** — missed sessions stack up; play them all at once for a multiplied reward
- **Bonus efficiency system** — bonus yield depends on mini-game performance, capital tier, and consistency
- **Three mini-games** per session:
  - 💧 **Water** — falling object catch game
  - ☀️ **Sunlight** — click accuracy challenge
  - 🌿 **Fertilizer** — Match-3 puzzle
- **Tree growth system** — 1 ₽ of active income = 1 mm of growth
- **Tree progression stages** — visual evolution from sprout to full tree
- **Session history** — full audit log of earnings
- **Animations and visual feedback** — smooth transitions, floaters, spring physics

---

## Game Mechanics

### Active Deposit
The core gameplay loop revolves around the active deposit.

- **Base income:** `balance × 12% / 365 / 3` per session
- **Bonus income:** depends on mini-game skill score, capital tier, and a random factor
- Bonus yield cap: **3% annually**
- To earn income, you must complete all 3 mini-games in a session

### Passive Deposit
- Earns **12% annually**, accrued automatically once per day
- No interaction required — just set and forget

### Super Sessions
When you miss a session, it doesn't disappear — it accumulates.

```
storedSessions = 1 + missedSessions
reward = baseReward × storedSessions
```

- **Bonus efficiency** degrades with missed sessions:
  ```
  bonusMultiplier = max(1 - missedSessions × 0.1, 0.1)
  ```
- Minimum bonus efficiency: **10%** (never fully lost)
- Super session button activates automatically when `storedSessions > 1`

### Bonus Efficiency Formula
```
bonusPercent = 0.03 × min(skillPart + capitalPart + randomPart, 1)

skillPart   = (avgSkillScore / 80) × 0.75
capitalPart = 0.16 / 0.18 / 0.20  (based on balance tier)
randomPart  = 0 – 0.04
```

---

## Tree Growth

The tree is a visual representation of total active income earned.

| Rule | Value |
|------|-------|
| Growth rate | 1 ₽ = 1 mm |
| Source | Active deposit income only |
| Accumulation | Lifetime total, never resets |

### Growth Stages

| Stage | Height |
|-------|--------|
| Sprout | 0 mm |
| Sapling | 500 mm |
| Young tree | 2 000 mm |
| Mature tree | 5 000 mm |
| Full tree | 8 500 mm |

---

## Tech Stack

### Frontend
- **React 18** + **TypeScript**
- **Vite** — dev server and build tooling
- **TanStack Query** — server state and data fetching
- **Framer Motion** — animations, spring physics, layout transitions
- **Lucide React** — icon system

### Backend
- **Express 5** — HTTP server
- **PostgreSQL** — primary database (raw `pg` pool)
- **Drizzle ORM** — schema definition and migrations
- **Zod** — input validation (shared via OpenAPI codegen)
- **Pino** — structured JSON logging

### Auth
- **Clerk** — email/password + Google OAuth (`@clerk/express` + `@clerk/react`)

### Tooling
- **pnpm workspaces** — monorepo package management
- **Orval** — OpenAPI-to-TypeScript codegen (React Query hooks + Zod schemas)
- **esbuild** — production server bundle
- **TypeScript 5** — strict mode across all packages

---

## Project Structure

```
/
├── artifacts/
│   ├── bank-game/          # React frontend (Vite)
│   │   └── src/
│   │       ├── components/ # UI components, mini-games, debug panel
│   │       ├── pages/      # GamePage, SavingsPage, OnboardingPage
│   │       └── lib/        # Game engine, formulas, API client
│   └── api-server/         # Express backend
│       └── src/
│           ├── routes/     # game.ts — all game endpoints
│           └── index.ts    # Server setup, middleware, Clerk proxy
├── lib/
│   ├── db/                 # Drizzle schema + migrations
│   └── api-spec/           # OpenAPI spec + Orval codegen config
└── scripts/                # Utility scripts
```

---

## Installation

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL instance

### Setup

```bash
# Clone the repo
git clone https://github.com/yourname/rostok.git
cd rostok

# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env
# Fill in: DATABASE_URL, CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY
```

### Run (development)

```bash
# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start the frontend (separate terminal)
pnpm --filter @workspace/bank-game run dev
```

### Database

```bash
# Push schema to your database
pnpm --filter @workspace/db run push
```

---

## Screenshots

> _Screenshots coming soon_

| | |
|---|---|
| ![Main page](docs/screenshots/main.png) | ![Active deposit](docs/screenshots/active.png) |
| Main page & tree | Active deposit session |
| ![Mini-games](docs/screenshots/minigames.png) | ![Tree progression](docs/screenshots/tree.png) |
| Mini-game flow | Tree growth stages |

---

## Roadmap

- [ ] More tree growth stages and visual variants
- [ ] Achievement system with unlockable rewards
- [ ] Seasonal events with limited-time bonus mechanics
- [ ] Enhanced mini-game animations and juice
- [ ] Mobile layout optimization
- [ ] Leaderboard / social comparison (optional)
- [ ] Offline accrual sync on reconnect

---

## About

Created as a game-oriented fullstack pet project — exploring how game design patterns (session loops, progression systems, degrading bonuses) can make mundane concepts like saving and interest rates actually engaging.

Suitable for: portfolio, interviews, or just messing around with game economy design.

---

> Built with TypeScript · React · Express · PostgreSQL · Clerk · Framer Motion
