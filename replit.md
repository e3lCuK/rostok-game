# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Two main products:
1. **Tree Idle Game** (`artifacts/tree-idle-game`) — simple SVG tree idle game at `/`
2. **Bank** (`artifacts/bank-game`) — gamified banking app at `/bank/` with Clerk Auth + PostgreSQL

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + raw `pg` pool (game state); Drizzle ORM (shared lib)
- **Auth**: Clerk Auth (`@clerk/express` server-side, `@clerk/react` client-side)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Bank App Architecture

### Authentication
- Clerk Auth (email+password + Google OAuth)
- Clerk proxy via `/__clerk` path, handled by api-server middleware
- Vite dev proxy: `/api` and `/__clerk` → `http://localhost:8080`

### Database Schema (raw SQL, not Drizzle)
- `accounts` — user balances, start date, accrual tracking
- `game_state` — session state (water/sun/fertilizer flags, last session time)
- `income_history` — audit log of all earnings

### Economy Formulas
- Standard daily: `balance × 0.12 / 365`
- Active daily: `balance × 0.15 / 365`
- Session reward: `activeDaily / 3`

### State Flow
- API-first: all state lives in PostgreSQL, fetched on load
- Optimistic offline accrual for day-boundary crossings
- Single 8-hour cooldown between sessions (no multi-session logic)

### Starting Capital
- First login shows onboarding screen: 10k / 100k / 1M ₽
- Capital split 50/50 between standard and active deposits
- Tree growth speed depends on total balance magnitude

### Files
- `artifacts/bank-game/src/lib/engine.ts` — all formulas, constants, state types
- `artifacts/bank-game/src/lib/api.ts` — API client
- `artifacts/api-server/src/routes/game.ts` — all game API endpoints

## Artifacts

| Artifact | Path | Port |
|----------|------|------|
| tree-idle-game | `/` | $PORT |
| bank-game | `/bank/` | $PORT |
| api-server | — | 8080 |
