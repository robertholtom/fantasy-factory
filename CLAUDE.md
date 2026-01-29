# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start both server and client (concurrently)
npm run dev:server       # Server only (tsx watch, port 3001)
npm run dev:client       # Client only (Vite dev server)
npm run build            # Build both client and server
npm run test             # Run all tests once (Vitest)
npm run test:watch       # Run tests in watch mode
npx vitest run server/game/loop.test.ts   # Run a single test file
```

No linter or formatter is configured.

## Architecture

Fullstack TypeScript factory simulation game: players place buildings (miners, smelters, forgers) connected by belts to produce and sell items.

### Three layers

- **`client/`** - React 18 + Vite. Canvas-based rendering (`game/renderer.ts`), HUD sidebar (`game/HUD.tsx`), polls server state every 500ms via fetch (`game/api.ts`). Vite proxies `/api` requests to the Express server.
- **`server/`** - Express on port 3001. Routes in `routes/game.ts` call action functions in `game/actions.ts` which mutate game state. The game loop (`game/loop.ts`) ticks once per second.
- **`shared/`** - `types.ts` contains all interfaces (`GameState`, `Building`, `Belt`, etc.) and game constants (`PRODUCTION_TICKS`, `BUILDING_COSTS`, `RECIPE_BARS_COST`, etc.) used by both client and server.

### Server game logic

State is a single global object (`game/state.ts`: `getState()`/`setState()`).

**Game loop** (`game/loop.ts`) runs three phases each tick:
1. **Production** - miners produce ore (3 ticks), smelters consume 2 ore to produce 1 bar (5 ticks), forgers consume bars to produce daggers/armour (5-8 ticks)
2. **Belt transfer** - `getTransferableItem()` routes items based on destination type: smelters accept `iron_ore`, forgers accept `iron_bar`
3. **Auto-collect** - forgers without outgoing belts deposit finished goods into global inventory

**Actions** (`game/actions.ts`) handle user commands: `placeBuilding`, `placeBelt`, `setRecipe`, `demolishBuilding`, `sellItem`, `resetGame`. All validate inputs and return `{ state, error? }`.

### API endpoints

All under `/api/game/`: `GET /state`, `POST /place`, `POST /belt`, `POST /recipe`, `POST /demolish`, `POST /sell`, `POST /reset`.

## Testing

Tests live in `server/game/*.test.ts` (Vitest). Tests use `vi.useFakeTimers()` and advance the game loop by calling `vi.advanceTimersByTime(1000)` per tick. State is reset via `setState()` with `makeState()`/`makeBuilding()` helpers defined in each test file.
